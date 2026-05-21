// OT (overtime) request management — Sprint 1.4
// Thai labor law: WEEKDAY 1.5x, WEEKEND/HOLIDAY 3x of hourly rate
// 36 hour/week cap per employee (Thai law) — enforced on create + re-checked at approval

import { prisma } from "./prisma";
import { sendPushToEmployee } from "./push-service";
import type { OtDayType, OtStatus } from "@/generated/prisma/enums";

export class OtValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(`${field}: ${message}`);
  }
}

export const OT_WEEKLY_CAP_HOURS = 36;

export type OtMultiplier = 1.5 | 3;

export function multiplierFor(dayType: OtDayType): OtMultiplier {
  return dayType === "WEEKDAY" ? 1.5 : 3;
}

// Compute hours between start/end minutes — handles midnight crossing (end < start)
export function computeOtHours(startMinutes: number, endMinutes: number): number {
  const diff = endMinutes >= startMinutes
    ? endMinutes - startMinutes
    : 1440 - startMinutes + endMinutes;
  return Math.round((diff / 60) * 100) / 100; // round to 2 decimals
}

export function estimatePay(hours: number, hourlyRate: number, dayType: OtDayType): number {
  return Math.round(hours * hourlyRate * multiplierFor(dayType) * 100) / 100;
}

// Week boundaries: Mon (ISO weekday 1) → Sun
function weekBoundaries(date: Date): { start: Date; end: Date } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // ISO weekday: Mon=1..Sun=7. JS getUTCDay: Sun=0..Sat=6
  const jsDow = d.getUTCDay();
  const isoDow = jsDow === 0 ? 7 : jsDow;
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - (isoDow - 1));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start, end };
}

// Sum of REQUESTED + APPROVED hours for the week containing the given date
export async function getWeeklyOtHours(orgId: string, employeeId: string, date: Date): Promise<number> {
  const { start, end } = weekBoundaries(date);
  const rows = await prisma.otRequest.findMany({
    where: {
      organizationId: orgId,
      employeeId,
      workDate: { gte: start, lte: end },
      status: { in: ["REQUESTED", "APPROVED"] },
    },
    select: { hours: true },
  });
  return rows.reduce((s, r) => s + Number(r.hours), 0);
}

// ============================================================
// CRUD
// ============================================================

export type OtListFilter = {
  employeeId?: string;
  status?: OtStatus;
  from?: string;
  to?: string;
};

export async function listOtRequests(orgId: string, filter: OtListFilter = {}) {
  return prisma.otRequest.findMany({
    where: {
      organizationId: orgId,
      ...(filter.employeeId && { employeeId: filter.employeeId }),
      ...(filter.status && { status: filter.status }),
      ...(filter.from || filter.to
        ? {
            workDate: {
              ...(filter.from && { gte: new Date(filter.from) }),
              ...(filter.to && { lte: new Date(filter.to) }),
            },
          }
        : {}),
    },
    orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
    take: 500,
    include: {
      employee: { select: { id: true, firstNameTh: true, lastNameTh: true, employeeCode: true } },
      approver: { select: { id: true, firstNameTh: true, lastNameTh: true } },
    },
  });
}

export async function getOtRequest(orgId: string, id: string) {
  return prisma.otRequest.findFirst({
    where: { id, organizationId: orgId },
    include: { employee: true, approver: true },
  });
}

export type OtCreateInput = {
  employeeId: string;
  workDate: string; // YYYY-MM-DD
  startMinutes: number;
  endMinutes: number;
  dayType?: OtDayType;
  hourlyRate?: number | null;
  reason: string;
};

export async function createOtRequest(orgId: string, input: OtCreateInput) {
  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, organizationId: orgId },
  });
  if (!employee) throw new OtValidationError("employeeId", "not found in org");

  if (input.startMinutes < 0 || input.startMinutes >= 1440)
    throw new OtValidationError("startMinutes", "must be 0..1439");
  if (input.endMinutes < 0 || input.endMinutes >= 1440)
    throw new OtValidationError("endMinutes", "must be 0..1439");
  if (input.startMinutes === input.endMinutes)
    throw new OtValidationError("endMinutes", "start === end");

  const hours = computeOtHours(input.startMinutes, input.endMinutes);
  if (hours <= 0) throw new OtValidationError("hours", "must be > 0");

  const workDate = new Date(input.workDate);
  const weekHours = await getWeeklyOtHours(orgId, input.employeeId, workDate);
  if (weekHours + hours > OT_WEEKLY_CAP_HOURS) {
    throw new OtValidationError(
      "hours",
      `OT cap exceeded: this week already ${weekHours.toFixed(2)} hr + requested ${hours.toFixed(2)} > ${OT_WEEKLY_CAP_HOURS} hr (Thai labor law)`
    );
  }

  const dayType: OtDayType = input.dayType ?? "WEEKDAY";
  const estimatedPay = input.hourlyRate ? estimatePay(hours, input.hourlyRate, dayType) : null;

  return prisma.otRequest.create({
    data: {
      organizationId: orgId,
      employeeId: input.employeeId,
      workDate,
      startMinutes: input.startMinutes,
      endMinutes: input.endMinutes,
      hours,
      dayType,
      hourlyRate: input.hourlyRate ?? null,
      estimatedPay,
      reason: input.reason,
      status: "REQUESTED",
    },
  });
}

export async function decideOtRequest(
  orgId: string,
  id: string,
  decision: "APPROVED" | "REJECTED",
  approverEmployeeId: string,
  notes?: string
) {
  const existing = await prisma.otRequest.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!existing) return null;
  if (existing.status !== "REQUESTED") {
    throw new OtValidationError("status", `cannot decide — already ${existing.status}`);
  }

  if (decision === "APPROVED") {
    // Recompute weekly hours excluding this row, then check cap again
    const { start, end } = weekBoundaries(existing.workDate);
    const others = await prisma.otRequest.findMany({
      where: {
        organizationId: orgId,
        employeeId: existing.employeeId,
        workDate: { gte: start, lte: end },
        status: { in: ["REQUESTED", "APPROVED"] },
        id: { not: id },
      },
      select: { hours: true },
    });
    const otherHours = others.reduce((s, r) => s + Number(r.hours), 0);
    if (otherHours + Number(existing.hours) > OT_WEEKLY_CAP_HOURS) {
      throw new OtValidationError(
        "hours",
        `cannot approve — would exceed 36 hr/week cap (others ${otherHours.toFixed(2)} + this ${existing.hours})`
      );
    }
  }

  const updated = await prisma.otRequest.update({
    where: { id },
    data: {
      status: decision,
      approverId: approverEmployeeId,
      decidedAt: new Date(),
      decisionNotes: notes ?? null,
    },
  });

  sendPushToEmployee(orgId, existing.employeeId, {
    title: decision === "APPROVED" ? "OT ได้รับการอนุมัติ" : "OT ถูกปฏิเสธ",
    body: `${existing.workDate.toISOString().slice(0, 10)} ${Number(existing.hours)} ชม.${notes ? ` — ${notes}` : ""}`,
    url: "/ot",
    tag: `ot-${id}`,
  }).catch((e) => console.warn("[push] ot notify failed:", e));

  return updated;
}

export async function cancelOtRequest(orgId: string, id: string, employeeId: string) {
  const result = await prisma.otRequest.updateMany({
    where: { id, organizationId: orgId, employeeId, status: "REQUESTED" },
    data: { status: "CANCELLED" },
  });
  return result.count > 0;
}
