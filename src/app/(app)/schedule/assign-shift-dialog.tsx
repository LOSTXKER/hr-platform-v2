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

type Shift = { id: string; name: string; startMinutes: number; endMinutes: number };
type Employee = { id: string; firstNameTh: string; lastNameTh: string; employeeCode: string };

type Props = {
  shifts: Shift[];
  employees: Employee[];
};

const formatHM = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export function AssignShiftDialog({ shifts, employees }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    employeeId: employees[0]?.id ?? "",
    shiftId: shifts[0]?.id ?? "",
    workDate: today,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employeeId || !form.shiftId || !form.workDate) {
      toast.error("กรอกข้อมูลให้ครบ");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/employee-shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error ?? "มอบหมายไม่สำเร็จ");
        return;
      }
      toast.success("มอบหมายกะสำเร็จ");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>มอบหมายกะ</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
        <DialogHeader>
          <DialogTitle>มอบหมายกะให้พนักงาน</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="employee">พนักงาน</Label>
            <Select
              value={form.employeeId}
              onValueChange={(v) => setForm({ ...form, employeeId: v ?? "" })}
            >
              <SelectTrigger id="employee">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.firstNameTh} {e.lastNameTh} ({e.employeeCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="shift">กะ</Label>
            <Select value={form.shiftId} onValueChange={(v) => setForm({ ...form, shiftId: v ?? "" })}>
              <SelectTrigger id="shift">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {shifts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({formatHM(s.startMinutes)} – {formatHM(s.endMinutes)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="date">วันที่ทำงาน</Label>
            <Input
              id="date"
              type="date"
              value={form.workDate}
              onChange={(e) => setForm({ ...form, workDate: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              1 คน 1 กะ ต่อวัน — assign ซ้ำจะ error
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "กำลังบันทึก..." : "มอบหมาย"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
