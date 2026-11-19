create type public.member_role as enum ('owner','admin','editor','viewer');
create type public.member_status as enum ('invited','active','suspended');

create table public.organizations (
  id uuid primary key default gen_random_uuid(), name text not null check (char_length(name) between 2 and 120), plan text not null default 'mvp', owner_user_id uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, role public.member_role not null, status public.member_status not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key (organization_id, user_id)
);
create table public.workspaces (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, name text not null check (char_length(name) between 2 and 120), default_currency char(3) not null default 'MYR', timezone text not null default 'Asia/Kuala_Lumpur', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id, name), unique (id, organization_id)
);
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, role public.member_role not null, status public.member_status not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key (workspace_id, user_id)
);
create table public.brands (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, workspace_id uuid not null, name text not null check (char_length(name) between 2 and 120), website text, description text, tone text, market_json jsonb not null default '{}'::jsonb, guidelines_json jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (workspace_id, name), unique (id, organization_id), foreign key (workspace_id, organization_id) references public.workspaces(id, organization_id) on delete cascade
);
create table public.products (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, brand_id uuid not null, name text not null, description text, price numeric(14,2) check (price is null or price >= 0), currency char(3), attributes_json jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), foreign key (brand_id, organization_id) references public.brands(id, organization_id) on delete cascade
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, workspace_id uuid, actor_user_id uuid references auth.users(id), action text not null, entity_type text not null, entity_id uuid, metadata_json jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), foreign key (workspace_id, organization_id) references public.workspaces(id, organization_id) on delete cascade
);

create index organization_members_user_idx on public.organization_members(user_id, organization_id);
create index workspaces_org_idx on public.workspaces(organization_id);
create index workspace_members_user_idx on public.workspace_members(user_id, workspace_id);
create index brands_workspace_idx on public.brands(workspace_id);
create index audit_logs_org_created_idx on public.audit_logs(organization_id, created_at desc);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.organization_members m where m.organization_id = target_org and m.user_id = (select auth.uid()) and m.status = 'active') $$;
create or replace function public.has_org_role(target_org uuid, allowed_roles public.member_role[])
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.organization_members m where m.organization_id = target_org and m.user_id = (select auth.uid()) and m.status = 'active' and m.role = any(allowed_roles)) $$;
create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.workspace_members m where m.workspace_id = target_workspace and m.user_id = (select auth.uid()) and m.status = 'active') $$;
create or replace function public.has_workspace_role(target_workspace uuid, allowed_roles public.member_role[])
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.workspace_members m where m.workspace_id = target_workspace and m.user_id = (select auth.uid()) and m.status = 'active' and m.role = any(allowed_roles)) $$;

create policy organizations_select on public.organizations for select to authenticated using (public.is_org_member(id));
create policy organizations_update on public.organizations for update to authenticated using (public.has_org_role(id, array['owner','admin']::public.member_role[])) with check (public.has_org_role(id, array['owner','admin']::public.member_role[]));
create policy members_select on public.organization_members for select to authenticated using (public.is_org_member(organization_id));
create policy members_manage on public.organization_members for all to authenticated using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[])) with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));
create policy workspaces_select on public.workspaces for select to authenticated using (public.is_workspace_member(id));
create policy workspace_members_select on public.workspace_members for select to authenticated using (user_id = (select auth.uid()) or public.has_org_role((select organization_id from public.workspaces where id = workspace_id), array['owner','admin']::public.member_role[]));
create policy workspace_members_manage on public.workspace_members for all to authenticated using (public.has_workspace_role(workspace_id, array['owner','admin']::public.member_role[])) with check (public.has_workspace_role(workspace_id, array['owner','admin']::public.member_role[]));
create policy workspaces_update on public.workspaces for update to authenticated using (public.has_workspace_role(id, array['owner','admin']::public.member_role[])) with check (public.has_workspace_role(id, array['owner','admin']::public.member_role[]));
create policy brands_select on public.brands for select to authenticated using (public.is_workspace_member(workspace_id));
create policy brands_insert on public.brands for insert to authenticated with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[]));
create policy brands_update on public.brands for update to authenticated using (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[])) with check (public.has_workspace_role(workspace_id, array['owner','admin','editor']::public.member_role[]));
create policy brands_delete on public.brands for delete to authenticated using (public.has_workspace_role(workspace_id, array['owner','admin']::public.member_role[]));
create policy products_select on public.products for select to authenticated using (public.is_workspace_member((select b.workspace_id from public.brands b where b.id = brand_id)));
create policy products_write on public.products for all to authenticated using (public.has_workspace_role((select b.workspace_id from public.brands b where b.id = brand_id), array['owner','admin','editor']::public.member_role[])) with check (public.has_workspace_role((select b.workspace_id from public.brands b where b.id = brand_id), array['owner','admin','editor']::public.member_role[]));
create policy audit_select on public.audit_logs for select to authenticated using (workspace_id is not null and public.is_workspace_member(workspace_id));
create policy audit_insert on public.audit_logs for insert to authenticated with check (actor_user_id = (select auth.uid()) and workspace_id is not null and public.is_workspace_member(workspace_id));
create policy audit_immutable on public.audit_logs for update to authenticated using (false);
create policy audit_no_delete on public.audit_logs for delete to authenticated using (false);

grant usage on schema public to authenticated;
grant select, update on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, update on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.brands to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert on public.audit_logs to authenticated;

create or replace function public.create_workspace_with_brand(workspace_name text, workspace_currency char(3), workspace_timezone text, brand_name text)
returns public.workspaces language plpgsql security definer set search_path = ''
as $$
declare new_org public.organizations; new_workspace public.workspaces;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'Authentication required'; end if;
  insert into public.organizations(name, owner_user_id) values (workspace_name, (select auth.uid())) returning * into new_org;
  insert into public.organization_members(organization_id, user_id, role) values (new_org.id, (select auth.uid()), 'owner');
  insert into public.workspaces(organization_id, name, default_currency, timezone) values (new_org.id, workspace_name, workspace_currency, workspace_timezone) returning * into new_workspace;
  insert into public.workspace_members(workspace_id, user_id, role) values (new_workspace.id, (select auth.uid()), 'owner');
  insert into public.brands(organization_id, workspace_id, name) values (new_org.id, new_workspace.id, brand_name);
  insert into public.audit_logs(organization_id, workspace_id, actor_user_id, action, entity_type, entity_id, metadata_json) values (new_org.id, new_workspace.id, (select auth.uid()), 'workspace.created', 'workspace', new_workspace.id, pg_catalog.jsonb_build_object('brand_name', brand_name));
  return new_workspace;
end $$;
grant execute on function public.create_workspace_with_brand(text, char(3), text, text) to authenticated;

create or replace function public.create_workspace_for_org(target_org uuid, workspace_name text, workspace_currency char(3), workspace_timezone text, brand_name text)
returns public.workspaces language plpgsql security definer set search_path = ''
as $$
declare new_workspace public.workspaces;
begin
  if not exists (select 1 from public.organization_members m where m.organization_id = target_org and m.user_id = (select auth.uid()) and m.status = 'active' and m.role = any(array['owner','admin']::public.member_role[])) then
    raise exception using errcode = '42501', message = 'Organization administrator access required';
  end if;
  insert into public.workspaces(organization_id, name, default_currency, timezone) values (target_org, workspace_name, workspace_currency, workspace_timezone) returning * into new_workspace;
  insert into public.workspace_members(workspace_id, user_id, role, status)
    select new_workspace.id, m.user_id, m.role, 'active' from public.organization_members m where m.organization_id = target_org and m.status = 'active';
  insert into public.brands(organization_id, workspace_id, name) values (target_org, new_workspace.id, brand_name);
  insert into public.audit_logs(organization_id, workspace_id, actor_user_id, action, entity_type, entity_id, metadata_json) values (target_org, new_workspace.id, (select auth.uid()), 'workspace.created', 'workspace', new_workspace.id, pg_catalog.jsonb_build_object('brand_name', brand_name));
  return new_workspace;
end $$;
grant execute on function public.create_workspace_for_org(uuid, text, char(3), text, text) to authenticated;

revoke all on function public.is_org_member(uuid), public.has_org_role(uuid, public.member_role[]), public.is_workspace_member(uuid), public.has_workspace_role(uuid, public.member_role[]) from public, anon;
grant execute on function public.is_org_member(uuid), public.has_org_role(uuid, public.member_role[]), public.is_workspace_member(uuid), public.has_workspace_role(uuid, public.member_role[]) to authenticated;
revoke all on function public.create_workspace_with_brand(text, char(3), text, text), public.create_workspace_for_org(uuid, text, char(3), text, text) from public, anon;

create or replace function public.write_audit_event() returns trigger language plpgsql security definer set search_path = ''
as $$
declare org_id uuid; ws_id uuid; entity uuid;
begin
  if tg_table_name = 'brands' then org_id := coalesce(new.organization_id, old.organization_id); ws_id := coalesce(new.workspace_id, old.workspace_id); entity := coalesce(new.id, old.id);
  elsif tg_table_name = 'workspaces' then org_id := coalesce(new.organization_id, old.organization_id); ws_id := coalesce(new.id, old.id); entity := coalesce(new.id, old.id);
  elsif tg_table_name = 'workspace_members' then ws_id := coalesce(new.workspace_id, old.workspace_id); select w.organization_id into org_id from public.workspaces w where w.id = ws_id; entity := coalesce(new.user_id, old.user_id);
  else org_id := coalesce(new.id, old.id); ws_id := null; entity := org_id; end if;
  insert into public.audit_logs(organization_id, workspace_id, actor_user_id, action, entity_type, entity_id, metadata_json)
  values (org_id, ws_id, (select auth.uid()), pg_catalog.lower(tg_table_name) || '.' || pg_catalog.lower(tg_op), tg_table_name, entity, pg_catalog.jsonb_build_object('operation', tg_op));
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;
revoke all on function public.write_audit_event() from public, anon, authenticated;
create trigger brands_audit after insert or update or delete on public.brands for each row execute function public.write_audit_event();
create trigger workspaces_audit after update on public.workspaces for each row execute function public.write_audit_event();
create trigger workspace_members_audit after insert or update or delete on public.workspace_members for each row execute function public.write_audit_event();
create trigger organizations_audit after update on public.organizations for each row execute function public.write_audit_event();
