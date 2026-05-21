"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type LeaveType = {
  id: string;
  code: string;
  nameTh: string;
  requiresAttachment: boolean;
  attachmentThresholdDays: number | null;
  deductsQuota: boolean;
};

type Props = {
  types: LeaveType[];
};

export function LeaveRequestDialog({ types }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    leaveTypeId: types[0]?.id ?? "",
    startDate: today,
    endDate: today,
    reason: "",
    attachmentUrl: "",
  });

  const selectedType = useMemo(
    () => types.find((t) => t.id === form.leaveTypeId),
    [types, form.leaveTypeId]
  );

  const days = useMemo(() => {
    const s = new Date(form.startDate).getTime();
    const e = new Date(form.endDate).getTime();
    if (isNaN(s) || isNaN(e) || e < s) return 0;
    return Math.floor((e - s) / 86400000) + 1;
  }, [form.startDate, form.endDate]);

  const needsAttachment = !!selectedType && (
    selectedType.requiresAttachment ||
    (selectedType.attachmentThresholdDays !== null && days > selectedType.attachmentThresholdDays)
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.leaveTypeId) {
      toast.error("เลือกประเภทลา");
      return;
    }
    if (days <= 0) {
      toast.error("ช่วงวันที่ไม่ถูกต้อง");
      return;
    }
    if (!form.reason.trim()) {
      toast.error("กรอกเหตุผล");
      return;
    }
    if (needsAttachment && !form.attachmentUrl.trim()) {
      toast.error("ลานี้ต้องแนบเอกสาร (เช่นใบรับรองแพทย์)");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaveTypeId: form.leaveTypeId,
          startDate: form.startDate,
          endDate: form.endDate,
          reason: form.reason.trim(),
          attachmentUrl: form.attachmentUrl.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error ?? "ขอลาไม่สำเร็จ");
        return;
      }
      toast.success("ส่งคำขอลาแล้ว — รอ manager อนุมัติ");
      setOpen(false);
      setForm({ ...form, reason: "", attachmentUrl: "" });
      router.refresh();
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>ขอลา</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ขอลา</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="type">ประเภทลา</Label>
              <Select
                value={form.leaveTypeId}
                onValueChange={(v) => setForm({ ...form, leaveTypeId: v ?? "" })}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nameTh}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="start">วันเริ่ม</Label>
                <Input
                  id="start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="end">วันสิ้นสุด</Label>
                <Input
                  id="end"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  required
                />
              </div>
            </div>
            <p className="text-sm">
              <span className="text-muted-foreground">รวม: </span>
              <span className="font-medium">{days} วัน</span>
            </p>
            <div>
              <Label htmlFor="reason">เหตุผล</Label>
              <Input
                id="reason"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="เช่น ลาป่วย / กิจส่วนตัว / ท่องเที่ยว"
                required
              />
            </div>
            {needsAttachment && (
              <div>
                <Label htmlFor="att">เอกสารแนบ (URL)</Label>
                <Input
                  id="att"
                  type="url"
                  value={form.attachmentUrl}
                  onChange={(e) => setForm({ ...form, attachmentUrl: e.target.value })}
                  placeholder="https://..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  ลานี้ต้องแนบ — ใส่ URL ของเอกสารชั่วคราว (Phase 1.4 จะมี upload ตรง)
                </p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "กำลังส่ง..." : "ส่งคำขอ"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
