// Leave management — Sprint 1.3
// Quota = computed on-the-fly from approved requests in current calendar year (no balance cache).
// Carryover = simplified: previous year unused (capped at type.carryoverMaxDays) added to current quota.

import { prisma } from "./prisma";
import type { LeaveStatus } from "@/generated/prisma/enums";

export class LeaveValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(`${field}: ${message}`);
  }
}

// ============================================================
// Leave type CRUD
// ============================================================

export type LeaveTypeCreateInput = {
  code: string;
  nameTh: string;
  defaultQuotaDays: number;
  deductsQuota?: boolean;
  requiresAttachment?: boolean;
  attachmentThresholdDays?: number | null;
  carryoverMaxDays?: number;
  isActive?: boolean;
};

export type LeaveTypeUpdateInput = Partial<LeaveTypeCreateInput>;

export async function listLeaveTypes(orgId: string) {
  return prisma.leaveType.findMany({
    where: { organizationId: orgId },
    orderBy: { code: "asc" },
  });
}

export async function getLeaveType(orgId: string, id: string) {
  return prisma.leaveType.findFirst({ where: { id, organizationId: orgId } });
}

export async function createLeaveType(orgId: string, input: LeaveTypeCreateInput) {
  if (!input.code?.trim()) throw new LeaveValidationError("code", "required");
  if (!input.nameTh?.trim()) throw new LeaveValidationError("nameTh", "required");
  if (input.defaultQuotaDays < 0) throw new LeaveValidationError("defaultQuotaDays", "must be >= 0");

  return prisma.leaveType.create({
    data: {
      organizationId: orgId,
      code: input.code.trim().toUpperCase(),
      nameTh: input.nameTh.trim(),
      defaultQuotaDays: input.defaultQuotaDays,
      deductsQuota: input.deductsQuota ?? true,
      requiresAttachment: input.requiresAttachment ?? false,
      attachmentThresholdDays: input.attachmentThresholdDays ?? null,
      carryoverMaxDays: input.carryoverMaxDays ?? 0,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updateLeaveType(orgId: string, id: string, input: LeaveTypeUpdateInput) {
  const result = await prisma.leaveType.updateMany({
    where: { id, organizationId: orgId },
    data: input,
  });
  if (result.count === 0) return null;
  return getLeaveType(orgId, id);
}

export async function deleteLeaveType(orgId: string, id: string): Promise<boolean> {
  // RESTRICT FK on leave_requests prevents deletion if used
  const result = await prisma.leaveType.deleteMany({ where: { id, organizationId: orgId } });
  return result.count > 0;
}

// ============================================================
// Leave request flow
// ============================================================

export type LeaveRequestCreateInput = {
  employeeId: string;
  leaveTypeId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  reason: string;
  attachmentUrl?: string | null;
};

export type LeaveRequestListFilter = {
  employeeId?: string;
  status?: LeaveStatus;
  from?: string;
  to?: string;
};

// Compute business days between two dates (inclusive). Sat/Sun excluded by default — simplified.
// For Phase 1, all days counted (no weekend exclusion) — HR can adjust manually if needed.
export function countLeaveDays(startDate: Date, endDate: Date): number {
  const ms = endDate.getTime() - startDate.getTime();
  return Math.floor(ms / 86400000) + 1;
}

export async function listLeaveRequests(orgId: string, filter: LeaveRequestListFilter = {}) {
  return prisma.leaveRequest.findMany({
    where: {
      organizationId: orgId,
      ...(filter.employeeId && { employeeId: filter.employeeId }),
      ...(filter.status && { status: filter.status }),
      ...(filter.from || filter.to
        ? {
            startDate: {
              ...(filter.from && { gte: new Date(filter.from) }),
              ...(filter.to && { lte: new Date(filter.to) }),
            },
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 500,
    include: {
      employee: { select: { id: true, firstNameTh: true, lastNameTh: true, employeeCode: true } },
      approver: { select: { id: true, firstNameTh: true, lastNameTh: true } },
      leaveType: { select: { id: true, code: true, nameTh: true } },
    },
  });
}

export async function getLeaveRequest(orgId: string, id: string) {
  return prisma.leaveRequest.findFirst({
    where: { id, organizationId: orgId },
    include: {
      employee: true,
      approver: true,
      leaveType: true,
    },
  });
}

export async function createLeaveRequest(orgId: string, input: LeaveRequestCreateInput) {
  const [employee, leaveType] = await Promise.all([
    prisma.employee.findFirst({ where: { id: input.employeeId, organizationId: orgId } }),
    prisma.leaveType.findFirst({ where: { id: input.leaveTypeId, organizationId: orgId } }),
  ]);
  if (!employee) throw new LeaveValidationError("employeeId", "not found in org");
  if (!leaveType) throw new LeaveValidationError("leaveTypeId", "not found in org");
  if (!leaveType.isActive) throw new LeaveValidationError("leaveTypeId", "leave type is inactive");

  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  if (end < start) throw new LeaveValidationError("endDate", "must be >= startDate");
  const days = countLeaveDays(start, end);

  // Attachment requirement check
  const needsAttachment =
    leaveType.requiresAttachment ||
    (leaveType.attachmentThresholdDays !== null && days > leaveType.attachmentThresholdDays);
  if (needsAttachment && !input.attachmentUrl) {
    throw new LeaveValidationError(
      "attachmentUrl",
      `${leaveType.nameTh} require attachment when days > ${leaveType.attachmentThresholdDays ?? 0}`
    );
  }

  // Quota check (skip if type doesn't deduct)
  if (leaveType.deductsQuota && leaveType.defaultQuotaDays > 0) {
    const balance = await getLeaveBalance(orgId, input.employeeId, leaveType.id);
    if (days > balance.remaining) {
      throw new LeaveValidationError(
        "days",
        `quota exceeded: requested ${days}, remaining ${balance.remaining}`
      );
    }
  }

  return prisma.leaveRequest.create({
    data: {
      organizationId: orgId,
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      startDate: start,
      endDate: end,
      days,
      reason: input.reason,
      attachmentUrl: input.attachmentUrl ?? null,
      status: "PENDING",
    },
  });
}

export async function decideLeaveRequest(
  orgId: string,
  id: string,
  decision: "APPROVED" | "REJECTED",
  approverEmployeeId: string,
  notes?: string
) {
  const existing = await prisma.leaveRequest.findFirst({
    where: { id, organizationId: orgId },
    include: { leaveType: true },
  });
  if (!existing) return null;
  if (existing.status !== "PENDING") {
    throw new LeaveValidationError("status", `cannot decide — already ${existing.status}`);
  }

  // For APPROVED: re-check quota at decision time (request may have aged + new approvals consumed it)
  if (decision === "APPROVED" && existing.leaveType.deductsQuota && existing.leaveType.defaultQuotaDays > 0) {
    const balance = await getLeaveBalance(orgId, existing.employeeId, existing.leaveTypeId);
    if (Number(existing.days) > balance.remaining) {
      throw new LeaveValidationError(
        "days",
        `quota now insufficient: requested ${existing.days}, remaining ${balance.remaining}`
      );
    }
  }

  return prisma.leaveRequest.update({
    where: { id },
    data: {
      status: decision,
      approverId: approverEmployeeId,
      decidedAt: new Date(),
      decisionNotes: notes ?? null,
    },
  });
}

export async function cancelLeaveRequest(orgId: string, id: string, employeeId: string) {
  const result = await prisma.leaveRequest.updateMany({
    where: { id, organizationId: orgId, employeeId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  return result.count > 0;
}

// ============================================================
// Balance compute
// ============================================================

export type LeaveBalance = {
  quota: number;
  carryover: number;
  used: number;
  pending: number;
  remaining: number;
};

export async function getLeaveBalance(
  orgId: string,
  employeeId: string,
  leaveTypeId: string,
  year?: number
): Promise<LeaveBalance> {
  const y = year ?? new Date().getFullYear();
  const yearStart = new Date(Date.UTC(y, 0, 1));
  const yearEnd = new Date(Date.UTC(y, 11, 31));
  const prevStart = new Date(Date.UTC(y - 1, 0, 1));
  const prevEnd = new Date(Date.UTC(y - 1, 11, 31));

  const leaveType = await prisma.leaveType.findFirst({
    where: { id: leaveTypeId, organizationId: orgId },
  });
  if (!leaveType) {
    return { quota: 0, carryover: 0, used: 0, pending: 0, remaining: 0 };
  }

  const quota = leaveType.defaultQuotaDays;

  // Current-year usage
  const currentAgg = await prisma.leaveRequest.findMany({
    where: {
      organizationId: orgId,
      employeeId,
      leaveTypeId,
      startDate: { gte: yearStart, lte: yearEnd },
      status: { in: ["APPROVED", "PENDING"] },
    },
    select: { days: true, status: true },
  });

  let used = 0;
  let pending = 0;
  for (const r of currentAgg) {
    const d = Number(r.days);
    if (r.status === "APPROVED") used += d;
    else if (r.status === "PENDING") pending += d;
  }

  // Carryover from previous year (capped). Only applies if employee was hired before previous year started.
  let carryover = 0;
  if (leaveType.carryoverMaxDays > 0) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, organizationId: orgId },
      select: { startDate: true },
    });
    const hireYear = employee?.startDate.getUTCFullYear() ?? y;
    if (hireYear < y) {
      const prevAgg = await prisma.leaveRequest.findMany({
        where: {
          organizationId: orgId,
          employeeId,
          leaveTypeId,
          startDate: { gte: prevStart, lte: prevEnd },
          status: "APPROVED",
        },
        select: { days: true },
      });
      const prevUsed = prevAgg.reduce((s, r) => s + Number(r.days), 0);
      const prevUnused = Math.max(0, quota - prevUsed);
      carryover = Math.min(leaveType.carryoverMaxDays, prevUnused);
    }
  }

  const remaining = Math.max(0, quota + carryover - used - pending);
  return { quota, carryover, used, pending, remaining };
}

export async function getAllBalancesForEmployee(orgId: string, employeeId: string, year?: number) {
  const types = await prisma.leaveType.findMany({
    where: { organizationId: orgId, isActive: true },
    orderBy: { code: "asc" },
  });
  const balances = await Promise.all(
    types.map(async (t) => ({
      leaveType: t,
      balance: await getLeaveBalance(orgId, employeeId, t.id, year),
    }))
  );
  return balances;
}
