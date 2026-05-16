export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black p-6">
      <div className="w-full max-w-sm">
        <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">HR Platform v2</p>
        {children}
      </div>
    </div>
  );
}
