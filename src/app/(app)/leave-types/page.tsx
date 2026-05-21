import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { listLeaveTypes } from "@/lib/leave-service";
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
import { LeaveTypeDialog } from "./leave-type-dialog";

export const dynamic = "force-dynamic";

export default async function LeaveTypesPage() {
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
  const types = await listLeaveTypes(dbUser.organizationId);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">HR</p>
          <h1 className="text-2xl font-semibold">ประเภทลา</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ลาป่วย / พักร้อน / กิจ / คลอด / บวช / ฌาปนกิจ ฯลฯ
          </p>
        </div>
        {canWrite && <LeaveTypeDialog />}
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {types.length === 0 ? "ยังไม่มีประเภทลา" : `${types.length} ประเภท`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {types.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              ยังไม่มีประเภทลา {canWrite ? "— สร้างประเภทแรก" : ""}
            </p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>รหัส</TableHead>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>สิทธิ (วัน)</TableHead>
                    <TableHead>หักโควต้า</TableHead>
                    <TableHead>แนบเอกสาร</TableHead>
                    <TableHead>Carryover</TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {types.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.code}</TableCell>
                      <TableCell className="font-medium">{t.nameTh}</TableCell>
                      <TableCell className="text-sm">
                        {t.defaultQuotaDays === 0 ? "ไม่จำกัด" : t.defaultQuotaDays}
                      </TableCell>
                      <TableCell className="text-sm">{t.deductsQuota ? "ใช่" : "ไม่"}</TableCell>
                      <TableCell className="text-sm">
                        {t.requiresAttachment
                          ? "ต้อง"
                          : t.attachmentThresholdDays !== null
                            ? `เมื่อ > ${t.attachmentThresholdDays} วัน`
                            : "ไม่ต้อง"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {t.carryoverMaxDays === 0 ? "—" : `${t.carryoverMaxDays} วัน`}
                      </TableCell>
                      <TableCell>
                        {t.isActive ? (
                          <Badge variant="default">ใช้งาน</Badge>
                        ) : (
                          <Badge variant="secondary">ปิด</Badge>
                        )}
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
