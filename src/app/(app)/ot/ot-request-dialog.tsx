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

const MULTIPLIER: Record<string, number> = {
  WEEKDAY: 1.5,
  WEEKEND: 3,
  HOLIDAY: 3,
};

function parseHM(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = parseInt(m[1]!, 10);
  const min = parseInt(m[2]!, 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function computeHours(startMin: number, endMin: number): number {
  const diff = endMin >= startMin ? endMin - startMin : 1440 - startMin + endMin;
  return Math.round((diff / 60) * 100) / 100;
}

export function OtRequestDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    workDate: today,
    startTime: "18:00",
    endTime: "21:00",
    dayType: "WEEKDAY",
    hourlyRate: "",
    reason: "",
  });

  const hours = useMemo(() => {
    const s = parseHM(form.startTime);
    const e = parseHM(form.endTime);
    if (s === null || e === null) return 0;
    if (s === e) return 0;
    return computeHours(s, e);
  }, [form.startTime, form.endTime]);

  const estimate = useMemo(() => {
    const rate = parseFloat(form.hourlyRate);
    if (isNaN(rate) || hours <= 0) return 0;
    return Math.round(hours * rate * MULTIPLIER[form.dayType]!);
  }, [hours, form.hourlyRate, form.dayType]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const startMin = parseHM(form.startTime);
    const endMin = parseHM(form.endTime);
    if (startMin === null || endMin === null) {
      toast.error("เวลาไม่ถูกต้อง");
      return;
    }
    if (startMin === endMin) {
      toast.error("เวลาเริ่ม = เวลาสิ้นสุด");
      return;
    }
    if (!form.reason.trim()) {
      toast.error("กรอกเหตุผล");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/ot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workDate: form.workDate,
          startMinutes: startMin,
          endMinutes: endMin,
          dayType: form.dayType,
          hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : null,
          reason: form.reason.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error ?? "ขอ OT ไม่สำเร็จ");
        return;
      }
      toast.success("ส่งคำขอ OT แล้ว — รอ manager อนุมัติ");
      setOpen(false);
      setForm({ ...form, reason: "" });
      router.refresh();
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>ขอ OT</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ขอ OT (Overtime)</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="date">วันที่</Label>
              <Input
                id="date"
                type="date"
                value={form.workDate}
                onChange={(e) => setForm({ ...form, workDate: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="start">เริ่ม</Label>
                <Input
                  id="start"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="end">สิ้นสุด</Label>
                <Input
                  id="end"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="dayType">ประเภทวัน (กำหนด multiplier)</Label>
              <Select
                value={form.dayType}
                onValueChange={(v) => setForm({ ...form, dayType: v ?? "WEEKDAY" })}
              >
                <SelectTrigger id="dayType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKDAY">วันธรรมดา (1.5x)</SelectItem>
                  <SelectItem value="WEEKEND">วันหยุดสัปดาห์ (3x)</SelectItem>
                  <SelectItem value="HOLIDAY">วันหยุดนักขัตฤกษ์ (3x)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rate">Hourly rate (บาท/ชม.) — optional</Label>
              <Input
                id="rate"
                type="number"
                min={0}
                step={1}
                value={form.hourlyRate}
                onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })}
                placeholder="เช่น 200"
              />
              <p className="text-xs text-muted-foreground mt-1">
                ปล่อยว่าง = ไม่คำนวณค่าตอบแทน (Phase 2 payroll จะ auto จาก salary)
              </p>
            </div>
            <div className="rounded-lg border border-border p-3 bg-muted/30 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ชั่วโมง:</span>
                <span className="font-medium">{hours} ชม.</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-muted-foreground">ค่าตอบแทนประมาณ:</span>
                <span className="font-medium">
                  {estimate > 0 ? `${estimate.toLocaleString("th-TH")} ฿` : "—"}
                </span>
              </div>
            </div>
            <div>
              <Label htmlFor="reason">เหตุผล</Label>
              <Input
                id="reason"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="เช่น ปิดงาน project / รับ order ด่วน"
                required
              />
            </div>
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
