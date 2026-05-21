import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { saveSubscription, isPushConfigured, getPublicKey } from "@/lib/push-service";

export async function GET() {
  return NextResponse.json({
    configured: isPushConfigured(),
    publicKey: getPublicKey(),
  });
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth();
    const self = await prisma.employee.findFirst({
      where: { userId: ctx.userId, organizationId: ctx.organizationId },
      select: { id: true },
    });
    if (!self) {
      return NextResponse.json({ error: "no employee profile" }, { status: 403 });
    }
    const body = await req.json();
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json({ error: "invalid subscription shape" }, { status: 422 });
    }
    const row = await saveSubscription(ctx.organizationId, self.id, {
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      authSecret: body.keys.auth,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });
    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/push/subscribe]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
