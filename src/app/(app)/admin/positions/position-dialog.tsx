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

const EMPTY = { title: "", level: "1", salaryBandMin: "", salaryBandMax: "", jobDescription: "" };

export function PositionDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(EMPTY);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("กรอกชื่อตำแหน่ง");
      return;
    }
    startTransition(async () => {
      const min = form.salaryBandMin ? parseFloat(form.salaryBandMin) : null;
      const max = form.salaryBandMax ? parseFloat(form.salaryBandMax) : null;
      if (min !== null && max !== null && min > max) {
        toast.error("salary min > max");
        return;
      }
      const res = await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          level: parseInt(form.level, 10) || 1,
          salaryBandMin: min,
          salaryBandMax: max,
          jobDescription: form.jobDescription.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error ?? "สร้างไม่สำเร็จ");
        return;
      }
      toast.success("สร้างตำแหน่งสำเร็จ");
      setOpen(false);
      setForm(EMPTY);
      router.refresh();
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>สร้างตำแหน่ง</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ตำแหน่งใหม่</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="t">ชื่อตำแหน่ง</Label>
              <Input id="t" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="DTF Operator / Sales / Manager" required />
            </div>
            <div>
              <Label htmlFor="l">Level</Label>
              <Input id="l" type="number" min={1} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="min">Salary min (฿)</Label>
                <Input id="min" type="number" min={0} step={1000} value={form.salaryBandMin} onChange={(e) => setForm({ ...form, salaryBandMin: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="max">Salary max (฿)</Label>
                <Input id="max" type="number" min={0} step={1000} value={form.salaryBandMax} onChange={(e) => setForm({ ...form, salaryBandMax: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="jd">Job description</Label>
              <Input id="jd" value={form.jobDescription} onChange={(e) => setForm({ ...form, jobDescription: e.target.value })} placeholder="หน้าที่หลัก..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={pending}>{pending ? "บันทึก..." : "สร้าง"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
