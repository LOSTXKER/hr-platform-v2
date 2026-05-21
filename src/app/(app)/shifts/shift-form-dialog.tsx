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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  branches: { id: string; name: string }[];
};

function parseHM(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = parseInt(m[1]!, 10);
  const min = parseInt(m[2]!, 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

export function ShiftFormDialog({ branches }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    startTime: "08:00",
    endTime: "17:00",
    breakMinutes: "60",
    graceMinutes: "5",
    branchId: "ALL",
  });

  function reset() {
    setForm({ name: "", startTime: "08:00", endTime: "17:00", breakMinutes: "60", graceMinutes: "5", branchId: "ALL" });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const startMinutes = parseHM(form.startTime);
    const endMinutes = parseHM(form.endTime);
    if (!form.name.trim()) {
      toast.error("กรอกชื่อกะ");
      return;
    }
    if (startMinutes === null) {
      toast.error("เวลาเริ่มไม่ถูกต้อง (HH:MM)");
      return;
    }
    if (endMinutes === null) {
      toast.error("เวลาสิ้นสุดไม่ถูกต้อง (HH:MM)");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          startMinutes,
          endMinutes,
          breakMinutes: parseInt(form.breakMinutes, 10) || 0,
          graceMinutes: parseInt(form.graceMinutes, 10) || 0,
          branchId: form.branchId === "ALL" ? null : form.branchId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error ?? "สร้างกะไม่สำเร็จ");
        return;
      }
      toast.success("สร้างกะสำเร็จ");
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>สร้างกะใหม่</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
        <DialogHeader>
          <DialogTitle>สร้างกะการทำงาน</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">ชื่อกะ</Label>
            <Input
              id="name"
              placeholder="กะเช้า / กะบ่าย / กะดึก"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="break">พัก (นาที)</Label>
              <Input
                id="break"
                type="number"
                min={0}
                value={form.breakMinutes}
                onChange={(e) => setForm({ ...form, breakMinutes: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="grace">เผื่อสาย (นาที)</Label>
              <Input
                id="grace"
                type="number"
                min={0}
                value={form.graceMinutes}
                onChange={(e) => setForm({ ...form, graceMinutes: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="branch">สาขา</Label>
            <Select value={form.branchId} onValueChange={(v) => setForm({ ...form, branchId: v ?? "ALL" })}>
              <SelectTrigger id="branch">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ทั่วองค์กร</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              เลือก &ldquo;ทั่วองค์กร&rdquo; ถ้ากะใช้ได้ทุกสาขา
            </p>
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
