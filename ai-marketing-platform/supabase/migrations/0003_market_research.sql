create type public.research_status as enum ('queued', 'running', 'completed', 'failed');
create type public.finding_classification as enum ('verified', 'inferred', 'hypothesis');

alter table public.brands
  add constraint brands_id_org_workspace_unique unique (id, organization_id, workspace_id);

create table public.research_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid,
  title text not null check (char_length(title) between 2 and 160),
  industry text not null check (char_length(industry) between 2 and 160),
  product text not null check (char_length(product) between 2 and 2000),
  geography text not null check (char_length(geography) between 2 and 160),
  target_customers text not null check (char_length(target_customers) between 2 and 2000),
  objectives text not null check (char_length(objectives) between 2 and 2000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id, workspace_id),
  foreign key (brand_id, organization_id, workspace_id) references public.brands(id, organization_id, workspace_id)
);

create table public.research_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  project_id uuid not null,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 160),
  status public.research_status not null default 'queued',
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  progress text not null default 'Queued',
  provider text,
  model text,
  error_code text,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key),
  unique (id, organization_id, workspace_id),
  foreign key (project_id, organization_id, workspace_id)
    references public.research_projects(id, organization_id, workspace_id) on delete cascade
);

create table public.research_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  project_id uuid not null,
  job_id uuid not null,
  url text not null,
  title text not null,
  retrieved_at timestamptz not null default now(),
  provider text not null,
  evidence text not null default '',
  content_hash text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (id, organization_id, workspace_id, project_id),
  foreign key (project_id, organization_id, workspace_id)
    references public.research_projects(id, organization_id, workspace_id) on delete cascade,
  foreign key (job_id, organization_id, workspace_id)
    references public.research_jobs(id, organization_id, workspace_id) on delete cascade
);

create table public.market_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  project_id uuid not null,
  job_id uuid not null,
  category text not null check (category in ('market_trend','customer_pain','competitor_landscape','pricing_positioning','swot','opportunity','risk','recommended_action')),
  claim text not null check (char_length(claim) between 5 and 2000),
  classification public.finding_classification not null,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  evidence text not null default '',
  created_at timestamptz not null default now(),
  unique (id, organization_id, workspace_id, project_id),
  foreign key (project_id, organization_id, workspace_id)
    references public.research_projects(id, organization_id, workspace_id) on delete cascade,
  foreign key (job_id, organization_id, workspace_id)
    references public.research_jobs(id, organization_id, workspace_id) on delete cascade
);

create table public.market_finding_sources (
  finding_id uuid not null,
  source_id uuid not null,
  organization_id uuid not null,
  workspace_id uuid not null,
  project_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (finding_id, source_id),
  foreign key (finding_id, organization_id, workspace_id, project_id)
    references public.market_findings(id, organization_id, workspace_id, project_id) on delete cascade,
  foreign key (source_id, organization_id, workspace_id, project_id)
    references public.research_sources(id, organization_id, workspace_id, project_id) on delete cascade
);

create index market_finding_sources_source_idx on public.market_finding_sources(source_id);

create index research_projects_workspace_created_idx on public.research_projects(workspace_id, created_at desc);
create index research_jobs_project_created_idx on public.research_jobs(project_id, created_at desc);
create index research_jobs_status_idx on public.research_jobs(status, updated_at);
create index research_sources_project_idx on public.research_sources(project_id, retrieved_at desc);
create index research_sources_url_hash_idx on public.research_sources(workspace_id, content_hash) where content_hash is not null;
create index market_findings_project_category_idx on public.market_findings(project_id, category, created_at);

alter table public.research_projects enable row level security;
alter table public.research_jobs enable row level security;
alter table public.research_sources enable row level security;
alter table public.market_findings enable row level security;
alter table public.market_finding_sources enable row level security;

create policy research_projects_read on public.research_projects for select to authenticated using (public.is_workspace_member(workspace_id));
create policy research_projects_insert on public.research_projects for insert to authenticated with check (
  created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[])
);
create policy research_projects_update on public.research_projects for update to authenticated using (
  public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[])
) with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[]));
create policy research_projects_delete on public.research_projects for delete to authenticated using (
  public.has_workspace_role(workspace_id, array['owner','admin']::public.member_role[])
);

create policy research_jobs_read on public.research_jobs for select to authenticated using (public.is_workspace_member(workspace_id));
create policy research_jobs_insert on public.research_jobs for insert to authenticated with check (
  public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[])
);
create policy research_jobs_update on public.research_jobs for update to authenticated using (
  public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[])
) with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[]));
create policy research_sources_read on public.research_sources for select to authenticated using (public.is_workspace_member(workspace_id));
create policy research_sources_write on public.research_sources for all to authenticated using (
  public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[])
) with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[]));
create policy market_findings_read on public.market_findings for select to authenticated using (public.is_workspace_member(workspace_id));
create policy market_findings_write on public.market_findings for all to authenticated using (
  public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[])
) with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[]));
create policy market_finding_sources_read on public.market_finding_sources for select to authenticated using (public.is_workspace_member(workspace_id));
create policy market_finding_sources_write on public.market_finding_sources for all to authenticated using (
  public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[])
) with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[]));

grant select, insert, update, delete on public.research_projects, public.research_jobs, public.research_sources, public.market_findings, public.market_finding_sources to authenticated;

create or replace function public.audit_research_project() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs(organization_id, workspace_id, actor_user_id, action, entity_type, entity_id, metadata_json)
  values (new.organization_id, new.workspace_id, (select auth.uid()), 'research_project.' || lower(tg_op), 'research_project', new.id, pg_catalog.jsonb_build_object('title', new.title));
  return new;
end $$;
revoke all on function public.audit_research_project() from public, anon, authenticated;
create trigger research_project_audit after insert or update on public.research_projects for each row execute function public.audit_research_project();

create or replace function public.create_research_project_job(
  target_workspace uuid,
  target_brand uuid,
  research_title text,
  research_industry text,
  research_product text,
  research_geography text,
  research_customers text,
  research_objectives text,
  request_key text
)
returns table(project_id uuid, job_id uuid, job_status public.research_status, was_created boolean)
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  org uuid;
  existing public.research_jobs;
  created_project public.research_projects;
  created_job public.research_jobs;
begin
  if actor is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  if not public.has_workspace_role(target_workspace, array['owner','admin','editor']::public.member_role[]) then
    raise exception using errcode = '42501', message = 'Research editor access required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_workspace::text || ':' || request_key, 0));
  select j.* into existing from public.research_jobs j where j.workspace_id = target_workspace and j.idempotency_key = request_key;
  if found then
    return query select existing.project_id, existing.id, existing.status, false;
    return;
  end if;
  select w.organization_id into org from public.workspaces w where w.id = target_workspace;
  if org is null then raise exception using errcode = 'P0002', message = 'Workspace not found'; end if;
  if target_brand is not null and not exists (
    select 1 from public.brands b where b.id = target_brand and b.workspace_id = target_workspace and b.organization_id = org
  ) then raise exception using errcode = '22023', message = 'Brand does not belong to this workspace'; end if;
  insert into public.research_projects(organization_id, workspace_id, brand_id, title, industry, product, geography, target_customers, objectives, created_by)
  values (org, target_workspace, target_brand, research_title, research_industry, research_product, research_geography, research_customers, research_objectives, actor)
  returning * into created_project;
  insert into public.research_jobs(organization_id, workspace_id, project_id, idempotency_key)
  values (org, target_workspace, created_project.id, request_key)
  returning * into created_job;
  return query select created_project.id, created_job.id, created_job.status, true;
end $$;
revoke all on function public.create_research_project_job(uuid, uuid, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_research_project_job(uuid, uuid, text, text, text, text, text, text, text) to authenticated;
