"use client";

import { useState, useTransition } from "react";
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

const THAI_PRESETS = [
  { code: "SICK", nameTh: "ลาป่วย", defaultQuotaDays: 30, attachmentThresholdDays: 3 },
  { code: "ANNUAL", nameTh: "ลาพักร้อน", defaultQuotaDays: 6, carryoverMaxDays: 10 },
  { code: "PERSONAL", nameTh: "ลากิจ", defaultQuotaDays: 3 },
  { code: "MATERNITY", nameTh: "ลาคลอด", defaultQuotaDays: 98, requiresAttachment: true },
  { code: "ORDINATION", nameTh: "ลาบวช", defaultQuotaDays: 15 },
  { code: "BEREAVEMENT", nameTh: "ลาฌาปนกิจ", defaultQuotaDays: 5 },
  { code: "WFH", nameTh: "ทำงานที่บ้าน", defaultQuotaDays: 0, deductsQuota: false },
  { code: "TRAINING", nameTh: "ลาฝึกอบรม", defaultQuotaDays: 0, deductsQuota: false },
];

export function LeaveTypeDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    code: "",
    nameTh: "",
    defaultQuotaDays: "0",
    deductsQuota: true,
    requiresAttachment: false,
    attachmentThresholdDays: "",
    carryoverMaxDays: "0",
  });

  function applyPreset(preset: (typeof THAI_PRESETS)[number]) {
    setForm({
      code: preset.code,
      nameTh: preset.nameTh,
      defaultQuotaDays: String(preset.defaultQuotaDays),
      deductsQuota: preset.deductsQuota ?? true,
      requiresAttachment: preset.requiresAttachment ?? false,
      attachmentThresholdDays: preset.attachmentThresholdDays?.toString() ?? "",
      carryoverMaxDays: String(preset.carryoverMaxDays ?? 0),
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim() || !form.nameTh.trim()) {
      toast.error("กรอก code + ชื่อ");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/leave-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          nameTh: form.nameTh.trim(),
          defaultQuotaDays: parseInt(form.defaultQuotaDays, 10) || 0,
          deductsQuota: form.deductsQuota,
          requiresAttachment: form.requiresAttachment,
          attachmentThresholdDays: form.attachmentThresholdDays
            ? parseInt(form.attachmentThresholdDays, 10)
            : null,
          carryoverMaxDays: parseInt(form.carryoverMaxDays, 10) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error ?? "สร้างไม่สำเร็จ");
        return;
      }
      toast.success("สร้างประเภทลาแล้ว");
      setOpen(false);
      setForm({
        code: "",
        nameTh: "",
        defaultQuotaDays: "0",
        deductsQuota: true,
        requiresAttachment: false,
        attachmentThresholdDays: "",
        carryoverMaxDays: "0",
      });
      router.refresh();
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>สร้างประเภทลา</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ประเภทลาใหม่</DialogTitle>
          </DialogHeader>
          <div className="border-b border-border pb-3 mb-3">
            <p className="text-xs text-muted-foreground mb-2">ใช้ template มาตรฐานไทย:</p>
            <div className="flex flex-wrap gap-1.5">
              {THAI_PRESETS.map((p) => (
                <Button
                  key={p.code}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(p)}
                >
                  {p.nameTh}
                </Button>
              ))}
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="code">รหัส (EN)</Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="SICK"
                  required
                />
              </div>
              <div>
                <Label htmlFor="name">ชื่อไทย</Label>
                <Input
                  id="name"
                  value={form.nameTh}
                  onChange={(e) => setForm({ ...form, nameTh: e.target.value })}
                  placeholder="ลาป่วย"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="quota">สิทธิ/ปี (0 = ไม่จำกัด)</Label>
                <Input
                  id="quota"
                  type="number"
                  min={0}
                  value={form.defaultQuotaDays}
                  onChange={(e) => setForm({ ...form, defaultQuotaDays: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="carry">Carryover (วัน/ปี)</Label>
                <Input
                  id="carry"
                  type="number"
                  min={0}
                  value={form.carryoverMaxDays}
                  onChange={(e) => setForm({ ...form, carryoverMaxDays: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.deductsQuota}
                  onChange={(e) => setForm({ ...form, deductsQuota: e.target.checked })}
                />
                หักโควต้า (uncheck = ไม่นับ เช่น training)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.requiresAttachment}
                  onChange={(e) => setForm({ ...form, requiresAttachment: e.target.checked })}
                />
                ต้องแนบเอกสารเสมอ
              </label>
            </div>
            <div>
              <Label htmlFor="threshold">แนบเอกสารเมื่อเกิน N วัน (เว้นว่าง = ไม่บังคับ)</Label>
              <Input
                id="threshold"
                type="number"
                min={0}
                value={form.attachmentThresholdDays}
                onChange={(e) => setForm({ ...form, attachmentThresholdDays: e.target.value })}
                placeholder="เช่น 3 สำหรับลาป่วย"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "กำลังบันทึก..." : "สร้าง"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
