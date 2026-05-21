import { NextResponse } from "next/server";
import { requireAuth, requireRole, AuthError } from "@/lib/api-auth";
import { listLeaveTypes, createLeaveType, LeaveValidationError } from "@/lib/leave-service";

export async function GET() {
  try {
    const ctx = await requireAuth();
    const rows = await listLeaveTypes(ctx.organizationId);
    return NextResponse.json({ data: rows });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    requireRole(ctx, ["OWNER", "ADMIN", "HR"]);
    const body = await req.json();
    const row = await createLeaveType(ctx.organizationId, body);
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
  console.error("[api/leave-types]", msg);
  return NextResponse.json({ error: msg }, { status: 500 });
}
