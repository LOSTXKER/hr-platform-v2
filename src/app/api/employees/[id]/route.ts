import { NextResponse } from "next/server";
import { requireAuth, requireRole, AuthError } from "@/lib/api-auth";
import {
  getEmployee,
  updateEmployee,
  deleteEmployee,
  ValidationError,
} from "@/lib/employee-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const row = await getEmployee(ctx.organizationId, id);
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const existing = await getEmployee(ctx.organizationId, id);
    if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
    // Self-update vs HR-update: members can only edit their own; HR/admin edits anyone
    const isSelf = existing.userId === ctx.userId;
    if (!isSelf) requireRole(ctx, ["OWNER", "ADMIN", "HR"]);
    const row = await updateEmployee(ctx.organizationId, id, body);
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const ctx = await requireAuth();
    requireRole(ctx, ["OWNER", "ADMIN"]);
    const { id } = await params;
    const ok = await deleteEmployee(ctx.organizationId, id);
    if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}

function errorResponse(e: unknown): Response {
  if (e instanceof AuthError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  if (e instanceof ValidationError) {
    return NextResponse.json({ error: e.message, field: e.field }, { status: 422 });
  }
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[api/employees/[id]]", msg);
  return NextResponse.json({ error: msg }, { status: 500 });
}
