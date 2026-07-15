-- FantaChat - reduce direct client table reads
--
-- Centralizes small read models used by the mobile UI behind guarded RPCs.

drop function if exists public.get_league_members(uuid);

create or replace function public.get_league_members(
  p_league_id uuid
)
returns table(
  user_id uuid,
  team_name text,
  role text,
  color_primary text,
  color_secondary text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_league_id is null or not public.is_league_member(p_league_id) then
    raise exception 'Accesso negato';
  end if;

  return query
  select
    lm.user_id,
    lm.team_name,
    coalesce(lm.role, 'player'),
    lm.color_primary,
    lm.color_secondary
  from public.league_members lm
  where lm.league_id = p_league_id
  order by lm.team_name;
end;
$function$;

create or replace function public.get_league_competitions(
  p_league_id uuid
)
returns table(
  id uuid,
  name text,
  competition_type text,
  competition_slug text,
  season_name text,
  matchday_number integer,
  is_active boolean
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if p_league_id is null or not public.is_league_member(p_league_id) then
    raise exception 'Accesso negato';
  end if;

  return query
  select
    lc.id,
    coalesce(lc.name, c.name),
    c.type,
    c.slug,
    s.name,
    (
      select max(m.number)
      from public.matchdays m
      where m.season_id = lc.season_id
    )::integer,
    uc.active_league_competition_id = lc.id
  from public.league_competitions lc
  join public.competitions c on c.id = lc.competition_id
  join public.seasons s on s.id = lc.season_id
  left join public.user_context uc on uc.user_id = auth.uid()
  where lc.league_id = p_league_id
    and lc.status = 'active'
    and (
      exists (
        select 1
        from public.league_competition_members lcm
        where lcm.league_competition_id = lc.id
          and lcm.user_id = auth.uid()
      )
      or not exists (
        select 1
        from public.league_competition_members any_lcm
        where any_lcm.league_competition_id = lc.id
      )
    )
  order by lc.created_at;
end;
$function$;

create or replace function public.get_league_competition_rules(
  p_league_competition_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lc record;
begin
  select league_id, scoring_ruleset, coach_enabled
    into v_lc
  from public.league_competitions
  where id = p_league_competition_id
    and status = 'active';

  if v_lc.league_id is null or not public.is_league_member(v_lc.league_id) then
    raise exception 'Accesso negato';
  end if;

  return jsonb_build_object(
    'scoring_ruleset', coalesce(v_lc.scoring_ruleset, 'classico'),
    'coach_enabled', coalesce(v_lc.coach_enabled, false)
  );
end;
$function$;

create or replace function public.get_lineup_context_data(
  p_league_competition_id uuid,
  p_matchday_number integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lc record;
begin
  select league_id, competition_id
    into v_lc
  from public.league_competitions
  where id = p_league_competition_id
    and status = 'active';

  if v_lc.league_id is null or not public.is_league_member(v_lc.league_id) then
    raise exception 'Accesso negato';
  end if;

  return jsonb_build_object(
    'top_teams', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'rank', tt.rank,
          'name', rt.name
        )
        order by tt.rank
      )
      from public.top_teams tt
      join public.real_teams rt on rt.id = tt.real_team_id
      where tt.competition_id = v_lc.competition_id
        and tt.matchday_number = p_matchday_number
    ), '[]'::jsonb),
    'fixtures', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'home', home.name,
          'away', away.name,
          'status', f.status
        )
        order by f.starts_at nulls last, home.name, away.name
      )
      from public.fixtures f
      join public.real_teams home on home.id = f.home_team_id
      join public.real_teams away on away.id = f.away_team_id
      where f.competition_id = v_lc.competition_id
        and f.matchday_number = p_matchday_number
    ), '[]'::jsonb)
  );
end;
$function$;

revoke execute on function public.get_league_members(uuid) from public, anon;
revoke execute on function public.get_league_competitions(uuid) from public, anon;
revoke execute on function public.get_league_competition_rules(uuid) from public, anon;
revoke execute on function public.get_lineup_context_data(uuid, integer) from public, anon;

grant execute on function public.get_league_members(uuid) to authenticated;
grant execute on function public.get_league_competitions(uuid) to authenticated;
grant execute on function public.get_league_competition_rules(uuid) to authenticated;
grant execute on function public.get_lineup_context_data(uuid, integer) to authenticated;
