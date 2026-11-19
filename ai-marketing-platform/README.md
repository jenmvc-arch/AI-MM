# AI Marketing Intelligence Platform

Next.js, TypeScript, Tailwind, shadcn/ui, and Supabase application. The product requirements source is `/Users/jennylaw/Downloads/AI_Marketing_Platform_PRD.md`.

## Local development

```bash
pnpm install
pnpm dev
```

The app runs at `http://localhost:3000`. Supabase public project configuration belongs in `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-key>
```

For live Market Research, add server-side provider keys to `.env.local` and the deployment secret manager:

```dotenv
OPENAI_API_KEY=<server-only OpenAI API key>
OPENAI_RESEARCH_MODEL=gpt-4.1-mini
TAVILY_API_KEY=<server-only Tavily API key>
```

Never prefix provider keys with `NEXT_PUBLIC_`. The app uses Supabase's publishable key with the authenticated user session and RLS; no service-role key is used.

## Database migrations

Apply migrations in order using the Supabase SQL Editor or the Supabase CLI:

1. `supabase/migrations/0001_phase1.sql`
2. `supabase/migrations/0002_phase1_product_audit.sql`
3. `supabase/migrations/0003_market_research.sql`
4. `supabase/migrations/0004_phase2_intelligence.sql`

The product audit migration adds trigger-backed product history. The Phase 2 research migration adds tenant-scoped project, job, source, finding, and citation-link tables with role-based RLS. Apply it before opening Market Research. Do not rerun a migration that already succeeded.

## Checks

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

The Vitest suite uses PGlite to apply the SQL migrations and verify workspace isolation, audit hooks, citation foreign keys, and research schema validation. It does not replace a signed-in integration run against hosted Supabase.

## Phase 2 provider and monitoring configuration

The Competitor Directory uses Tavily Search and OpenAI Responses to analyze only returned public excerpts. It does not crawl pages directly or infer performance. Copy analysis and strategy generation use the configured OpenAI server key.

Scheduled monitoring uses the hourly Vercel cron in `vercel.json` to call `/api/internal/monitor-due`. Configure `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` only in the server deployment environment. The cron handler checks `Authorization: Bearer <CRON_SECRET>` and the service-role credential is never sent to a browser. Local dev does not run the schedule automatically; users can still create and manage saved refresh schedules.

After applying migration 0004 to hosted Supabase, deploy the app with server-side `OPENAI_API_KEY`, `TAVILY_API_KEY`, `CRON_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY` configured. Do not prefix these variables with `NEXT_PUBLIC_`.

## Current scope

Phase 1 implements auth, organizations/workspaces, role checks, brand profile CRUD, dashboard, and database audit logging. Module 1 of Phase 2 implements market-research projects, persisted jobs, authorized search, structured LLM analysis, source evidence, and findings. Competitor intelligence, copy analysis, strategy generation, and scheduled monitoring remain unimplemented. Market research requires both provider keys and the hosted migration; without them the job reports a configuration failure and stores no fabricated findings.
