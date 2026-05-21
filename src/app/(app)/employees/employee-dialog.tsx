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
import { Separator } from "@/components/ui/separator";

type RefRow = { id: string; title?: string; name?: string };

type Props = {
  positions: RefRow[];
  departments: RefRow[];
  branches: RefRow[];
};

const EMPTY = {
  employeeCode: "",
  firstNameTh: "",
  lastNameTh: "",
  firstNameEn: "",
  lastNameEn: "",
  nationalId: "",
  birthDate: "",
  gender: "NONE",
  phonePrimary: "",
  email: "",
  bankCode: "",
  bankAccountNumber: "",
  bankAccountName: "",
  positionId: "NONE",
  departmentId: "NONE",
  primaryBranchId: "NONE",
  startDate: new Date().toISOString().slice(0, 10),
  status: "PROBATION",
};

export function EmployeeDialog({ positions, departments, branches }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(EMPTY);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employeeCode.trim() || !form.firstNameTh.trim() || !form.lastNameTh.trim() || !form.phonePrimary.trim() || !form.startDate) {
      toast.error("กรอกฟิลด์บังคับ: รหัส / ชื่อ-สกุล / เบอร์ / วันเริ่ม");
      return;
    }
    startTransition(async () => {
      const payload: Record<string, unknown> = {
        employeeCode: form.employeeCode.trim(),
        firstNameTh: form.firstNameTh.trim(),
        lastNameTh: form.lastNameTh.trim(),
        firstNameEn: form.firstNameEn.trim() || null,
        lastNameEn: form.lastNameEn.trim() || null,
        nationalId: form.nationalId.trim() || null,
        birthDate: form.birthDate || null,
        gender: form.gender === "NONE" ? null : form.gender,
        phonePrimary: form.phonePrimary.trim(),
        email: form.email.trim() || null,
        bankCode: form.bankCode.trim() || null,
        bankAccountNumber: form.bankAccountNumber.trim() || null,
        bankAccountName: form.bankAccountName.trim() || null,
        positionId: form.positionId === "NONE" ? null : form.positionId,
        departmentId: form.departmentId === "NONE" ? null : form.departmentId,
        primaryBranchId: form.primaryBranchId === "NONE" ? null : form.primaryBranchId,
        startDate: form.startDate,
        status: form.status,
      };
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error ?? "สร้างพนักงานไม่สำเร็จ");
        return;
      }
      toast.success("สร้างพนักงานสำเร็จ");
      setOpen(false);
      setForm(EMPTY);
      router.refresh();
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>เพิ่มพนักงาน</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>เพิ่มพนักงานใหม่</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">ส่วนตัว</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="code">รหัสพนักงาน *</Label>
                <Input
                  id="code"
                  value={form.employeeCode}
                  onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
                  placeholder="EMP-001"
                  required
                />
              </div>
              <div>
                <Label htmlFor="status">สถานะ</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v ?? "PROBATION" })}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="APPLICANT">ผู้สมัคร</SelectItem>
                    <SelectItem value="PROBATION">ทดลองงาน</SelectItem>
                    <SelectItem value="PERMANENT">ประจำ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fnTh">ชื่อ (ไทย) *</Label>
                <Input id="fnTh" value={form.firstNameTh} onChange={(e) => setForm({ ...form, firstNameTh: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="lnTh">นามสกุล (ไทย) *</Label>
                <Input id="lnTh" value={form.lastNameTh} onChange={(e) => setForm({ ...form, lastNameTh: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fnEn">First name (EN)</Label>
                <Input id="fnEn" value={form.firstNameEn} onChange={(e) => setForm({ ...form, firstNameEn: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="lnEn">Last name (EN)</Label>
                <Input id="lnEn" value={form.lastNameEn} onChange={(e) => setForm({ ...form, lastNameEn: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pid">เลขบัตร ปชช. 13 หลัก</Label>
                <Input id="pid" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} placeholder="1100200300400" />
              </div>
              <div>
                <Label htmlFor="bd">วันเกิด</Label>
                <Input id="bd" type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="gender">เพศ</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v ?? "NONE" })}>
                  <SelectTrigger id="gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">—</SelectItem>
                    <SelectItem value="MALE">ชาย</SelectItem>
                    <SelectItem value="FEMALE">หญิง</SelectItem>
                    <SelectItem value="OTHER">อื่นๆ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="start">วันเริ่มงาน *</Label>
                <Input id="start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
              </div>
            </div>

            <Separator />
            <p className="text-xs uppercase tracking-widest text-muted-foreground">ติดต่อ</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="phone">เบอร์โทร *</Label>
                <Input id="phone" value={form.phonePrimary} onChange={(e) => setForm({ ...form, phonePrimary: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="email">อีเมล</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>

            <Separator />
            <p className="text-xs uppercase tracking-widest text-muted-foreground">องค์กร</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="pos">ตำแหน่ง</Label>
                <Select value={form.positionId} onValueChange={(v) => setForm({ ...form, positionId: v ?? "NONE" })}>
                  <SelectTrigger id="pos">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">—</SelectItem>
                    {positions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dept">แผนก</Label>
                <Select value={form.departmentId} onValueChange={(v) => setForm({ ...form, departmentId: v ?? "NONE" })}>
                  <SelectTrigger id="dept">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">—</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="br">สาขาหลัก</Label>
                <Select value={form.primaryBranchId} onValueChange={(v) => setForm({ ...form, primaryBranchId: v ?? "NONE" })}>
                  <SelectTrigger id="br">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">—</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />
            <p className="text-xs uppercase tracking-widest text-muted-foreground">บัญชี (เข้ารหัส)</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="bc">ธนาคาร</Label>
                <Input id="bc" value={form.bankCode} onChange={(e) => setForm({ ...form, bankCode: e.target.value })} placeholder="SCB" />
              </div>
              <div className="col-span-2">
                <Label htmlFor="ban">เลขบัญชี</Label>
                <Input id="ban" value={form.bankAccountNumber} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} />
              </div>
              <div className="col-span-3">
                <Label htmlFor="bname">ชื่อบัญชี</Label>
                <Input id="bname" value={form.bankAccountName} onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })} />
              </div>
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
