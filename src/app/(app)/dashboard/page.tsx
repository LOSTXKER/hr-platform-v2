import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // user is non-null (AppLayout already redirects if missing)
  const dbUser = await prisma.user.findUnique({
    where: { id: user!.id },
    include: { organization: true },
  });

  const employeeCount = dbUser
    ? await prisma.employee.count({ where: { organizationId: dbUser.organizationId } })
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Dashboard</p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          {dbUser?.organization?.name ?? "องค์กรของคุณ"}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          {dbUser?.organization?.slug} · Phase 0 Foundation
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="พนักงาน" value={String(employeeCount)} />
        <Stat label="บทบาทของคุณ" value={dbUser?.role ?? "—"} />
        <Stat label="แพลน" value={dbUser?.organization?.plan ?? "free"} />
      </div>

      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6">
        <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-1">Phase 0 — Foundation</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          ระบบ Auth + Multi-tenant base พร้อมแล้ว — Phase 1 (Employee + Attendance + Leave) เริ่มเมื่อ Discovery interview เสร็จ
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-5 py-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mt-1">{value}</p>
    </div>
  );
}
