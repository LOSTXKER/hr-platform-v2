import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  listLeaveRequests,
  createLeaveRequest,
  LeaveValidationError,
} from "@/lib/leave-service";
import type { LeaveStatus } from "@/generated/prisma/enums";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);
    const rows = await listLeaveRequests(ctx.organizationId, {
      employeeId: searchParams.get("employeeId") ?? undefined,
      status: (searchParams.get("status") as LeaveStatus | null) ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });
    return NextResponse.json({ data: rows });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();

    const isPrivileged = ["OWNER", "ADMIN", "HR"].includes(ctx.role);
    let employeeId: string | undefined = body.employeeId;

    if (!isPrivileged) {
      // Members can only request leave for themselves
      const self = await prisma.employee.findFirst({
        where: { userId: ctx.userId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!self) {
        return NextResponse.json({ error: "user has no employee profile" }, { status: 403 });
      }
      employeeId = self.id;
    }

    if (!employeeId) {
      return NextResponse.json({ error: "employeeId required" }, { status: 422 });
    }

    const row = await createLeaveRequest(ctx.organizationId, { ...body, employeeId });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

function errorResponse(e: unknown): Response {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof LeaveValidationError)
    return NextResponse.json({ error: e.message, field: e.field }, { status: 422 });
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[api/leaves]", msg);
  return NextResponse.json({ error: msg }, { status: 500 });
}
