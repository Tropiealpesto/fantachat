-- FantaChat launch readiness - point 1
-- Version and harden live superadmin RPCs.
--
-- These definitions are based on the live Supabase export.
-- The main hardening change is explicit is_app_admin() checks on every
-- superadmin read/write function, not only on the mutating ones.

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists(
    select 1
    from public.app_admins a
    where a.email = auth.email()
  );
$function$;

create or replace function public.is_current_user_superadmin()
returns boolean
language sql
security definer
set search_path to 'public'
as $function$
  select public.is_app_admin();
$function$;

create or replace function public.superadmin_clear_top_n(
  p_competition_id uuid,
  p_season_id uuid,
  p_matchday_number integer
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_app_admin() then
    raise exception 'Solo superadmin';
  end if;

  delete from public.top_teams
  where competition_id = p_competition_id
    and season_id = p_season_id
    and matchday_number = p_matchday_number;
end
$function$;

create or replace function public.superadmin_create_global_competition(
  p_name text,
  p_slug text,
  p_type text,
  p_theme_key text,
  p_total_matchdays integer,
  p_top_n integer,
  p_scope text,
  p_description text default null,
  p_rules_summary text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_comp uuid;
  v_slug text;
begin
  if not public.is_app_admin() then
    raise exception 'Solo superadmin';
  end if;

  v_slug := coalesce(
    nullif(btrim(p_slug), ''),
    lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'))
  );

  insert into public.competitions(
    name,
    slug,
    type,
    theme_key,
    default_total_matchdays,
    default_top_n,
    scope,
    description,
    rules_summary,
    visibility_status,
    active
  )
  values(
    p_name,
    v_slug,
    coalesce(p_type, 'coppa'),
    p_theme_key,
    coalesce(p_total_matchdays, 38),
    coalesce(p_top_n, 6),
    coalesce(p_scope, 'club'),
    p_description,
    p_rules_summary,
    'active',
    true
  )
  returning id into v_comp;

  insert into public.seasons(
    competition_id,
    name,
    total_matchdays,
    active
  )
  values(
    v_comp,
    'Stagione ' || to_char(now(), 'YYYY'),
    coalesce(p_total_matchdays, 38),
    true
  );

  insert into public.competition_config(
    competition_id,
    roles,
    players_per_role
  )
  values(
    v_comp,
    '[{"key":"P","label":"Portiere"},{"key":"D","label":"Difensore"},{"key":"C","label":"Centrocampista"},{"key":"A","label":"Attaccante"}]'::jsonb,
    '{"P":1,"D":1,"C":1,"A":1}'::jsonb
  );

  return v_comp;
end
$function$;

create or replace function public.superadmin_delete_fixture(p_fixture_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_app_admin() then
    raise exception 'Solo superadmin';
  end if;

  delete from public.fixtures
  where id = p_fixture_id;
end
$function$;

create or replace function public.superadmin_get_competitions()
returns table(
  id uuid,
  name text,
  slug text,
  type text,
  theme_key text,
  active boolean,
  visibility_status text,
  default_total_matchdays integer,
  default_top_n integer,
  scope text,
  active_season_id uuid,
  active_season_name text,
  players_count integer,
  teams_count integer
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
    c.theme_key,
    c.active,
    c.visibility_status,
    c.default_total_matchdays,
    c.default_top_n,
    c.scope,
    s.id,
    s.name,
    (
      select count(*)::int
      from public.real_players rp
      where rp.competition_id = c.id
        and rp.active = true
    ),
    (
      select count(distinct rp.team)::int
      from public.real_players rp
      where rp.competition_id = c.id
        and rp.active = true
    )
  from public.competitions c
  left join lateral (
    select s2.id, s2.name
    from public.seasons s2
    where s2.competition_id = c.id
      and s2.active = true
    order by s2.created_at desc
    limit 1
  ) s on true
  where public.is_app_admin()
  order by c.name;
$function$;

create or replace function public.superadmin_get_fixtures(
  p_competition_id uuid,
  p_season_id uuid,
  p_matchday_number integer
)
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', f.id,
        'home_team_id', f.home_team_id,
        'home_team_name', ht.name,
        'away_team_id', f.away_team_id,
        'away_team_name', aw.name,
        'starts_at', f.starts_at,
        'status', f.status
      )
      order by f.created_at
    ),
    '[]'::jsonb
  )
  from public.fixtures f
  join public.real_teams ht on ht.id = f.home_team_id
  join public.real_teams aw on aw.id = f.away_team_id
  where public.is_app_admin()
    and f.competition_id = p_competition_id
    and f.season_id = p_season_id
    and f.matchday_number = p_matchday_number;
$function$;

create or replace function public.superadmin_get_player_stats(
  p_competition_id uuid,
  p_season_id uuid,
  p_matchday_number integer,
  p_real_player_id uuid
)
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
  select coalesce(
    (
      select jsonb_build_object(
        'goals', ps.goals,
        'assists', ps.assists,
        'yellow', ps.yellow,
        'red', ps.red,
        'goals_conceded', ps.goals_conceded,
        'pen_saved', ps.pen_saved,
        'pen_missed', ps.pen_missed,
        'clean_sheet', ps.clean_sheet
      )
      from public.player_stats ps
      where public.is_app_admin()
        and ps.competition_id = p_competition_id
        and ps.season_id = p_season_id
        and ps.matchday_number = p_matchday_number
        and ps.real_player_id = p_real_player_id
    ),
    '{}'::jsonb
  );
$function$;

create or replace function public.superadmin_get_top_teams(
  p_competition_id uuid,
  p_season_id uuid,
  p_matchday_number integer
)
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'real_team_id', t.real_team_id,
        'team_name', rt.name,
        'rank', t.rank
      )
      order by t.rank nulls last, rt.name
    ),
    '[]'::jsonb
  )
  from public.top_teams t
  join public.real_teams rt on rt.id = t.real_team_id
  where public.is_app_admin()
    and t.competition_id = p_competition_id
    and t.season_id = p_season_id
    and t.matchday_number = p_matchday_number;
$function$;

create or replace function public.superadmin_search_players(
  p_competition_id uuid,
  p_query text default ''
)
returns table(
  id uuid,
  name text,
  role text,
  team text
)
language sql
security definer
set search_path to 'public'
as $function$
  select rp.id, rp.name, rp.role, rp.team
  from public.real_players rp
  where public.is_app_admin()
    and rp.competition_id = p_competition_id
    and rp.active = true
    and (
      coalesce(p_query, '') = ''
      or rp.name ilike '%' || p_query || '%'
      or rp.team ilike '%' || p_query || '%'
    )
  order by rp.name
  limit 50;
$function$;

create or replace function public.superadmin_search_players_for_vote(
  p_competition_id uuid,
  p_query text
)
returns table(
  id uuid,
  name text,
  role text,
  team_name text
)
language sql
security definer
set search_path to 'public'
as $function$
  select rp.id, rp.name, rp.role, rp.team
  from public.real_players rp
  where public.is_app_admin()
    and rp.competition_id = p_competition_id
    and rp.active = true
    and (
      coalesce(p_query, '') = ''
      or rp.name ilike '%' || p_query || '%'
      or rp.team ilike '%' || p_query || '%'
    )
  order by rp.name
  limit 50;
$function$;

create or replace function public.superadmin_search_teams(
  p_competition_id uuid,
  p_query text
)
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', rt.id,
        'name', rt.name,
        'country', rt.country
      )
      order by rt.name
    ),
    '[]'::jsonb
  )
  from public.real_teams rt
  where public.is_app_admin()
    and rt.competition_id = p_competition_id
    and rt.active = true
    and (
      coalesce(p_query, '') = ''
      or rt.name ilike '%' || p_query || '%'
    );
$function$;

create or replace function public.superadmin_set_competition_status(
  p_competition_id uuid,
  p_visibility_status text,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_app_admin() then
    raise exception 'Solo superadmin';
  end if;

  update public.competitions
  set visibility_status = p_visibility_status,
      active = p_active
  where id = p_competition_id;
end
$function$;

create or replace function public.superadmin_upsert_fixture(
  p_competition_id uuid,
  p_season_id uuid,
  p_matchday_number integer,
  p_home_team_id uuid,
  p_away_team_id uuid,
  p_starts_at timestamp with time zone,
  p_status text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_app_admin() then
    raise exception 'Solo superadmin';
  end if;

  if p_home_team_id = p_away_team_id then
    raise exception 'Casa e trasferta non possono essere la stessa squadra';
  end if;

  insert into public.fixtures(
    competition_id,
    season_id,
    matchday_number,
    home_team_id,
    away_team_id,
    starts_at,
    status
  )
  values(
    p_competition_id,
    p_season_id,
    p_matchday_number,
    p_home_team_id,
    p_away_team_id,
    p_starts_at,
    coalesce(p_status, 'scheduled')
  );
end
$function$;

create or replace function public.superadmin_upsert_player_stats(
  p_competition_id uuid,
  p_season_id uuid,
  p_matchday_number integer,
  p_real_player_id uuid,
  p_goals integer default 0,
  p_assists integer default 0,
  p_yellow integer default 0,
  p_red integer default 0,
  p_pen_missed integer default 0,
  p_pen_saved integer default 0,
  p_goals_conceded integer default 0,
  p_clean_sheet boolean default false
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if not public.is_app_admin() then
    raise exception 'Solo superadmin';
  end if;

  insert into public.player_stats(
    competition_id,
    season_id,
    matchday_number,
    real_player_id,
    goals,
    assists,
    yellow,
    red,
    pen_missed,
    pen_saved,
    goals_conceded,
    clean_sheet,
    updated_at
  )
  values(
    p_competition_id,
    p_season_id,
    p_matchday_number,
    p_real_player_id,
    p_goals,
    p_assists,
    p_yellow,
    p_red,
    p_pen_missed,
    p_pen_saved,
    p_goals_conceded,
    p_clean_sheet,
    now()
  )
  on conflict (competition_id, season_id, matchday_number, real_player_id)
  do update set
    goals = excluded.goals,
    assists = excluded.assists,
    yellow = excluded.yellow,
    red = excluded.red,
    pen_missed = excluded.pen_missed,
    pen_saved = excluded.pen_saved,
    goals_conceded = excluded.goals_conceded,
    clean_sheet = excluded.clean_sheet,
    updated_at = now()
  returning id into v_id;

  return v_id;
end
$function$;

create or replace function public.superadmin_upsert_top_team(
  p_competition_id uuid,
  p_season_id uuid,
  p_matchday_number integer,
  p_real_team_id uuid,
  p_rank integer
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_app_admin() then
    raise exception 'Solo superadmin';
  end if;

  if not exists(
    select 1
    from public.real_teams
    where id = p_real_team_id
      and competition_id = p_competition_id
  ) then
    raise exception 'Squadra non valida per questa competizione';
  end if;

  delete from public.top_teams
  where competition_id = p_competition_id
    and season_id = p_season_id
    and matchday_number = p_matchday_number
    and (
      real_team_id = p_real_team_id
      or rank = p_rank
    );

  insert into public.top_teams(
    competition_id,
    season_id,
    matchday_number,
    real_team_id,
    rank
  )
  values(
    p_competition_id,
    p_season_id,
    p_matchday_number,
    p_real_team_id,
    p_rank
  );
end
$function$;

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        p.proname like 'superadmin_%'
        or p.proname in ('is_app_admin', 'is_current_user_superadmin')
      )
  loop
    execute format('revoke execute on function %s from public', r.fn);
    execute format('revoke execute on function %s from anon', r.fn);
    execute format('grant execute on function %s to authenticated', r.fn);
  end loop;
end $$;

