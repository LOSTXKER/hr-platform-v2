"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function LeaveDecisionButtons({ leaveId }: { leaveId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function decide(action: "approve" | "reject") {
    let notes: string | null = null;
    if (action === "reject") {
      const n = window.prompt("เหตุผลที่ปฏิเสธ (optional):");
      if (n === null) return; // user cancelled
      notes = n || null;
    }
    startTransition(async () => {
      const res = await fetch(`/api/leaves/${leaveId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error ?? "ดำเนินการไม่สำเร็จ");
        return;
      }
      toast.success(action === "approve" ? "อนุมัติแล้ว" : "ปฏิเสธแล้ว");
      router.refresh();
    });
  }

  return (
    <div className="flex gap-1">
      <Button size="sm" variant="default" onClick={() => decide("approve")} disabled={pending}>
        อนุมัติ
      </Button>
      <Button size="sm" variant="outline" onClick={() => decide("reject")} disabled={pending}>
        ปฏิเสธ
      </Button>
    </div>
  );
}
