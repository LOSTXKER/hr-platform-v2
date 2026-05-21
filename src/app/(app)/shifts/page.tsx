import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { listShifts } from "@/lib/shift-service";
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
import { ShiftFormDialog } from "./shift-form-dialog";

export const dynamic = "force-dynamic";

const formatHM = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export default async function ShiftsPage() {
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
  const [shifts, branches] = await Promise.all([
    listShifts(dbUser.organizationId),
    prisma.branch.findMany({
      where: { organizationId: dbUser.organizationId },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">HR</p>
          <h1 className="text-2xl font-semibold">กะการทำงาน</h1>
          <p className="text-sm text-muted-foreground mt-1">
            กะเช้า / บ่าย / ดึก — กำหนดเวลา + grace period + break
          </p>
        </div>
        {canWrite && <ShiftFormDialog branches={branches} />}
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {shifts.length === 0 ? "ยังไม่มีกะ" : `${shifts.length} กะ`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {shifts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              ยังไม่มีกะการทำงาน {canWrite ? "— กดสร้างกะแรก" : ""}
            </p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อกะ</TableHead>
                    <TableHead>เวลา</TableHead>
                    <TableHead>พัก</TableHead>
                    <TableHead>เผื่อสาย</TableHead>
                    <TableHead>สาขา</TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.map((s) => {
                    const branch = branches.find((b) => b.id === s.branchId);
                    const crossesMidnight = s.endMinutes < s.startMinutes;
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-sm">
                          {formatHM(s.startMinutes)} – {formatHM(s.endMinutes)}
                          {crossesMidnight && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              ข้ามคืน
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.breakMinutes > 0 ? `${s.breakMinutes} นาที` : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.graceMinutes} นาที
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {branch?.name ?? "ทั่วองค์กร"}
                        </TableCell>
                        <TableCell>
                          {s.isActive ? (
                            <Badge variant="default">ใช้งาน</Badge>
                          ) : (
                            <Badge variant="secondary">ปิด</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
