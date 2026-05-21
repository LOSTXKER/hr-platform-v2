import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  listAttendance,
  createAttendance,
  AttendanceValidationError,
} from "@/lib/attendance-service";
import type { AttendanceType } from "@/generated/prisma/enums";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);
    const rows = await listAttendance(ctx.organizationId, {
      employeeId: searchParams.get("employeeId") ?? undefined,
      branchId: searchParams.get("branchId") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      type: (searchParams.get("type") as AttendanceType | null) ?? undefined,
    });
    return NextResponse.json({ data: rows });
  } catch (e) {
    return errorResponse(e);
  }
}

// POST creates attendance record.
// Members may only create for themselves (employeeId omitted → derived from user).
// HR/admin may create for any employee.
export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();

    const isPrivileged = ["OWNER", "ADMIN", "HR"].includes(ctx.role);
    let employeeId: string | undefined = body.employeeId;

    if (!isPrivileged) {
      // Member self-check-in: derive employeeId from the user
      const self = await prisma.employee.findFirst({
        where: { userId: ctx.userId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!self) {
        return NextResponse.json(
          { error: "user has no employee profile in org" },
          { status: 403 }
        );
      }
      // Force self-id; ignore any employeeId in body
      employeeId = self.id;
    }

    if (!employeeId) {
      return NextResponse.json({ error: "employeeId required" }, { status: 422 });
    }

    const row = await createAttendance(ctx.organizationId, { ...body, employeeId });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

function errorResponse(e: unknown): Response {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof AttendanceValidationError)
    return NextResponse.json({ error: e.message, field: e.field }, { status: 422 });
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[api/attendances]", msg);
  return NextResponse.json({ error: msg }, { status: 500 });
}
