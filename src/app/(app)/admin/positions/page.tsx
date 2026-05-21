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
import { PositionDialog } from "./position-dialog";

export const dynamic = "force-dynamic";

export default async function PositionsPage() {
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
  const positions = await prisma.position.findMany({
    where: { organizationId: dbUser.organizationId },
    orderBy: [{ level: "desc" }, { title: "asc" }],
    include: { _count: { select: { employees: true } } },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">HR · Admin</p>
          <h1 className="text-2xl font-semibold">ตำแหน่งงาน</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {positions.length} ตำแหน่ง · Level + salary band + JD
          </p>
        </div>
        {canWrite && <PositionDialog />}
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">รายการ</CardTitle>
        </CardHeader>
        <CardContent>
          {positions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              ยังไม่มีตำแหน่ง {canWrite ? "— สร้างตำแหน่งแรก" : ""}
            </p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ตำแหน่ง</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Salary band</TableHead>
                    <TableHead>JD</TableHead>
                    <TableHead>พนักงาน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.title}</TableCell>
                      <TableCell className="text-sm">L{p.level}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.salaryBandMin && p.salaryBandMax
                          ? `${Number(p.salaryBandMin).toLocaleString("th-TH")} – ${Number(p.salaryBandMax).toLocaleString("th-TH")} ฿`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {p.jobDescription ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">{p._count.employees}</TableCell>
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
