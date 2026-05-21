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

type Props = { departments: { id: string; name: string }[] };

export function DepartmentDialog({ departments }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", parentId: "NONE" });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("กรอกชื่อแผนก");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          parentId: form.parentId === "NONE" ? null : form.parentId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error ?? "สร้างไม่สำเร็จ");
        return;
      }
      toast.success("สร้างแผนกสำเร็จ");
      setOpen(false);
      setForm({ name: "", parentId: "NONE" });
      router.refresh();
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>สร้างแผนก</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แผนกใหม่</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="n">ชื่อแผนก</Label>
              <Input id="n" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ขายปลีก / ผลิต DTF / สโตร์" required />
            </div>
            <div>
              <Label htmlFor="parent">แผนกแม่ (optional)</Label>
              <Select value={form.parentId} onValueChange={(v) => setForm({ ...form, parentId: v ?? "NONE" })}>
                <SelectTrigger id="parent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">— (ระดับบนสุด)</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>ยกเลิก</Button>
              <Button type="submit" disabled={pending}>{pending ? "บันทึก..." : "สร้าง"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
