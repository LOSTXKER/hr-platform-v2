import Link from "next/link";
import { signup } from "../actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  async function action(formData: FormData) {
    "use server";
    const result = await signup(formData);
    if (result?.error) {
      const { redirect } = await import("next/navigation");
      redirect(`/signup?error=${encodeURIComponent(result.error)}`);
    }
  }

  return (
    <form action={action} className="space-y-4">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">สมัครใช้งาน</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        สร้างบัญชี + องค์กรของคุณ — คุณจะเป็น Owner อัตโนมัติ
      </p>

      {sp.error && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
          {sp.error}
        </div>
      )}

      <label className="block">
        <span className="text-sm text-zinc-700 dark:text-zinc-300">ชื่อองค์กร</span>
        <input
          name="organization_name"
          type="text"
          required
          placeholder="เช่น Anajak"
          className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="text-sm text-zinc-700 dark:text-zinc-300">Slug (ตัวพิมพ์เล็ก + -)</span>
        <input
          name="organization_slug"
          type="text"
          required
          pattern="[-a-z0-9]+"
          placeholder="anajak"
          className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="text-sm text-zinc-700 dark:text-zinc-300">อีเมล</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="text-sm text-zinc-700 dark:text-zinc-300">รหัสผ่าน (8+ ตัว)</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
        />
      </label>

      <button
        type="submit"
        className="w-full rounded-md bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 py-2 text-sm font-medium hover:opacity-90"
      >
        สมัครใช้งาน
      </button>

      <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center">
        มีบัญชีอยู่แล้ว?{" "}
        <Link href="/login" className="text-zinc-900 dark:text-zinc-50 underline">
          เข้าสู่ระบบ
        </Link>
      </p>
    </form>
  );
}
