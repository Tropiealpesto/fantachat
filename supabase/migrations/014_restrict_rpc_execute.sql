-- FantaChat launch readiness - point 1
-- Restrict public RPC execution to authenticated users.
--
-- Run after reviewing the audit results on the live database.
-- This does not change function logic. It only removes anonymous RPC access.

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute format('revoke execute on function %s from public', r.fn);
    execute format('revoke execute on function %s from anon', r.fn);
    execute format('grant execute on function %s to authenticated', r.fn);
  end loop;
end $$;

