"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Branch = {
  id: string;
  name: string;
  gpsLat: number | null;
  gpsLng: number | null;
  radiusMeters: number;
};

type Latest = {
  id: string;
  type: "CHECK_IN" | "CHECK_OUT" | "BREAK_START" | "BREAK_END";
  occurredAt: string;
  status: string;
};

type Props = {
  employeeId: string;
  primaryBranchId: string | null;
  latest: Latest | null;
  branches: Branch[];
};

const STATUS_LABEL: Record<string, string> = {
  ON_TIME: "ตรงเวลา",
  LATE: "สาย",
  EARLY: "ออกก่อน",
  MISSING: "ลืม check-out",
  OUT_OF_GEOFENCE: "นอกพื้นที่",
};

const STATUS_VARIANT: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  ON_TIME: "default",
  LATE: "destructive",
  EARLY: "destructive",
  MISSING: "destructive",
  OUT_OF_GEOFENCE: "destructive",
};

export function CheckInPanel({ primaryBranchId, latest, branches }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    primaryBranchId ?? branches[0]?.id ?? ""
  );

  // Determine next action: if last event was CHECK_IN, next is CHECK_OUT (and vice versa)
  const nextType: "CHECK_IN" | "CHECK_OUT" = latest?.type === "CHECK_IN" ? "CHECK_OUT" : "CHECK_IN";
  const nextLabel = nextType === "CHECK_IN" ? "เข้างาน" : "ออกงาน";

  async function getGps(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
    if (!("geolocation" in navigator)) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
          }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  }

  function handleSubmit() {
    startTransition(async () => {
      const loadingId = toast.loading(nextType === "CHECK_IN" ? "กำลังเช็คอิน..." : "กำลังเช็คเอาท์...");
      try {
        const gps = await getGps();
        const body: Record<string, unknown> = {
          type: nextType,
          method: "GPS",
        };
        if (selectedBranchId) body.branchId = selectedBranchId;
        if (gps) {
          body.gpsLat = gps.lat;
          body.gpsLng = gps.lng;
          body.gpsAccuracyM = gps.accuracy;
        }

        const res = await fetch("/api/attendances", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        toast.dismiss(loadingId);
        if (!res.ok) {
          toast.error(json?.error ?? "บันทึกไม่สำเร็จ");
          return;
        }
        const status = json.data?.status as string | undefined;
        const isOk = status === "ON_TIME";
        if (isOk) {
          toast.success(`บันทึก${nextLabel}สำเร็จ`);
        } else {
          toast.warning(`บันทึกแล้ว — สถานะ: ${STATUS_LABEL[status ?? ""] ?? status}`);
        }
        router.refresh();
      } catch (e) {
        toast.dismiss(loadingId);
        toast.error(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">บันทึกเวลา</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {branches.length > 0 ? (
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">สาขา</label>
            <Select value={selectedBranchId} onValueChange={(v) => setSelectedBranchId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="เลือกสาขา" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            ยังไม่มีสาขา — HR ต้องสร้างสาขาก่อนเพื่อใช้ geofence
          </p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={pending}
          size="lg"
          className="w-full h-16 text-lg"
          variant={nextType === "CHECK_IN" ? "default" : "secondary"}
        >
          {pending ? "กำลังบันทึก..." : nextLabel}
        </Button>

        {latest && (
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground mb-1">บันทึกล่าสุด</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {latest.type === "CHECK_IN" ? "เข้างาน" : latest.type === "CHECK_OUT" ? "ออกงาน" : latest.type}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(latest.occurredAt).toLocaleString("th-TH", {
                    timeZone: "Asia/Bangkok",
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[latest.status] ?? "outline"}>
                {STATUS_LABEL[latest.status] ?? latest.status}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
