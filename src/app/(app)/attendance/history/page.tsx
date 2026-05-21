import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { listAttendance } from "@/lib/attendance-service";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  CHECK_IN: "เข้างาน",
  CHECK_OUT: "ออกงาน",
  BREAK_START: "เริ่มพัก",
  BREAK_END: "เลิกพัก",
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

export default async function AttendanceHistoryPage() {
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

  const isPrivileged = ["OWNER", "ADMIN", "HR", "MANAGER"].includes(dbUser.role);

  // Members see only their own; HR sees all
  let filter: { employeeId?: string } = {};
  if (!isPrivileged) {
    const self = await prisma.employee.findFirst({
      where: { userId: user.id, organizationId: dbUser.organizationId },
      select: { id: true },
    });
    if (!self) {
      return (
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold">ประวัติการเข้างาน</h1>
          <p className="text-sm text-muted-foreground">ยังไม่มี profile พนักงาน</p>
        </div>
      );
    }
    filter = { employeeId: self.id };
  }

  const records = await listAttendance(dbUser.organizationId, filter);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">ประวัติ</p>
        <h1 className="text-2xl font-semibold">การเข้างาน</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isPrivileged ? "ทุกคนในองค์กร" : "ของคุณ"} · {records.length} รายการล่าสุด
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {records.length === 0 ? "ยังไม่มีการบันทึก" : "รายการ"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              ยังไม่มีรายการเข้างาน — กดเข้างานที่หน้า{" "}
              <a href="/attendance" className="underline">
                เข้างาน
              </a>
            </p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เวลา</TableHead>
                    {isPrivileged && <TableHead>พนักงาน</TableHead>}
                    <TableHead>ประเภท</TableHead>
                    <TableHead>วิธี</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>สาขา</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {r.occurredAt.toLocaleString("th-TH", {
                          timeZone: "Asia/Bangkok",
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </TableCell>
                      {isPrivileged && (
                        <TableCell className="text-sm">
                          {r.employee.firstNameTh} {r.employee.lastNameTh}
                          <span className="text-xs text-muted-foreground ml-1">
                            ({r.employee.employeeCode})
                          </span>
                        </TableCell>
                      )}
                      <TableCell className="text-sm">{TYPE_LABEL[r.type] ?? r.type}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.method}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.branch?.name ?? "—"}
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
