-- FantaChat - statistics matchday ordering and empty-day fallback
--
-- Shows matchdays from the first to the latest useful one and keeps the
-- player list populated with zero values when a matchday has no imported stats.

create or replace function public.get_player_stats_matchdays(
  p_league_competition_id uuid
)
returns table(
  matchday_number integer,
  status text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lc record;
begin
  select competition_id, season_id, league_id
    into v_lc
  from public.league_competitions
  where id = p_league_competition_id;

  if v_lc.league_id is null or not public.is_league_member(v_lc.league_id) then
    raise exception 'Accesso negato';
  end if;

  return query
  select md.number, md.status
  from public.matchdays md
  where md.season_id = v_lc.season_id
    and (
      md.status in ('open', 'completed', 'locked')
      or exists (
        select 1
        from public.player_stats ps
        where ps.competition_id = v_lc.competition_id
          and ps.season_id = v_lc.season_id
          and ps.matchday_number = md.number
      )
      or exists (
        select 1
        from public.lineups li
        where li.league_competition_id = p_league_competition_id
          and li.matchday_id = md.id
      )
    )
  order by md.number asc;
end;
$function$;

create or replace function public.get_player_stats_by_matchday(
  p_league_competition_id uuid,
  p_matchday_number integer
)
returns table(
  player_id uuid,
  player_name text,
  team_name text,
  image_url text,
  role text,
  played_count integer,
  avg_points numeric,
  total_points numeric,
  best_points numeric,
  worst_points numeric
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lc record;
begin
  select competition_id, season_id, scoring_ruleset, league_id
    into v_lc
  from public.league_competitions
  where id = p_league_competition_id;

  if v_lc.league_id is null or not public.is_league_member(v_lc.league_id) then
    raise exception 'Accesso negato';
  end if;

  return query
  with player_catalog as (
    select
      rp.id,
      rp.name,
      coalesce(rt.name, rp.team) as team_name,
      coalesce(rp.image_url, rt.logo_url) as image_url,
      rp.role
    from public.real_players rp
    left join public.real_teams rt on rt.id = rp.real_team_id
    where rp.competition_id = v_lc.competition_id
      and coalesce(rp.active, true)
  ),
  pts as (
    select
      pc.id as real_player_id,
      public.compute_player_points_v2(
        v_lc.scoring_ruleset,
        pc.role,
        coalesce(ps.goals, 0),
        coalesce(ps.assists, 0),
        coalesce(ps.yellow, 0),
        coalesce(ps.red, 0),
        coalesce(ps.pen_missed, 0),
        coalesce(ps.pen_saved, 0),
        coalesce(ps.goals_conceded, 0),
        coalesce(ps.clean_sheet, false),
        ps.xg,
        ps.xa,
        coalesce(ps.passes_completed, 0),
        ps.pass_accuracy,
        coalesce(ps.tackles, 0),
        coalesce(ps.interceptions, 0),
        ps.npxg,
        coalesce(ps.saves, 0),
        ps.save_pct
      )::numeric as points,
      ps.id as stat_id
    from player_catalog pc
    left join public.player_stats ps
      on ps.real_player_id = pc.id
     and ps.competition_id = v_lc.competition_id
     and ps.season_id = v_lc.season_id
     and ps.matchday_number = p_matchday_number
  )
  select
    pc.id,
    pc.name,
    pc.team_name,
    pc.image_url,
    pc.role,
    case when pts.stat_id is null then 0 else 1 end::integer,
    coalesce(round(pts.points, 2), 0::numeric),
    coalesce(pts.points, 0::numeric),
    coalesce(pts.points, 0::numeric),
    coalesce(pts.points, 0::numeric)
  from player_catalog pc
  left join pts on pts.real_player_id = pc.id
  order by coalesce(pts.points, 0::numeric) desc, pc.role, pc.name;
end;
$function$;

revoke execute on function public.get_player_stats_matchdays(uuid) from public, anon;
revoke execute on function public.get_player_stats_by_matchday(uuid, integer) from public, anon;

grant execute on function public.get_player_stats_matchdays(uuid) to authenticated;
grant execute on function public.get_player_stats_by_matchday(uuid, integer) to authenticated;
