import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { findShiftForDate } from "@/lib/shift-service";
import { getLatestForEmployee } from "@/lib/attendance-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckInPanel } from "./check-in-panel";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true, role: true },
  });
  if (!dbUser) redirect("/login");

  const employee = await prisma.employee.findFirst({
    where: { userId: user.id, organizationId: dbUser.organizationId },
    select: {
      id: true,
      employeeCode: true,
      firstNameTh: true,
      lastNameTh: true,
      primaryBranchId: true,
    },
  });

  if (!employee) {
    return (
      <div className="space-y-6">
        <header>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">เข้างาน</p>
          <h1 className="text-2xl font-semibold">ยังไม่มี profile พนักงาน</h1>
        </header>
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            ผู้ใช้นี้ยังไม่ได้ link กับ profile พนักงาน — ติดต่อ HR เพื่อสร้าง employee record และ link
            กับ user account
          </CardContent>
        </Card>
      </div>
    );
  }

  const todayUtc = new Date();
  const [shift, latest, branches] = await Promise.all([
    findShiftForDate(dbUser.organizationId, employee.id, todayUtc),
    getLatestForEmployee(dbUser.organizationId, employee.id),
    prisma.branch.findMany({
      where: { organizationId: dbUser.organizationId },
      select: { id: true, name: true, gpsLat: true, gpsLng: true, radiusMeters: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const formatHM = (mins: number) =>
    `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

  const branchOptions = branches.map((b) => ({
    id: b.id,
    name: b.name,
    gpsLat: b.gpsLat ? Number(b.gpsLat) : null,
    gpsLng: b.gpsLng ? Number(b.gpsLng) : null,
    radiusMeters: b.radiusMeters,
  }));

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">เข้างาน</p>
        <h1 className="text-2xl font-semibold">
          {employee.firstNameTh} {employee.lastNameTh}
        </h1>
        <p className="text-sm text-muted-foreground">รหัส {employee.employeeCode}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">กะวันนี้</CardTitle>
        </CardHeader>
        <CardContent>
          {shift ? (
            <div>
              <p className="text-lg font-semibold">{shift.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {formatHM(shift.startMinutes)} – {formatHM(shift.endMinutes)}
                {shift.graceMinutes > 0 && (
                  <span className="ml-2 text-xs">(เผื่อสาย {shift.graceMinutes} นาที)</span>
                )}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              ยังไม่มีกะถูก assign สำหรับวันนี้ — เข้างานได้ แต่ระบบจะไม่คำนวณสาย/ออกก่อน
            </p>
          )}
        </CardContent>
      </Card>

      <CheckInPanel
        employeeId={employee.id}
        primaryBranchId={employee.primaryBranchId}
        latest={
          latest
            ? {
                id: latest.id,
                type: latest.type,
                occurredAt: latest.occurredAt.toISOString(),
                status: latest.status,
              }
            : null
        }
        branches={branchOptions}
      />
    </div>
  );
}
