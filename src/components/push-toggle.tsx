"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

type PushInfo = { configured: boolean; publicKey: string | null };

export function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [pushInfo, setPushInfo] = useState<PushInfo | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sw = "serviceWorker" in navigator;
    const push = "PushManager" in window;
    setSupported(sw && push);
    if (!sw || !push) return;

    fetch("/api/push/subscribe")
      .then((r) => r.json())
      .then((info: PushInfo) => setPushInfo(info))
      .catch(() => setPushInfo({ configured: false, publicKey: null }));

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEnabled(!!sub))
      .catch(() => setEnabled(false));
  }, []);

  if (!supported || !pushInfo) return null;
  if (!pushInfo.configured || !pushInfo.publicKey) return null;

  async function toggle() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        await existing.unsubscribe();
        setEnabled(false);
        toast.success("ปิดการแจ้งเตือนแล้ว");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("ไม่ได้รับ permission");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pushInfo!.publicKey!) as BufferSource,
      });
      const subObj = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subObj),
      });
      if (!res.ok) {
        await sub.unsubscribe();
        const j = await res.json();
        toast.error(j?.error ?? "เปิดการแจ้งเตือนไม่สำเร็จ");
        return;
      }
      setEnabled(true);
      toast.success("เปิดการแจ้งเตือนแล้ว");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="text-xs px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
      title="แจ้งเตือนเมื่อ leave/OT ถูกอนุมัติ/ปฏิเสธ"
    >
      {enabled === null ? "..." : enabled ? "🔔 เปิด" : "🔕 ปิด"}
    </button>
  );
}
