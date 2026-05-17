import { NextResponse } from "next/server";
import { requireAuth, requireRole, AuthError } from "@/lib/api-auth";
import { getOrgRecord, updateOrgRecord, deleteOrgRecord } from "@/lib/org-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const ctx = await requireAuth();
    const { id } = await params;
    const row = await getOrgRecord("position", ctx.organizationId, id);
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (e) {
    return err(e);
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const ctx = await requireAuth();
    requireRole(ctx, ["OWNER", "ADMIN", "HR"]);
    const { id } = await params;
    const body = await req.json();
    const row = await updateOrgRecord("position", ctx.organizationId, id, body);
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ data: row });
  } catch (e) {
    return err(e);
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const ctx = await requireAuth();
    requireRole(ctx, ["OWNER", "ADMIN", "HR"]);
    const { id } = await params;
    const ok = await deleteOrgRecord("position", ctx.organizationId, id);
    if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return err(e);
  }
}

function err(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[api/positions/[id]]", msg);
  return NextResponse.json({ error: msg }, { status: 500 });
}
