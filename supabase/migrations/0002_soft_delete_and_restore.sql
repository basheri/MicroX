-- =====================================================================
-- 0002 — Soft-delete convenience views + deleted_items restore path (EP-02)
-- Rule 30-database-and-data: default queries exclude is_deleted = true;
-- soft delete keeps a restorable copy in deleted_items.
-- =====================================================================

create schema if not exists app;

-- One `active_<table>` view per soft-deletable table (those with is_deleted),
-- exposing only non-deleted rows. Built dynamically so it tracks the schema.
do $$
declare t text;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'is_deleted'
    order by table_name
  loop
    execute format(
      'create or replace view public.active_%I as select * from public.%I where is_deleted = false;',
      t, t);
  end loop;
end $$;

-- Soft-delete a row: flip is_deleted (+ deleted_at/deleted_by_actor when present)
-- and store a full JSONB snapshot in deleted_items so it can be restored.
create or replace function app.soft_delete(p_table text, p_id uuid, p_actor text)
returns uuid
language plpgsql
as $$
declare
  v_has_del   boolean;
  v_has_delat boolean;
  v_has_delby boolean;
  v_snapshot  jsonb;
  v_sql       text;
begin
  if coalesce(btrim(p_actor), '') = '' then
    raise exception 'soft_delete: actor is required (rule 00 — no anonymous writes)';
  end if;

  select
    bool_or(column_name = 'is_deleted'),
    bool_or(column_name = 'deleted_at'),
    bool_or(column_name = 'deleted_by_actor')
  into v_has_del, v_has_delat, v_has_delby
  from information_schema.columns
  where table_schema = 'public' and table_name = p_table;

  if v_has_del is distinct from true then
    raise exception 'soft_delete: table % is not soft-deletable (no is_deleted column)', p_table;
  end if;

  execute format('select to_jsonb(t) from public.%I t where id = %L', p_table, p_id)
    into v_snapshot;
  if v_snapshot is null then
    raise exception 'soft_delete: % with id % not found', p_table, p_id;
  end if;

  v_sql := format('update public.%I set is_deleted = true', p_table);
  if v_has_delat then v_sql := v_sql || ', deleted_at = now()'; end if;
  if v_has_delby then v_sql := v_sql || format(', deleted_by_actor = %L', p_actor); end if;
  v_sql := v_sql || format(' where id = %L', p_id);
  execute v_sql;

  insert into public.deleted_items (entity_table, entity_id, snapshot, deleted_by_actor)
  values (p_table, p_id, v_snapshot, p_actor);

  return p_id;
end;
$$;

-- Restore a previously soft-deleted row: clear is_deleted on the original row and
-- consume the deleted_items entry. (Program version semantics — restore-as-new-version,
-- BR-020 — are layered on in EP-19; here we just un-delete the row.)
create or replace function app.restore(p_deleted_item_id uuid, p_actor text)
returns uuid
language plpgsql
as $$
declare
  v_table     text;
  v_entity    uuid;
  v_has_delat boolean;
  v_has_delby boolean;
  v_sql       text;
  v_count     int;
begin
  if coalesce(btrim(p_actor), '') = '' then
    raise exception 'restore: actor is required (rule 00 — no anonymous writes)';
  end if;

  select entity_table, entity_id into v_table, v_entity
  from public.deleted_items where id = p_deleted_item_id;
  if not found then
    raise exception 'restore: deleted_item % not found', p_deleted_item_id;
  end if;

  select
    bool_or(column_name = 'deleted_at'),
    bool_or(column_name = 'deleted_by_actor')
  into v_has_delat, v_has_delby
  from information_schema.columns
  where table_schema = 'public' and table_name = v_table;

  v_sql := format('update public.%I set is_deleted = false', v_table);
  if v_has_delat then v_sql := v_sql || ', deleted_at = null'; end if;
  if v_has_delby then v_sql := v_sql || ', deleted_by_actor = null'; end if;
  v_sql := v_sql || format(' where id = %L', v_entity);
  execute v_sql;
  get diagnostics v_count = row_count;

  if v_count = 0 then
    raise exception 'restore: original row %.% no longer exists', v_table, v_entity;
  end if;

  delete from public.deleted_items where id = p_deleted_item_id;
  return v_entity;
end;
$$;
