-- Reverse of 0002 — drop restore/soft-delete functions and the active_* views.
drop function if exists app.restore(uuid, text);
drop function if exists app.soft_delete(text, uuid, text);

do $$
declare v text;
begin
  for v in
    select table_name from information_schema.views
    where table_schema = 'public' and table_name like 'active\_%'
  loop
    execute format('drop view if exists public.%I;', v);
  end loop;
end $$;

drop schema if exists app cascade;
