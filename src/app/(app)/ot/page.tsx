import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { listOtRequests, getWeeklyOtHours, OT_WEEKLY_CAP_HOURS } from "@/lib/ot-service";
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
import { OtRequestDialog } from "./ot-request-dialog";
import { OtDecisionButtons } from "./ot-decision-buttons";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "รอ",
  APPROVED: "อนุมัติ",
  REJECTED: "ปฏิเสธ",
  CANCELLED: "ยกเลิก",
};

const STATUS_VARIANT: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  REQUESTED: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
  CANCELLED: "secondary",
};

const DAY_TYPE_LABEL: Record<string, string> = {
  WEEKDAY: "ธรรมดา (1.5x)",
  WEEKEND: "วันหยุดสัปดาห์ (3x)",
  HOLIDAY: "นักขัตฤกษ์ (3x)",
};

const formatHM = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export default async function OtPage() {
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

  const canApprove = ["OWNER", "ADMIN", "HR", "MANAGER"].includes(dbUser.role);
  const self = await prisma.employee.findFirst({
    where: { userId: user.id, organizationId: dbUser.organizationId },
    select: { id: true },
  });

  const filter = canApprove ? {} : self ? { employeeId: self.id } : { employeeId: "_none_" };

  const [requests, weekHours] = await Promise.all([
    listOtRequests(dbUser.organizationId, filter),
    self ? getWeeklyOtHours(dbUser.organizationId, self.id, new Date()) : Promise.resolve(0),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">OT</p>
          <h1 className="text-2xl font-semibold">ล่วงเวลา</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ขอ OT ล่วงหน้า — กฎหมายไทยจำกัด {OT_WEEKLY_CAP_HOURS} ชม./สัปดาห์
          </p>
        </div>
        {self && <OtRequestDialog />}
      </header>

      {self && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              OT สัปดาห์นี้
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-semibold">{weekHours.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">
                / {OT_WEEKLY_CAP_HOURS} ชม. (เหลือ {Math.max(0, OT_WEEKLY_CAP_HOURS - weekHours).toFixed(1)} ชม.)
              </span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full ${weekHours >= OT_WEEKLY_CAP_HOURS ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${Math.min(100, (weekHours / OT_WEEKLY_CAP_HOURS) * 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {requests.length === 0 ? "ยังไม่มีคำขอ" : `${requests.length} คำขอ`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              ยังไม่มีคำขอ OT {self ? "— กดขอ OT" : ""}
            </p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    {canApprove && <TableHead>พนักงาน</TableHead>}
                    <TableHead>เวลา</TableHead>
                    <TableHead>ชม.</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead>ค่าตอบแทน</TableHead>
                    <TableHead>สถานะ</TableHead>
                    {canApprove && <TableHead>การดำเนินการ</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {r.workDate.toLocaleDateString("th-TH", {
                          timeZone: "Asia/Bangkok",
                          day: "numeric",
                          month: "short",
                        })}
                      </TableCell>
                      {canApprove && (
                        <TableCell className="text-sm">
                          {r.employee.firstNameTh} {r.employee.lastNameTh}
                        </TableCell>
                      )}
                      <TableCell className="text-sm">
                        {formatHM(r.startMinutes)} – {formatHM(r.endMinutes)}
                      </TableCell>
                      <TableCell className="text-sm">{String(r.hours)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {DAY_TYPE_LABEL[r.dayType]}
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.estimatedPay ? `${Number(r.estimatedPay).toLocaleString("th-TH")} ฿` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                      </TableCell>
                      {canApprove && (
                        <TableCell>
                          {r.status === "REQUESTED" ? (
                            <OtDecisionButtons otId={r.id} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
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
