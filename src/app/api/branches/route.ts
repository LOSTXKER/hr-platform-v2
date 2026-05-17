import { NextResponse } from "next/server";
import { requireAuth, requireRole, AuthError } from "@/lib/api-auth";
import { listOrgRecords, createOrgRecord } from "@/lib/org-service";

export async function GET() {
  try {
    const ctx = await requireAuth();
    const rows = await listOrgRecords("branch", ctx.organizationId);
    return NextResponse.json({ data: rows });
  } catch (e) {
    return err(e);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    requireRole(ctx, ["OWNER", "ADMIN", "HR"]);
    const body = await req.json();
    const row = await createOrgRecord("branch", ctx.organizationId, body);
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (e) {
    return err(e);
  }
}

function err(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[api/branches]", msg);
  return NextResponse.json({ error: msg }, { status: 500 });
}
