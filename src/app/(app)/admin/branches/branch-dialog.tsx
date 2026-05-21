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

const EMPTY = { name: "", gpsLat: "", gpsLng: "", radiusMeters: "100" };

export function BranchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(EMPTY);
  const [locating, setLocating] = useState(false);

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("Browser ไม่รองรับ GPS");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          gpsLat: pos.coords.latitude.toFixed(6),
          gpsLng: pos.coords.longitude.toFixed(6),
        }));
        setLocating(false);
        toast.success("ใส่ตำแหน่งปัจจุบันแล้ว");
      },
      () => {
        setLocating(false);
        toast.error("ดึง GPS ไม่ได้");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("กรอกชื่อสาขา");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          gpsLat: form.gpsLat ? parseFloat(form.gpsLat) : null,
          gpsLng: form.gpsLng ? parseFloat(form.gpsLng) : null,
          radiusMeters: parseInt(form.radiusMeters, 10) || 100,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error ?? "สร้างไม่สำเร็จ");
        return;
      }
      toast.success("สร้างสาขาสำเร็จ");
      setOpen(false);
      setForm(EMPTY);
      router.refresh();
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>สร้างสาขา</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>สาขาใหม่</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="n">ชื่อสาขา</Label>
              <Input id="n" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="สาขาหลัก / สาขา 2" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="lat">Latitude</Label>
                <Input id="lat" type="number" step="0.000001" value={form.gpsLat} onChange={(e) => setForm({ ...form, gpsLat: e.target.value })} placeholder="13.756331" />
              </div>
              <div>
                <Label htmlFor="lng">Longitude</Label>
                <Input id="lng" type="number" step="0.000001" value={form.gpsLng} onChange={(e) => setForm({ ...form, gpsLng: e.target.value })} placeholder="100.501762" />
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locating} className="w-full">
              {locating ? "กำลังดึง GPS..." : "📍 ใช้ตำแหน่งปัจจุบัน"}
            </Button>
            <div>
              <Label htmlFor="r">รัศมี Geofence (เมตร)</Label>
              <Input id="r" type="number" min={50} max={1000} value={form.radiusMeters} onChange={(e) => setForm({ ...form, radiusMeters: e.target.value })} />
              <p className="text-xs text-muted-foreground mt-1">
                check-in นอกรัศมี = OUT_OF_GEOFENCE (default 100 ม.)
              </p>
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
