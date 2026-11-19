create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null,
  name text not null check (char_length(name) between 2 and 160),
  website_url text,
  social_profiles jsonb not null default '{}'::jsonb,
  positioning text not null default '',
  offers text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id, workspace_id),
  foreign key (brand_id, organization_id, workspace_id)
    references public.brands(id, organization_id, workspace_id) on delete cascade
);

create table public.competitor_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  competitor_id uuid not null,
  source_url text,
  source_type text not null check (source_type in ('user_provided', 'tavily_search')),
  observed_at timestamptz not null default now(),
  positioning text not null default '',
  offers text not null default '',
  pricing text not null default '',
  messaging text not null default '',
  channels jsonb not null default '[]'::jsonb,
  evidence text not null default '',
  content_hash text not null,
  change_summary text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (id, organization_id, workspace_id),
  foreign key (competitor_id, organization_id, workspace_id)
    references public.competitors(id, organization_id, workspace_id) on delete cascade
);

create table public.competitor_content (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  competitor_id uuid not null,
  snapshot_id uuid,
  source_url text not null,
  content_type text not null check (content_type in ('website', 'social', 'advertisement', 'email', 'landing_page', 'other')),
  title text not null default '',
  body text not null check (char_length(body) between 1 and 20000),
  observed_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (competitor_id, organization_id, workspace_id)
    references public.competitors(id, organization_id, workspace_id) on delete cascade,
  foreign key (snapshot_id, organization_id, workspace_id)
    references public.competitor_snapshots(id, organization_id, workspace_id) on delete set null (snapshot_id)
);
alter table public.competitor_content add constraint competitor_content_id_org_workspace_unique unique (id, organization_id, workspace_id);

create table public.copy_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid,
  source_competitor_content_id uuid,
  source_url text,
  input_copy text not null check (char_length(input_copy) between 10 and 20000),
  analysis_json jsonb not null,
  model text not null,
  prompt_version text not null default 'copy-analysis-v1',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (brand_id, organization_id, workspace_id)
    references public.brands(id, organization_id, workspace_id) on delete set null (brand_id),
  foreign key (source_competitor_content_id, organization_id, workspace_id)
    references public.competitor_content(id, organization_id, workspace_id) on delete set null (source_competitor_content_id)
);

create table public.marketing_strategies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null,
  title text not null check (char_length(title) between 2 and 200),
  version integer not null default 1 check (version > 0),
  strategy_json jsonb not null,
  research_project_ids uuid[] not null default '{}',
  competitor_ids uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  model text not null,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id, workspace_id),
  foreign key (brand_id, organization_id, workspace_id)
    references public.brands(id, organization_id, workspace_id) on delete cascade
);

create table public.monitoring_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  competitor_id uuid not null,
  enabled boolean not null default true,
  interval_hours integer not null check (interval_hours between 24 and 2160),
  next_run_at timestamptz not null default now(),
  last_run_at timestamptz,
  last_status text check (last_status in ('completed', 'failed')),
  last_error_code text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (competitor_id),
  foreign key (competitor_id, organization_id, workspace_id)
    references public.competitors(id, organization_id, workspace_id) on delete cascade
);

create table public.marketing_strategy_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  workspace_id uuid not null,
  strategy_id uuid not null,
  version integer not null check (version > 0),
  strategy_json jsonb not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (strategy_id, version),
  foreign key (strategy_id, organization_id, workspace_id)
    references public.marketing_strategies(id, organization_id, workspace_id) on delete cascade
);

create index competitors_brand_created_idx on public.competitors(brand_id, created_at desc);
create index competitor_snapshots_history_idx on public.competitor_snapshots(competitor_id, observed_at desc);
create index competitor_snapshots_hash_idx on public.competitor_snapshots(competitor_id, content_hash);
create index competitor_content_history_idx on public.competitor_content(competitor_id, observed_at desc);
create index copy_analyses_workspace_idx on public.copy_analyses(workspace_id, created_at desc);
create index marketing_strategies_brand_idx on public.marketing_strategies(brand_id, updated_at desc);
create index monitoring_due_idx on public.monitoring_schedules(next_run_at) where enabled;
create index strategy_versions_history_idx on public.marketing_strategy_versions(strategy_id, version desc);

alter table public.competitors enable row level security;
alter table public.competitor_snapshots enable row level security;
alter table public.competitor_content enable row level security;
alter table public.copy_analyses enable row level security;
alter table public.marketing_strategies enable row level security;
alter table public.monitoring_schedules enable row level security;
alter table public.marketing_strategy_versions enable row level security;

create policy competitors_read on public.competitors for select to authenticated using (public.is_workspace_member(workspace_id));
create policy competitors_insert on public.competitors for insert to authenticated with check (
  created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[])
);
create policy competitors_update on public.competitors for update to authenticated using (
  public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[])
) with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[]));
create policy competitors_delete on public.competitors for delete to authenticated using (
  public.has_workspace_role(workspace_id, array['owner','admin']::public.member_role[])
);

create policy competitor_snapshots_read on public.competitor_snapshots for select to authenticated using (public.is_workspace_member(workspace_id));
create policy competitor_snapshots_insert on public.competitor_snapshots for insert to authenticated with check (
  public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[])
);
create policy competitor_content_read on public.competitor_content for select to authenticated using (public.is_workspace_member(workspace_id));
create policy competitor_content_write on public.competitor_content for all to authenticated using (
  public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[])
) with check (created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[]));
create policy copy_analyses_read on public.copy_analyses for select to authenticated using (public.is_workspace_member(workspace_id));
create policy copy_analyses_write on public.copy_analyses for all to authenticated using (
  public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[])
) with check (created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[]));
create policy marketing_strategies_read on public.marketing_strategies for select to authenticated using (public.is_workspace_member(workspace_id));
create policy marketing_strategies_insert on public.marketing_strategies for insert to authenticated with check (
  created_by = (select auth.uid()) and updated_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[])
);
create policy marketing_strategies_update on public.marketing_strategies for update to authenticated using (
  public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[])
) with check (updated_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[]));
create policy marketing_strategies_delete on public.marketing_strategies for delete to authenticated using (
  public.has_workspace_role(workspace_id, array['owner','admin']::public.member_role[])
);
create policy monitoring_schedules_read on public.monitoring_schedules for select to authenticated using (public.is_workspace_member(workspace_id));
create policy monitoring_schedules_write on public.monitoring_schedules for all to authenticated using (
  public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[])
) with check (created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[]));
create policy strategy_versions_read on public.marketing_strategy_versions for select to authenticated using (public.is_workspace_member(workspace_id));
create policy strategy_versions_insert on public.marketing_strategy_versions for insert to authenticated with check (
  created_by = (select auth.uid()) and public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[])
);

grant select, insert, update, delete on public.competitors, public.competitor_snapshots, public.competitor_content, public.copy_analyses, public.marketing_strategies, public.monitoring_schedules to authenticated;
grant select, insert on public.marketing_strategy_versions to authenticated;

create or replace function public.audit_phase2_intelligence() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  row_data jsonb := pg_catalog.to_jsonb(new);
  actor uuid := (select auth.uid());
begin
  insert into public.audit_logs(organization_id, workspace_id, actor_user_id, action, entity_type, entity_id, metadata_json)
  values (
    new.organization_id,
    new.workspace_id,
    actor,
    tg_table_name || '.' || pg_catalog.lower(tg_op),
    tg_table_name,
    new.id,
    pg_catalog.jsonb_build_object('name', coalesce(row_data->>'name', row_data->>'title', row_data->>'id'), 'version', row_data->>'version')
  );
  return new;
end $$;
revoke all on function public.audit_phase2_intelligence() from public, anon, authenticated;

create trigger competitor_audit after insert or update on public.competitors for each row execute function public.audit_phase2_intelligence();
create trigger competitor_snapshot_audit after insert on public.competitor_snapshots for each row execute function public.audit_phase2_intelligence();
create trigger competitor_content_audit after insert on public.competitor_content for each row execute function public.audit_phase2_intelligence();
create trigger copy_analysis_audit after insert on public.copy_analyses for each row execute function public.audit_phase2_intelligence();
create trigger strategy_audit after insert or update on public.marketing_strategies for each row execute function public.audit_phase2_intelligence();

create or replace function public.capture_marketing_strategy_version() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.version <> old.version then
    insert into public.marketing_strategy_versions(organization_id, workspace_id, strategy_id, version, strategy_json, created_by)
    values (new.organization_id, new.workspace_id, new.id, new.version, new.strategy_json, new.updated_by);
  end if;
  return new;
end $$;
revoke all on function public.capture_marketing_strategy_version() from public, anon, authenticated;
create trigger strategy_version_capture after insert or update on public.marketing_strategies for each row execute function public.capture_marketing_strategy_version();
