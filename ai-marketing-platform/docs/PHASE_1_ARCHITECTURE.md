# Phase 1: System Foundation

The PRD at `/Users/jennylaw/Downloads/AI_Marketing_Platform_PRD.md` is the product source of truth. This document records the foundation implementation and acceptance evidence.

## Architecture

```text
Next.js App Router UI
  -> authenticated server/API routes
  -> role checks against workspace_members
  -> Supabase Auth session and Postgres client (publishable key + user JWT)
  -> PostgreSQL Row Level Security and tenant-scoped foreign keys
  -> triggers writing immutable audit events
```

No service-role key is used. Supabase is the real persistence adapter. User input is validated with Zod in route handlers; authorization is checked both in server code and database policies.

## Core schema

- `organizations` and `organization_members` define organization ownership and roles.
- `workspaces` and `workspace_members` define workspace access.
- `brands` and `products` store workspace brand context and product catalog.
- `audit_logs` records workspace/brand/product changes and cannot be updated or deleted by authenticated users.
- Foundation migration: `supabase/migrations/0001_phase1.sql`.
- Product audit trigger migration: `supabase/migrations/0002_phase1_product_audit.sql`.

## UI navigation

`/login` -> `/onboarding` -> protected `/app` workspace dashboard. The shell includes Overview, Brands & products, Market research, and Settings. Brand and product forms are workspace-scoped; Settings includes role and recent audit history.

## API contracts

- `GET/POST /api/workspaces`; `GET/PATCH /api/workspaces/:workspaceId`
- `GET/POST /api/brands`; `PATCH/DELETE /api/brands/:brandId`
- `GET/POST /api/products?workspaceId=...`; `PATCH/DELETE /api/products/:productId?workspaceId=...`
- `GET /api/audit-logs?workspaceId=...`

Responses use JSON. Errors return `{ code, message, details, requestId }`. Workspace IDs and brand-parent relationships are checked before writes.

## Acceptance evidence

- Live Supabase Auth session created and used by the local app.
- Live workspace and brand returned for the signed-in user.
- PGlite applies the SQL migrations and verifies cross-workspace reads are hidden, cross-workspace writes are denied, audit triggers fire, product changes are audited, and research records/citations are tenant-scoped.
- `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, and `pnpm build` pass locally.
- Hosted provider workflow and hosted RLS integration require a fresh hosted migration and provider keys; those are not implied by local SQL policy tests.

## Phase 2 boundary

The research architecture and API contract are in `docs/PHASE_2_ARCHITECTURE.md`. Market Research code is currently local-only until `0003_market_research.sql` is applied to hosted Supabase and both server-side search and LLM keys are configured. No later Phase 2 modules or Phase 3 work is enabled.
