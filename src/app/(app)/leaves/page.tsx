import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  listLeaveRequests,
  listLeaveTypes,
  getAllBalancesForEmployee,
} from "@/lib/leave-service";
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
import { LeaveRequestDialog } from "./leave-request-dialog";
import { LeaveDecisionButtons } from "./leave-decision-buttons";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "รอ",
  APPROVED: "อนุมัติ",
  REJECTED: "ปฏิเสธ",
  CANCELLED: "ยกเลิก",
};

const STATUS_VARIANT: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
  PENDING: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
  CANCELLED: "secondary",
};

export default async function LeavesPage() {
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
    select: { id: true, firstNameTh: true, lastNameTh: true },
  });

  const filter = canApprove ? {} : self ? { employeeId: self.id } : { employeeId: "_none_" };

  const [requests, types, balances] = await Promise.all([
    listLeaveRequests(dbUser.organizationId, filter),
    listLeaveTypes(dbUser.organizationId),
    self ? getAllBalancesForEmployee(dbUser.organizationId, self.id) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">ลา</p>
          <h1 className="text-2xl font-semibold">การลา</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {canApprove ? "ทุกคนในองค์กร" : "ของคุณ"} · {requests.length} รายการ
          </p>
        </div>
        {self && types.length > 0 && <LeaveRequestDialog types={types.filter((t) => t.isActive)} />}
        {!self && (
          <p className="text-sm text-muted-foreground">
            ยังไม่มี profile พนักงาน — ติดต่อ HR
          </p>
        )}
      </header>

      {self && balances.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              วันลาคงเหลือ ({new Date().getFullYear()})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {balances.map(({ leaveType, balance }) => (
                <div
                  key={leaveType.id}
                  className="rounded-lg border border-border p-3"
                >
                  <p className="text-xs text-muted-foreground">{leaveType.nameTh}</p>
                  {leaveType.deductsQuota ? (
                    <>
                      <p className="text-2xl font-semibold mt-1">{balance.remaining}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        ใช้ {balance.used} / สิทธิ {balance.quota}
                        {balance.carryover > 0 && ` + ${balance.carryover}`}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2">ไม่หักโควต้า</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {requests.length === 0 ? "ยังไม่มีคำขอลา" : "คำขอ"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              ยังไม่มีรายการ {self && types.length > 0 ? "— กดขอลา" : ""}
            </p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    {canApprove && <TableHead>พนักงาน</TableHead>}
                    <TableHead>ประเภท</TableHead>
                    <TableHead>วัน</TableHead>
                    <TableHead>เหตุผล</TableHead>
                    <TableHead>สถานะ</TableHead>
                    {canApprove && <TableHead>การดำเนินการ</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {r.startDate.toLocaleDateString("th-TH", {
                          timeZone: "Asia/Bangkok",
                          day: "numeric",
                          month: "short",
                        })}
                        {Number(r.days) > 1 && (
                          <>
                            {" – "}
                            {r.endDate.toLocaleDateString("th-TH", {
                              timeZone: "Asia/Bangkok",
                              day: "numeric",
                              month: "short",
                            })}
                          </>
                        )}
                      </TableCell>
                      {canApprove && (
                        <TableCell className="text-sm">
                          {r.employee.firstNameTh} {r.employee.lastNameTh}
                          <span className="text-xs text-muted-foreground ml-1">
                            ({r.employee.employeeCode})
                          </span>
                        </TableCell>
                      )}
                      <TableCell className="text-sm">
                        <Badge variant="outline">{r.leaveType.nameTh}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{String(r.days)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {r.reason}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                      </TableCell>
                      {canApprove && (
                        <TableCell>
                          {r.status === "PENDING" ? (
                            <LeaveDecisionButtons leaveId={r.id} />
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
