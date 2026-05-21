import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/api-auth";
import { removeSubscription } from "@/lib/push-service";

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const body = await req.json();
    if (!body.endpoint) {
      return NextResponse.json({ error: "endpoint required" }, { status: 422 });
    }
    await removeSubscription(ctx.organizationId, body.endpoint);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/push/unsubscribe]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
