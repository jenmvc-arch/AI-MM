import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const userA = "10000000-0000-4000-8000-000000000001";
const userB = "20000000-0000-4000-8000-000000000002";
const orgA = "30000000-0000-4000-8000-000000000003";
const wsA = "40000000-0000-4000-8000-000000000004";
const orgB = "50000000-0000-4000-8000-000000000005";
const wsB = "60000000-0000-4000-8000-000000000006";

describe("Phase 1 tenant policies", () => {
  const db = new PGlite();

  beforeAll(async () => {
    await db.exec(`
      create schema auth;
      create role anon;
      create role authenticated;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create function auth.role() returns text language sql stable as $$
        select current_setting('request.jwt.claim.role', true)
      $$;
      create table auth.users (id uuid primary key);
      insert into auth.users values ('${userA}'), ('${userB}');
      grant usage on schema auth, public to authenticated, anon;
      grant execute on function auth.uid(), auth.role() to authenticated, anon;
    `);
    const migration = await readFile(
      new URL("../../supabase/migrations/0001_phase1.sql", import.meta.url),
      "utf8",
    );
    await db.exec(migration);
    const productAuditMigration = await readFile(
      new URL("../../supabase/migrations/0002_phase1_product_audit.sql", import.meta.url),
      "utf8",
    );
    await db.exec(productAuditMigration);
    const researchMigration = await readFile(
      new URL("../../supabase/migrations/0003_market_research.sql", import.meta.url),
      "utf8",
    );
    await db.exec(researchMigration);
    const intelligenceMigration = await readFile(
      new URL("../../supabase/migrations/0004_phase2_intelligence.sql", import.meta.url),
      "utf8",
    );
    await db.exec(intelligenceMigration);
    await db.exec(`
      insert into public.organizations(id, name, owner_user_id) values
        ('${orgA}', 'Org A', '${userA}'), ('${orgB}', 'Org B', '${userB}');
      insert into public.organization_members(organization_id, user_id, role) values
        ('${orgA}', '${userA}', 'owner'), ('${orgB}', '${userB}', 'owner');
      insert into public.workspaces(id, organization_id, name) values
        ('${wsA}', '${orgA}', 'Workspace A'), ('${wsB}', '${orgB}', 'Workspace B');
      insert into public.workspace_members(workspace_id, user_id, role) values
        ('${wsA}', '${userA}', 'owner'), ('${wsB}', '${userB}', 'owner');
      insert into public.brands(id, organization_id, workspace_id, name) values
        ('70000000-0000-4000-8000-000000000007', '${orgA}', '${wsA}', 'Brand A'),
        ('80000000-0000-4000-8000-000000000008', '${orgB}', '${wsB}', 'Brand B');
      insert into public.products(organization_id, brand_id, name, price, currency) values ('${orgA}', '70000000-0000-4000-8000-000000000007', 'Product A', 15.50, 'MYR');
      insert into public.research_projects(id, organization_id, workspace_id, title, industry, product, geography, target_customers, objectives, created_by) values
        ('90000000-0000-4000-8000-000000000009', '${orgA}', '${wsA}', 'A research', 'Retail', 'Product A', 'Malaysia', 'Adults', 'Pricing', '${userA}'),
        ('a0000000-0000-4000-8000-00000000000a', '${orgB}', '${wsB}', 'B research', 'Retail', 'Product B', 'Malaysia', 'Adults', 'Pricing', '${userB}');
      insert into public.research_jobs(id, organization_id, workspace_id, project_id, idempotency_key) values
        ('b0000000-0000-4000-8000-00000000000b', '${orgA}', '${wsA}', '90000000-0000-4000-8000-000000000009', 'test-job-user-a'),
        ('c0000000-0000-4000-8000-00000000000c', '${orgB}', '${wsB}', 'a0000000-0000-4000-8000-00000000000a', 'test-job-user-b');
      insert into public.research_sources(id, organization_id, workspace_id, project_id, job_id, url, title, provider, evidence) values
        ('d0000000-0000-4000-8000-00000000000d', '${orgA}', '${wsA}', '90000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-00000000000b', 'https://example.com/a', 'A source', 'test', 'evidence A');
      insert into public.market_findings(id, organization_id, workspace_id, project_id, job_id, category, claim, classification, confidence, evidence) values
        ('e0000000-0000-4000-8000-00000000000e', '${orgA}', '${wsA}', '90000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-00000000000b', 'market_trend', 'A sourced research claim', 'verified', 0.8, 'evidence A');
      insert into public.market_finding_sources(finding_id, source_id, organization_id, workspace_id, project_id) values
        ('e0000000-0000-4000-8000-00000000000e', 'd0000000-0000-4000-8000-00000000000d', '${orgA}', '${wsA}', '90000000-0000-4000-8000-000000000009');
      insert into public.competitors(id, organization_id, workspace_id, brand_id, name, created_by) values
        ('f0000000-0000-4000-8000-00000000000f', '${orgA}', '${wsA}', '70000000-0000-4000-8000-000000000007', 'Competitor A', '${userA}'),
        ('10000000-0000-4000-8000-000000000010', '${orgB}', '${wsB}', '80000000-0000-4000-8000-000000000008', 'Competitor B', '${userB}');
      insert into public.competitor_snapshots(organization_id, workspace_id, competitor_id, source_url, source_type, positioning, content_hash) values
        ('${orgA}', '${wsA}', 'f0000000-0000-4000-8000-00000000000f', 'https://example.com/competitor-a', 'user_provided', 'Positioning A', 'hash-a'),
        ('${orgB}', '${wsB}', '10000000-0000-4000-8000-000000000010', 'https://example.com/competitor-b', 'user_provided', 'Positioning B', 'hash-b');
    `);
  });

  async function asUser<T>(userId: string, callback: () => Promise<T>) {
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`);
    try {
      return await callback();
    } finally {
      await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);");
    }
  }

  it("shows only the active user's workspaces and brands", async () => {
    const visible = await asUser(userA, async () => {
      const workspaces = await db.query("select id from public.workspaces order by id");
      const brands = await db.query("select name from public.brands order by name");
      return { workspaces: workspaces.rows, brands: brands.rows };
    });
    expect(visible.workspaces).toEqual([{ id: wsA }]);
    expect(visible.brands).toEqual([{ name: "Brand A" }]);
  });

  it("denies a workspace A member from inserting into workspace B", async () => {
    await expect(
      asUser(userA, async () =>
        db.exec(`insert into public.brands(organization_id, workspace_id, name) values ('${orgB}', '${wsB}', 'Unauthorized')`),
      ),
    ).rejects.toThrow();
  });

  it("records and exposes brand changes in the tenant audit log", async () => {
    const logs = await asUser(userA, () =>
      db.query(
        "select action, entity_type from public.audit_logs where workspace_id = $1 order by created_at",
        [wsA],
      ),
    );
    expect(logs.rows).toContainEqual({ action: "brands.insert", entity_type: "brands" });
  });

  it("records product changes in tenant audit history", async () => {
    const logs = await asUser(userA, () => db.query(
      "select action, entity_type from public.audit_logs where workspace_id = $1 and entity_type = 'product'",
      [wsA],
    ));
    expect(logs.rows).toContainEqual({ action: "products.insert", entity_type: "product" });
  });

  it("isolates research projects, sources, and findings by workspace", async () => {
    const visible = await asUser(userA, async () => {
      const projects = await db.query("select title from public.research_projects order by title");
      const sources = await db.query("select title from public.research_sources");
      const findings = await db.query("select claim from public.market_findings");
      return { projects: projects.rows, sources: sources.rows, findings: findings.rows };
    });
    expect(visible).toEqual({
      projects: [{ title: "A research" }],
      sources: [{ title: "A source" }],
      findings: [{ claim: "A sourced research claim" }],
    });
  });

  it("rejects linking a finding to another workspace's source", async () => {
    await expect(asUser(userB, async () => db.exec(`
      insert into public.market_finding_sources(finding_id, source_id, organization_id, workspace_id, project_id)
      values ('e0000000-0000-4000-8000-00000000000e', 'd0000000-0000-4000-8000-00000000000d', '${orgB}', '${wsB}', 'a0000000-0000-4000-8000-00000000000a')
    `))).rejects.toThrow();
  });

  it("creates one authorized research job for an idempotency key", async () => {
    const created = await asUser(userA, () => db.query(
      `select * from public.create_research_project_job($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [wsA, "70000000-0000-4000-8000-000000000007", "Retail: Malaysia", "Retail", "Product", "Malaysia", "Adults", "Pricing", "idempotent-test-0001"],
    ));
    const repeated = await asUser(userA, () => db.query(
      `select * from public.create_research_project_job($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [wsA, null, "Different title", "Retail", "Other product", "Malaysia", "Adults", "Pricing", "idempotent-test-0001"],
    ));
    const first = created.rows[0] as { project_id: string; job_id: string; was_created: boolean; job_status: string };
    const again = repeated.rows[0] as { project_id: string; job_id: string; was_created: boolean };
    expect(first).toMatchObject({ was_created: true, job_status: "queued" });
    expect(again).toMatchObject({ was_created: false, project_id: first.project_id, job_id: first.job_id });
  });

  it("rejects creating research in a workspace the caller does not belong to", async () => {
    await expect(asUser(userA, () => db.query(
      `select * from public.create_research_project_job($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [wsB, null, "Unauthorized", "Retail", "Product", "Malaysia", "Adults", "Pricing", "cross-workspace-job"],
    ))).rejects.toThrow();
  });

  it("isolates competitor profiles and snapshots by workspace", async () => {
    const visible = await asUser(userA, async () => {
      const competitors = await db.query("select name from public.competitors order by name");
      const snapshots = await db.query("select positioning from public.competitor_snapshots order by positioning");
      return { competitors: competitors.rows, snapshots: snapshots.rows };
    });
    expect(visible).toEqual({ competitors: [{ name: "Competitor A" }], snapshots: [{ positioning: "Positioning A" }] });
  });

  it("denies a viewer from creating competitor content", async () => {
    await db.exec(`update public.workspace_members set role = 'viewer' where workspace_id = '${wsA}' and user_id = '${userA}'`);
    await expect(asUser(userA, async () => db.exec(`
      insert into public.competitor_content(organization_id, workspace_id, competitor_id, source_url, content_type, body, created_by)
      values ('${orgA}', '${wsA}', 'f0000000-0000-4000-8000-00000000000f', 'https://example.com/copy', 'website', 'Public competitor copy', '${userA}')
    `))).rejects.toThrow();
    await db.exec(`update public.workspace_members set role = 'owner' where workspace_id = '${wsA}' and user_id = '${userA}'`);
  });
});
