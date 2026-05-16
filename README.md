# HR Platform v2 (HR2)

Multi-tenant HR platform. Anajak dogfood year 1 → SaaS launch year 2.

> Master plan: `vault/decisions/2026-05-16-hr-platform-v2-master-plan.md` (in BestOS vault)
> Project tracker: `vault/projects/hr-platform-v2.md`

## Stack

- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui (planned)
- **DB**: Supabase Postgres
- **ORM**: Prisma 7
- **Auth**: Supabase Auth (`@supabase/ssr`)
- **Multi-tenancy**: Row Level Security (RLS) — every business table has `organization_id`
- **Mobile**: PWA (Phase 1)
- **AI**: Claude API (Phase 3)
- **Deploy**: Vercel + Supabase

## Setup

```bash
cp .env.example .env.local
# Fill DATABASE_URL + Supabase keys

npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

## Project Structure

```
prisma/
  schema.prisma          # Multi-tenant schema (Organization, User, Employee)
src/
  app/                   # Next.js App Router
  lib/
    prisma.ts            # Prisma client singleton
    supabase/
      server.ts          # Server-side Supabase (SSR)
      client.ts          # Browser-side Supabase
  generated/prisma/      # Generated Prisma client (gitignored)
```

## Multi-tenancy

Every business table:
1. has `organization_id` (uuid, FK to `organizations`)
2. has RLS policy `org_id = (auth.jwt()->>'organization_id')::uuid`
3. is indexed on `organization_id`

See `prisma/schema.prisma` for current models.

## Phase 0 — Foundation (2026-05-17 → 2026-05-31)

- [x] Next.js 16 + TypeScript + Tailwind v4 scaffold
- [x] Prisma 7 + Supabase SSR install
- [x] Multi-tenant schema skeleton (Organization, User, Employee)
- [ ] Supabase project creation + DATABASE_URL
- [ ] First migration applied
- [ ] RLS policies (organizations, users, employees)
- [ ] Auth flow (login/signup with org selection)
- [ ] Vercel deploy

Next phases → see master plan in vault.
