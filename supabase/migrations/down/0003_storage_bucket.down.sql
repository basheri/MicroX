-- Reverse of 0003 — remove the private bucket (guarded for non-Supabase envs).
do $$
begin
  if to_regclass('storage.buckets') is not null then
    delete from storage.buckets where id = 'program-files';
  end if;
end $$;
