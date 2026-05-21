import { NextResponse } from "next/server";
import { requireAuth, requireRole, AuthError } from "@/lib/api-auth";
import {
  getEmployeeShift,
  updateEmployeeShift,
  deleteEmployeeShift,
  ShiftValidationError,
} from "@/lib/shift-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const row = await getEmployeeShift(ctx.organizationId, id);
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const ctx = await requireAuth();
    requireRole(ctx, ["OWNER", "ADMIN", "HR", "MANAGER"]);
    const { id } = await params;
    const body = await req.json();
    const row = await updateEmployeeShift(ctx.organizationId, id, body);
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const ctx = await requireAuth();
    requireRole(ctx, ["OWNER", "ADMIN", "HR", "MANAGER"]);
    const { id } = await params;
    const ok = await deleteEmployeeShift(ctx.organizationId, id);
    if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}

function errorResponse(e: unknown): Response {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ShiftValidationError) return NextResponse.json({ error: e.message, field: e.field }, { status: 422 });
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[api/employee-shifts/[id]]", msg);
  return NextResponse.json({ error: msg }, { status: 500 });
}
