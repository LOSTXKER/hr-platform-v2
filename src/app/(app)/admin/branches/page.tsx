import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
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
import { BranchDialog } from "./branch-dialog";

export const dynamic = "force-dynamic";

export default async function BranchesPage() {
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
  const branches = await prisma.branch.findMany({
    where: { organizationId: dbUser.organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { primaryEmployees: true } } },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">HR · Admin</p>
          <h1 className="text-2xl font-semibold">สาขา</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {branches.length} สาขา · GPS + geofence radius สำหรับ check-in
          </p>
        </div>
        {canWrite && <BranchDialog />}
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">รายการ</CardTitle>
        </CardHeader>
        <CardContent>
          {branches.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              ยังไม่มีสาขา {canWrite ? "— สร้างสาขาแรก" : ""}
            </p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>สาขา</TableHead>
                    <TableHead>GPS</TableHead>
                    <TableHead>Geofence</TableHead>
                    <TableHead>พนักงานหลัก</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {b.gpsLat && b.gpsLng
                          ? `${Number(b.gpsLat).toFixed(4)}, ${Number(b.gpsLng).toFixed(4)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{b.radiusMeters} เมตร</TableCell>
                      <TableCell className="text-sm">{b._count.primaryEmployees}</TableCell>
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
