export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black p-8">
      <div className="max-w-2xl">
        <p className="text-xs uppercase tracking-widest text-zinc-500 mb-4">HR Platform v2</p>
        <h1 className="text-4xl font-semibold text-zinc-900 dark:text-zinc-50 mb-4">
          Phase 0 — Foundation
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Multi-tenant HR platform. Anajak dogfood year 1, SaaS year 2.
        </p>
        <p className="text-zinc-500 text-sm mt-8">
          Stack: Next.js 16 · React 19 · Prisma · Supabase · Tailwind v4
        </p>
      </div>
    </main>
  );
}
