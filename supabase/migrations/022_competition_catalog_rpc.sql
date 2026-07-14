-- FantaChat - readable competition catalog for league admins
--
-- The creation flow must not depend on direct table SELECT policies.

create or replace function public.get_competition_catalog()
returns table(
  id uuid,
  name text,
  slug text,
  type text,
  description text,
  rules_summary text,
  launch_label text,
  visibility_status text,
  default_total_matchdays integer,
  default_top_n integer,
  scope text
)
language sql
security definer
set search_path to 'public'
as $function$
  select
    c.id,
    c.name,
    c.slug,
    c.type,
    c.description,
    c.rules_summary,
    c.launch_label,
    c.visibility_status,
    c.default_total_matchdays,
    c.default_top_n,
    c.scope
  from public.competitions c
  where c.active = true
    and coalesce(c.visibility_status, 'active') <> 'archived'
  order by c.type, c.name;
$function$;

create or replace function public.get_competition_seasons(
  p_competition_id uuid
)
returns table(
  id uuid,
  name text,
  competition_id uuid,
  total_matchdays integer
)
language sql
security definer
set search_path to 'public'
as $function$
  select
    s.id,
    s.name,
    s.competition_id,
    s.total_matchdays
  from public.seasons s
  where s.competition_id = p_competition_id
    and s.active = true
  order by s.created_at desc;
$function$;

revoke execute on function public.get_competition_catalog() from public, anon;
revoke execute on function public.get_competition_seasons(uuid) from public, anon;

grant execute on function public.get_competition_catalog() to authenticated;
grant execute on function public.get_competition_seasons(uuid) to authenticated;
