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
import { DepartmentDialog } from "./department-dialog";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
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
  const departments = await prisma.department.findMany({
    where: { organizationId: dbUser.organizationId },
    orderBy: { name: "asc" },
    include: {
      parent: { select: { name: true } },
      _count: { select: { employees: true, children: true } },
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">HR · Admin</p>
          <h1 className="text-2xl font-semibold">แผนก</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {departments.length} แผนก · tree visualize: Phase 1.7
          </p>
        </div>
        {canWrite && <DepartmentDialog departments={departments.map((d) => ({ id: d.id, name: d.name }))} />}
      </header>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">รายการ</CardTitle>
        </CardHeader>
        <CardContent>
          {departments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              ยังไม่มีแผนก {canWrite ? "— สร้างแผนกแรก" : ""}
            </p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>แผนก</TableHead>
                    <TableHead>แผนกแม่</TableHead>
                    <TableHead>แผนกย่อย</TableHead>
                    <TableHead>พนักงาน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {d.parent?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm">{d._count.children}</TableCell>
                      <TableCell className="text-sm">{d._count.employees}</TableCell>
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
