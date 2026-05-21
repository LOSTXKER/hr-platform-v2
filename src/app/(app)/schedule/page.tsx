import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { listEmployeeShifts, listShifts } from "@/lib/shift-service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AssignShiftDialog } from "./assign-shift-dialog";

export const dynamic = "force-dynamic";

const formatHM = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export default async function SchedulePage() {
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

  const canWrite = ["OWNER", "ADMIN", "HR", "MANAGER"].includes(dbUser.role);

  // Show next 14 days assignments
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const from = today.toISOString().slice(0, 10);
  const to = new Date(today.getTime() + 14 * 86400000).toISOString().slice(0, 10);

  const [assignments, shifts, employees] = await Promise.all([
    listEmployeeShifts(dbUser.organizationId, { from, to }),
    listShifts(dbUser.organizationId),
    prisma.employee.findMany({
      where: { organizationId: dbUser.organizationId },
      select: { id: true, firstNameTh: true, lastNameTh: true, employeeCode: true },
      orderBy: { employeeCode: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">HR</p>
          <h1 className="text-2xl font-semibold">ตารางเวร</h1>
          <p className="text-sm text-muted-foreground mt-1">
            14 วันข้างหน้า · {assignments.length} การมอบหมาย
          </p>
        </div>
        {canWrite && shifts.length > 0 && employees.length > 0 && (
          <AssignShiftDialog
            shifts={shifts.map((s) => ({
              id: s.id,
              name: s.name,
              startMinutes: s.startMinutes,
              endMinutes: s.endMinutes,
            }))}
            employees={employees}
          />
        )}
      </header>

      {(shifts.length === 0 || employees.length === 0) && canWrite && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              {shifts.length === 0 && employees.length === 0
                ? "ต้องสร้าง พนักงาน + กะ ก่อน assign เวร"
                : shifts.length === 0
                  ? 'ยังไม่มีกะ — สร้างที่หน้า "กะ"'
                  : "ยังไม่มีพนักงาน — สร้างพนักงานก่อน"}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">รายการมอบหมาย</CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              ยังไม่มีการมอบหมายกะ 14 วันข้างหน้า
            </p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>พนักงาน</TableHead>
                    <TableHead>กะ</TableHead>
                    <TableHead>เวลา</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {a.workDate.toLocaleDateString("th-TH", {
                          timeZone: "Asia/Bangkok",
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.employee.firstNameTh} {a.employee.lastNameTh}
                        <span className="text-xs text-muted-foreground ml-1">
                          ({a.employee.employeeCode})
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="outline">{a.shift.name}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatHM(a.shift.startMinutes)} – {formatHM(a.shift.endMinutes)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
