// Shift + EmployeeShift CRUD — Sprint 1.2
// Shifts = templates (กะเช้า/บ่าย/ดึก). EmployeeShifts = daily assignment.

import { prisma } from "./prisma";

export class ShiftValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(`${field}: ${message}`);
  }
}

// ============================================================
// Shift templates
// ============================================================

export type ShiftCreateInput = {
  branchId?: string | null;
  name: string;
  startMinutes: number;
  endMinutes: number;
  breakMinutes?: number;
  graceMinutes?: number;
  isActive?: boolean;
};

export type ShiftUpdateInput = Partial<ShiftCreateInput>;

function validateShift(input: ShiftCreateInput | ShiftUpdateInput): void {
  if (input.startMinutes !== undefined) {
    if (input.startMinutes < 0 || input.startMinutes >= 1440) {
      throw new ShiftValidationError("startMinutes", "must be 0..1439");
    }
  }
  if (input.endMinutes !== undefined) {
    if (input.endMinutes < 0 || input.endMinutes >= 1440) {
      throw new ShiftValidationError("endMinutes", "must be 0..1439");
    }
  }
  if (input.breakMinutes !== undefined && input.breakMinutes < 0) {
    throw new ShiftValidationError("breakMinutes", "must be >= 0");
  }
  if (input.graceMinutes !== undefined && input.graceMinutes < 0) {
    throw new ShiftValidationError("graceMinutes", "must be >= 0");
  }
}

export async function listShifts(orgId: string) {
  return prisma.shift.findMany({
    where: { organizationId: orgId },
    orderBy: { startMinutes: "asc" },
  });
}

export async function getShift(orgId: string, id: string) {
  return prisma.shift.findFirst({ where: { id, organizationId: orgId } });
}

export async function createShift(orgId: string, input: ShiftCreateInput) {
  validateShift(input);
  return prisma.shift.create({
    data: {
      organizationId: orgId,
      name: input.name,
      startMinutes: input.startMinutes,
      endMinutes: input.endMinutes,
      breakMinutes: input.breakMinutes ?? 0,
      graceMinutes: input.graceMinutes ?? 5,
      isActive: input.isActive ?? true,
      branchId: input.branchId ?? null,
    },
  });
}

export async function updateShift(orgId: string, id: string, input: ShiftUpdateInput) {
  validateShift(input);
  const result = await prisma.shift.updateMany({
    where: { id, organizationId: orgId },
    data: input,
  });
  if (result.count === 0) return null;
  return getShift(orgId, id);
}

export async function deleteShift(orgId: string, id: string): Promise<boolean> {
  // RESTRICT FK on employee_shifts will prevent deletion if assigned
  const result = await prisma.shift.deleteMany({ where: { id, organizationId: orgId } });
  return result.count > 0;
}

// ============================================================
// Employee shift assignment
// ============================================================

export type EmployeeShiftCreateInput = {
  employeeId: string;
  shiftId: string;
  workDate: string; // ISO date "YYYY-MM-DD"
};

export type EmployeeShiftUpdateInput = Partial<Pick<EmployeeShiftCreateInput, "shiftId" | "workDate">>;

export async function listEmployeeShifts(orgId: string, opts?: { employeeId?: string; from?: string; to?: string }) {
  return prisma.employeeShift.findMany({
    where: {
      organizationId: orgId,
      ...(opts?.employeeId && { employeeId: opts.employeeId }),
      ...(opts?.from || opts?.to
        ? {
            workDate: {
              ...(opts?.from && { gte: new Date(opts.from) }),
              ...(opts?.to && { lte: new Date(opts.to) }),
            },
          }
        : {}),
    },
    orderBy: { workDate: "desc" },
    include: { shift: true, employee: { select: { id: true, firstNameTh: true, lastNameTh: true, employeeCode: true } } },
  });
}

export async function getEmployeeShift(orgId: string, id: string) {
  return prisma.employeeShift.findFirst({
    where: { id, organizationId: orgId },
    include: { shift: true, employee: true },
  });
}

export async function createEmployeeShift(orgId: string, input: EmployeeShiftCreateInput) {
  // Verify both employee + shift belong to org
  const [employee, shift] = await Promise.all([
    prisma.employee.findFirst({ where: { id: input.employeeId, organizationId: orgId } }),
    prisma.shift.findFirst({ where: { id: input.shiftId, organizationId: orgId } }),
  ]);
  if (!employee) throw new ShiftValidationError("employeeId", "not found in org");
  if (!shift) throw new ShiftValidationError("shiftId", "not found in org");

  return prisma.employeeShift.create({
    data: {
      organizationId: orgId,
      employeeId: input.employeeId,
      shiftId: input.shiftId,
      workDate: new Date(input.workDate),
    },
  });
}

export async function updateEmployeeShift(orgId: string, id: string, input: EmployeeShiftUpdateInput) {
  if (input.shiftId) {
    const shift = await prisma.shift.findFirst({ where: { id: input.shiftId, organizationId: orgId } });
    if (!shift) throw new ShiftValidationError("shiftId", "not found in org");
  }
  const data: { shiftId?: string; workDate?: Date } = {};
  if (input.shiftId) data.shiftId = input.shiftId;
  if (input.workDate) data.workDate = new Date(input.workDate);
  const result = await prisma.employeeShift.updateMany({
    where: { id, organizationId: orgId },
    data,
  });
  if (result.count === 0) return null;
  return getEmployeeShift(orgId, id);
}

export async function deleteEmployeeShift(orgId: string, id: string): Promise<boolean> {
  const result = await prisma.employeeShift.deleteMany({ where: { id, organizationId: orgId } });
  return result.count > 0;
}

// Helper: find shift assigned to employee on a specific date (UTC date boundary)
export async function findShiftForDate(orgId: string, employeeId: string, date: Date) {
  // Normalize to UTC date (YYYY-MM-DD) — work_date is DATE type
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const row = await prisma.employeeShift.findFirst({
    where: { organizationId: orgId, employeeId, workDate: day },
    include: { shift: true },
  });
  return row?.shift ?? null;
}
