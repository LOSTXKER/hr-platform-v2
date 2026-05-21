import { NextResponse } from "next/server";
import { requireAuth, requireRole, AuthError } from "@/lib/api-auth";
import {
  listEmployeeShifts,
  createEmployeeShift,
  ShiftValidationError,
} from "@/lib/shift-service";

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth();
    const { searchParams } = new URL(req.url);
    const rows = await listEmployeeShifts(ctx.organizationId, {
      employeeId: searchParams.get("employeeId") ?? undefined,
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
    requireRole(ctx, ["OWNER", "ADMIN", "HR", "MANAGER"]);
    const body = await req.json();
    const row = await createEmployeeShift(ctx.organizationId, body);
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

function errorResponse(e: unknown): Response {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof ShiftValidationError) return NextResponse.json({ error: e.message, field: e.field }, { status: 422 });
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[api/employee-shifts]", msg);
  return NextResponse.json({ error: msg }, { status: 500 });
}
