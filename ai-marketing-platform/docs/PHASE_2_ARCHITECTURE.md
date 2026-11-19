# Phase 2: Market Research and Competitor Intelligence

This document records the architecture, relational model, route contracts, navigation, and acceptance sequence for Phase 2. The PRD remains the product source of truth. Implementation proceeds one module at a time; only Module 1 is active initially.

## System architecture

```text
Next.js App Router
  -> authenticated Route Handlers (Zod request/response contracts)
  -> workspace role authorization (server check + PostgreSQL RLS)
  -> Supabase Postgres (projects, jobs, sources, findings, audit events)
  -> explicit research orchestration service
      -> search adapter (Tavily Search API, server-only key)
      -> LLM adapter (OpenAI Responses API, server-only key)
      -> normalized source/evidence bundle
      -> Zod-validated findings with source references
```

External content is untrusted input. Search results are bounded, normalized, and passed to the model as data. A factual finding is persisted as `verified` only if it cites one or more retrieved source records; uncited interpretation is stored as `hypothesis`. No source is treated as an instruction. Missing provider configuration or provider failure creates a failed job and actionable error; it never creates synthetic findings.

The first release executes a bounded research job in the authenticated request and persists each state transition. A queue/worker can replace this runner later without changing stored job contracts. Each job has an idempotency key, attempt count, bounded provider calls, and terminal error state. Provider keys are server environment secrets, never database rows or browser variables.

## Phase 2 relational model

All tenant tables carry `organization_id` and `workspace_id` directly or through a composite tenant-scoped parent foreign key. RLS permits only active workspace members to read; role policies restrict writes. Tenant-owned foreign keys use `(id, organization_id, workspace_id)` where applicable. Audit rows are trigger-generated and immutable to authenticated clients.

| Table | Purpose / core fields |
|---|---|
| `research_projects` | Brief inputs: brand, industry, product, geography, target customers, objectives; latest status and summary |
| `research_jobs` | Idempotent execution: project, status, attempts, progress, provider/model IDs, safe error code, started/finished times |
| `research_sources` | URL, title, retrieval time, provider, excerpt/evidence, content hash, source metadata |
| `market_findings` | Category, claim, classification (`verified`, `inferred`, `hypothesis`), confidence, evidence, source references |
| `competitors` | Brand-scoped name, website, social profiles, positioning, offers |
| `competitor_snapshots` | Timestamped source observations and analysis for a competitor |
| `competitor_content` | Publicly accessible or user-supplied content with URL, content type, retrieval timestamp, source reference |
| `copy_analyses` | User-supplied copy, framework labels, audience/tone analysis, differentiated suggestions |
| `marketing_strategies` | Versioned editable strategy JSON and source project references |
| `monitoring_schedules` | Authorized refresh configuration, interval, enabled flag, last/next run |

Research sources and findings are append-only per job. Failed retries preserve previous attempts and do not erase completed results. Delete cascades remain scoped to the owning workspace. Provider credentials are not stored in these tables.

## UI navigation

The protected workspace shell adds `Market Intelligence` with a dashboard, project creation form, saved project list, project detail view, source/evidence panel, findings by category, and job progress/error states. The Phase 2 destinations are staged in this order:

1. Market Research: project dashboard and detail.
2. Competitor Intelligence: directory, snapshots, and comparison.
3. Copy Analysis Studio.
4. Strategy Generator.
5. Research History and monitoring.

Unimplemented destinations are not rendered as working controls. Navigation only exposes the module currently implemented.

## API contracts

All endpoints require Supabase Auth. Requests are validated server-side and authorized against the workspace and role. Errors use `{ code, message, details, requestId }`.

| Endpoint | Contract |
|---|---|
| `GET /api/research?workspaceId=` | Returns projects and latest job status, scoped to accessible workspace |
| `POST /api/research` | Creates a research project and starts one idempotent job; `{ workspaceId, brandId?, industry, product, geography, targetCustomers, objectives, idempotencyKey }` |
| `GET /api/research/:projectId` | Returns brief, jobs, categories, findings, and cited sources |
| `POST /api/research/:projectId/run` | Retries a failed job or runs the existing queued job idempotently |

Creation returns `202 { data: { projectId, jobId, status } }`; callers poll the project endpoint. Providers are explicit adapters with timeouts and structured outputs validated before persistence.

## Implementation checklist

### Module 1: AI Market Research

- [ ] Add migration, indexes, role-aware RLS, and immutable audit hooks.
- [ ] Add provider environment validation and server-only Tavily/OpenAI adapters.
- [ ] Add normalized search results, validated research schema, citation integrity checks, and bounded retry behavior.
- [ ] Add authenticated project create/list/detail/run routes with idempotency.
- [ ] Add research dashboard, creation form, progress/error states, findings, sources, dates, and evidence.
- [ ] Test schema validation, source requirement, provider errors, retry idempotency, persistence, role rules, and cross-workspace isolation.
- [ ] Run lint, typecheck, automated tests, production build, then verify with configured live providers.

### Later modules

- [ ] Competitor directory, authorized page retrieval, snapshots, comparison, and change detection.
- [ ] Copy analysis for user-provided or permitted content.
- [ ] Structured strategy generation/edit/save/regeneration/export.
- [ ] Scheduled refresh worker, retry policy, usage limits, and history UI.

No Phase 3 work begins until Phase 2 acceptance tests, including real provider workflow and tenant isolation, pass.
