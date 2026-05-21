import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../(auth)/actions";
import { Toaster } from "@/components/ui/sonner";

const NAV = [
  { href: "/dashboard", label: "หน้าหลัก" },
  { href: "/attendance", label: "เข้างาน" },
  { href: "/attendance/history", label: "ประวัติ" },
  { href: "/shifts", label: "กะ" },
  { href: "/schedule", label: "ตารางเวร" },
  { href: "/leaves", label: "ลา" },
  { href: "/leave-types", label: "ตั้งค่าลา" },
  { href: "/ot", label: "OT" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-6">
          <Link href="/dashboard" className="text-sm font-semibold text-foreground whitespace-nowrap">
            HR Platform v2
          </Link>
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-accent transition-colors"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground hidden sm:inline">{user.email}</span>
            <form action={logout}>
              <button type="submit" className="text-muted-foreground hover:text-foreground">
                ออก
              </button>
            </form>
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="md:hidden flex items-center gap-1 max-w-6xl mx-auto px-4 pb-2 overflow-x-auto">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-xs text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-md hover:bg-accent whitespace-nowrap"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
      <Toaster position="top-center" richColors />
    </div>
  );
}
