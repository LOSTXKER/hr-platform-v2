// Attendance CRUD + status computation — Sprint 1.2
// On check-in/out: compute LATE/EARLY/ON_TIME from assigned shift + geofence check from branch GPS

import { prisma } from "./prisma";
import { findShiftForDate } from "./shift-service";
import type { AttendanceMethod, AttendanceStatus, AttendanceType } from "@/generated/prisma/enums";

export class AttendanceValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(`${field}: ${message}`);
  }
}

export type AttendanceCreateInput = {
  employeeId: string;
  branchId?: string | null;
  type: AttendanceType;
  method: AttendanceMethod;
  occurredAt?: string; // ISO timestamp; defaults to now
  gpsLat?: number | null;
  gpsLng?: number | null;
  gpsAccuracyM?: number | null;
  selfieUrl?: string | null;
  offlineSyncId?: string | null;
  notes?: string | null;
};

export type AttendanceListFilter = {
  employeeId?: string;
  branchId?: string;
  from?: string;
  to?: string;
  type?: AttendanceType;
};

// ============================================================
// Geofence helper — Haversine distance (meters)
// ============================================================
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ============================================================
// Status computation
// ============================================================
type ComputeStatusArgs = {
  type: AttendanceType;
  occurredAt: Date;
  shiftStartMin?: number;
  shiftEndMin?: number;
  shiftGraceMin?: number;
  insideGeofence?: boolean | null;
};

export function computeStatus(args: ComputeStatusArgs): AttendanceStatus {
  // Geofence violation overrides time-based status (per spec §2.7)
  if (args.insideGeofence === false) return "OUT_OF_GEOFENCE" as AttendanceStatus;

  // BREAK events don't track late/early
  if (args.type === "BREAK_START" || args.type === "BREAK_END") {
    return "ON_TIME" as AttendanceStatus;
  }

  // No shift assigned → can't determine late/early
  if (args.shiftStartMin === undefined || args.shiftEndMin === undefined) {
    return "ON_TIME" as AttendanceStatus;
  }

  // Compute minutes since midnight in Bangkok TZ (UTC+7)
  // occurredAt arrives as UTC instant; shift times are local Bangkok minutes
  const bkkMs = args.occurredAt.getTime() + 7 * 60 * 60 * 1000;
  const bkk = new Date(bkkMs);
  const eventMin = bkk.getUTCHours() * 60 + bkk.getUTCMinutes();

  const grace = args.shiftGraceMin ?? 5;

  if (args.type === "CHECK_IN") {
    return eventMin > args.shiftStartMin + grace
      ? ("LATE" as AttendanceStatus)
      : ("ON_TIME" as AttendanceStatus);
  }
  if (args.type === "CHECK_OUT") {
    // shift can span midnight (e.g. 22:00 → 06:00)
    // Compare event time to expected end; "early" if before
    if (args.shiftEndMin < args.shiftStartMin) {
      // night shift: end is next day's eventMin; if eventMin is small (<noon), it's same day after midnight
      // Treat early if eventMin in [shiftStart, shiftEnd) before crossing midnight, then early if cross + before end
      const crossedMidnight = eventMin < args.shiftStartMin;
      if (crossedMidnight) {
        return eventMin < args.shiftEndMin
          ? ("EARLY" as AttendanceStatus)
          : ("ON_TIME" as AttendanceStatus);
      }
      return "EARLY" as AttendanceStatus; // still before midnight, before shift_end → early
    }
    return eventMin < args.shiftEndMin
      ? ("EARLY" as AttendanceStatus)
      : ("ON_TIME" as AttendanceStatus);
  }

  return "ON_TIME" as AttendanceStatus;
}

// ============================================================
// CRUD
// ============================================================

export async function listAttendance(orgId: string, filter: AttendanceListFilter = {}) {
  return prisma.attendanceRecord.findMany({
    where: {
      organizationId: orgId,
      ...(filter.employeeId && { employeeId: filter.employeeId }),
      ...(filter.branchId && { branchId: filter.branchId }),
      ...(filter.type && { type: filter.type }),
      ...(filter.from || filter.to
        ? {
            occurredAt: {
              ...(filter.from && { gte: new Date(filter.from) }),
              ...(filter.to && { lte: new Date(filter.to) }),
            },
          }
        : {}),
    },
    orderBy: { occurredAt: "desc" },
    take: 500,
    include: {
      employee: { select: { id: true, firstNameTh: true, lastNameTh: true, employeeCode: true } },
      branch: { select: { id: true, name: true } },
    },
  });
}

export async function getAttendance(orgId: string, id: string) {
  return prisma.attendanceRecord.findFirst({
    where: { id, organizationId: orgId },
    include: { employee: true, branch: true },
  });
}

export async function createAttendance(orgId: string, input: AttendanceCreateInput) {
  // Verify employee belongs to org
  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, organizationId: orgId },
  });
  if (!employee) throw new AttendanceValidationError("employeeId", "not found in org");

  let insideGeofence: boolean | null = null;
  let branchRow: { gpsLat: unknown; gpsLng: unknown; radiusMeters: number } | null = null;
  if (input.branchId) {
    branchRow = await prisma.branch.findFirst({
      where: { id: input.branchId, organizationId: orgId },
      select: { gpsLat: true, gpsLng: true, radiusMeters: true },
    });
    if (!branchRow) throw new AttendanceValidationError("branchId", "not found in org");
    if (input.gpsLat !== undefined && input.gpsLng !== undefined && input.gpsLat !== null && input.gpsLng !== null && branchRow.gpsLat && branchRow.gpsLng) {
      const distance = haversineMeters(
        Number(input.gpsLat),
        Number(input.gpsLng),
        Number(branchRow.gpsLat),
        Number(branchRow.gpsLng)
      );
      insideGeofence = distance <= branchRow.radiusMeters;
    }
  }

  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();

  // Look up assigned shift for that date (for status compute)
  const shift = await findShiftForDate(orgId, input.employeeId, occurredAt);

  const status = computeStatus({
    type: input.type,
    occurredAt,
    shiftStartMin: shift?.startMinutes,
    shiftEndMin: shift?.endMinutes,
    shiftGraceMin: shift?.graceMinutes,
    insideGeofence,
  });

  return prisma.attendanceRecord.create({
    data: {
      organizationId: orgId,
      employeeId: input.employeeId,
      branchId: input.branchId ?? null,
      type: input.type,
      method: input.method,
      status,
      occurredAt,
      gpsLat: input.gpsLat ?? null,
      gpsLng: input.gpsLng ?? null,
      gpsAccuracyM: input.gpsAccuracyM ?? null,
      insideGeofence,
      selfieUrl: input.selfieUrl ?? null,
      offlineSyncId: input.offlineSyncId ?? null,
      notes: input.notes ?? null,
    },
  });
}

export type AttendanceUpdateInput = Partial<
  Pick<AttendanceCreateInput, "type" | "method" | "occurredAt" | "notes">
> & {
  status?: AttendanceStatus; // HR can manually override status
};

export async function updateAttendance(orgId: string, id: string, input: AttendanceUpdateInput) {
  const data: Record<string, unknown> = {};
  if (input.type !== undefined) data.type = input.type;
  if (input.method !== undefined) data.method = input.method;
  if (input.status !== undefined) data.status = input.status;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.occurredAt !== undefined) data.occurredAt = new Date(input.occurredAt);

  const result = await prisma.attendanceRecord.updateMany({
    where: { id, organizationId: orgId },
    data,
  });
  if (result.count === 0) return null;
  return getAttendance(orgId, id);
}

export async function deleteAttendance(orgId: string, id: string): Promise<boolean> {
  const result = await prisma.attendanceRecord.deleteMany({ where: { id, organizationId: orgId } });
  return result.count > 0;
}

// Convenience: latest event for an employee (for "are you checked in?" UI)
export async function getLatestForEmployee(orgId: string, employeeId: string) {
  return prisma.attendanceRecord.findFirst({
    where: { organizationId: orgId, employeeId },
    orderBy: { occurredAt: "desc" },
  });
}
