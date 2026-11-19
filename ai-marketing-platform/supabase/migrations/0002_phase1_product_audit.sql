create or replace function public.write_product_audit_event() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  product_brand uuid;
  org_id uuid;
  ws_id uuid;
  entity_id uuid;
  actor uuid := (select auth.uid());
begin
  product_brand := case when tg_op = 'DELETE' then old.brand_id else new.brand_id end;
  entity_id := case when tg_op = 'DELETE' then old.id else new.id end;
  select b.organization_id, b.workspace_id into org_id, ws_id from public.brands b where b.id = product_brand;
  insert into public.audit_logs(organization_id, workspace_id, actor_user_id, action, entity_type, entity_id, metadata_json)
  values (org_id, ws_id, actor, 'products.' || pg_catalog.lower(tg_op), 'product', entity_id, pg_catalog.jsonb_build_object('brand_id', product_brand));
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;
revoke all on function public.write_product_audit_event() from public, anon, authenticated;
create trigger products_audit after insert or update or delete on public.products for each row execute function public.write_product_audit_event();
