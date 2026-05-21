import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { listEmployees } from "@/lib/employee-service";
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
import { EmployeeDialog } from "./employee-dialog";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  APPLICANT: "ผู้สมัคร",
  PROBATION: "ทดลองงาน",
  PERMANENT: "ประจำ",
  RESIGNED: "ลาออก",
  TERMINATED: "เลิกจ้าง",
  ARCHIVED: "เก็บ",
};

const STATUS_VARIANT: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  APPLICANT: "outline",
  PROBATION: "outline",
  PERMANENT: "default",
  RESIGNED: "secondary",
  TERMINATED: "destructive",
  ARCHIVED: "secondary",
};

export default async function EmployeesPage() {
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

  const canWrite = ["OWNER", "ADMIN", "HR"].includes(dbUser.role);
  const [employees, positions, departments, branches] = await Promise.all([
    listEmployees(dbUser.organizationId),
    prisma.position.findMany({
      where: { organizationId: dbUser.organizationId },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.department.findMany({
      where: { organizationId: dbUser.organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.branch.findMany({
      where: { organizationId: dbUser.organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">HR</p>
          <h1 className="text-2xl font-semibold">พนักงาน</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {employees.length} คน · ครอบครัว/ฉุกเฉิน/เอกสาร: Phase 1.7
          </p>
        </div>
        {canWrite && (
          <EmployeeDialog positions={positions} departments={departments} branches={branches} />
        )}
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {employees.length === 0 ? "ยังไม่มีพนักงาน" : "รายชื่อ"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              ยังไม่มีพนักงาน {canWrite ? "— สร้างพนักงานแรก" : ""}
            </p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>รหัส</TableHead>
                    <TableHead>ชื่อ-สกุล</TableHead>
                    <TableHead>เบอร์โทร</TableHead>
                    <TableHead>เริ่มงาน</TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{e.employeeCode}</TableCell>
                      <TableCell className="font-medium">
                        {e.firstNameTh} {e.lastNameTh}
                        {e.firstNameEn && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({e.firstNameEn} {e.lastNameEn})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{e.phonePrimary}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {e.startDate.toLocaleDateString("th-TH", {
                          timeZone: "Asia/Bangkok",
                          day: "numeric",
                          month: "short",
                          year: "2-digit",
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[e.status] ?? "outline"}>
                          {STATUS_LABEL[e.status] ?? e.status}
                        </Badge>
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
