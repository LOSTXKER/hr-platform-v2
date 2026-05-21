// Web Push service — Sprint 1.5
// Sends notifications via VAPID. No-op if VAPID env vars missing (dev convenience).
// Auto-cleans 410-Gone subscriptions (browser disabled push or uninstalled SW).

import webpush from "web-push";
import { prisma } from "./prisma";

const PUBLIC = process.env.VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:hr@anajak.local";

let configured = false;
if (PUBLIC && PRIVATE) {
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
  configured = true;
}

export function isPushConfigured(): boolean {
  return configured;
}

export function getPublicKey(): string | null {
  return PUBLIC ?? null;
}

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
};

// Send to all subscriptions of an employee. Returns count of successful sends.
export async function sendPushToEmployee(
  orgId: string,
  employeeId: string,
  payload: PushPayload
): Promise<number> {
  if (!configured) return 0;
  const subs = await prisma.pushSubscription.findMany({
    where: { organizationId: orgId, employeeId },
  });
  if (subs.length === 0) return 0;

  let successCount = 0;
  const deadIds: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.authSecret },
          },
          JSON.stringify(payload)
        );
        successCount++;
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          // Subscription gone — clean up
          deadIds.push(sub.id);
        } else {
          console.warn("[push] send failed", code, (err as Error)?.message);
        }
      }
    })
  );

  if (deadIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: deadIds } } });
  }
  // Touch last_used_at on success (single update)
  if (successCount > 0) {
    await prisma.pushSubscription.updateMany({
      where: { employeeId, organizationId: orgId },
      data: { lastUsedAt: new Date() },
    });
  }
  return successCount;
}

export async function saveSubscription(
  orgId: string,
  employeeId: string,
  data: { endpoint: string; p256dh: string; authSecret: string; userAgent?: string }
) {
  // Upsert by endpoint (unique)
  return prisma.pushSubscription.upsert({
    where: { endpoint: data.endpoint },
    create: {
      organizationId: orgId,
      employeeId,
      endpoint: data.endpoint,
      p256dh: data.p256dh,
      authSecret: data.authSecret,
      userAgent: data.userAgent ?? null,
    },
    update: {
      employeeId,
      p256dh: data.p256dh,
      authSecret: data.authSecret,
      userAgent: data.userAgent ?? null,
      lastUsedAt: new Date(),
    },
  });
}

export async function removeSubscription(orgId: string, endpoint: string) {
  return prisma.pushSubscription.deleteMany({
    where: { organizationId: orgId, endpoint },
  });
}
