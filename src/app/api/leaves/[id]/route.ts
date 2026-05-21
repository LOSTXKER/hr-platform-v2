import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  getLeaveRequest,
  decideLeaveRequest,
  cancelLeaveRequest,
  LeaveValidationError,
} from "@/lib/leave-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const row = await getLeaveRequest(ctx.organizationId, id);
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (e) {
    return errorResponse(e);
  }
}

// PATCH supports two flows:
// 1. requester cancels own PENDING → { action: "cancel" }
// 2. HR/manager decides → { action: "approve" | "reject", notes }
export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await req.json();

    if (body.action === "cancel") {
      const self = await prisma.employee.findFirst({
        where: { userId: ctx.userId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!self) return NextResponse.json({ error: "not requester" }, { status: 403 });
      const ok = await cancelLeaveRequest(ctx.organizationId, id, self.id);
      if (!ok) return NextResponse.json({ error: "cannot cancel" }, { status: 409 });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "approve" || body.action === "reject") {
      if (!["OWNER", "ADMIN", "HR", "MANAGER"].includes(ctx.role)) {
        return NextResponse.json({ error: "not authorized" }, { status: 403 });
      }
      // Find approver's employee id (manager/HR also needs an employee record for audit)
      const approver = await prisma.employee.findFirst({
        where: { userId: ctx.userId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!approver) {
        return NextResponse.json(
          { error: "approver must have an employee record" },
          { status: 403 }
        );
      }
      const decision = body.action === "approve" ? "APPROVED" : "REJECTED";
      const row = await decideLeaveRequest(
        ctx.organizationId,
        id,
        decision,
        approver.id,
        body.notes
      );
      if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
      return NextResponse.json({ data: row });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 422 });
  } catch (e) {
    return errorResponse(e);
  }
}

function errorResponse(e: unknown): Response {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof LeaveValidationError)
    return NextResponse.json({ error: e.message, field: e.field }, { status: 422 });
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[api/leaves/[id]]", msg);
  return NextResponse.json({ error: msg }, { status: 500 });
}
