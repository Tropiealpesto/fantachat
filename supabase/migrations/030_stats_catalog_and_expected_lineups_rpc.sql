-- FantaChat - stats catalog and expected lineups read models
--
-- Stats must be useful before the first match: return every active player in
-- the competition, with zeroed aggregates when no stats exist yet.

create or replace function public.get_player_stats(
  p_league_competition_id uuid
)
returns table(
  player_id uuid,
  player_name text,
  team_name text,
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
      ) as points
    from player_catalog pc
    join public.player_stats ps
      on ps.real_player_id = pc.id
     and ps.competition_id = v_lc.competition_id
     and ps.season_id = v_lc.season_id
  )
  select
    pc.id,
    pc.name,
    pc.team_name,
    pc.role,
    count(pts.points)::integer,
    coalesce(round(avg(pts.points), 2), 0),
    coalesce(sum(pts.points), 0),
    coalesce(max(pts.points), 0),
    coalesce(min(pts.points), 0)
  from player_catalog pc
  left join pts on pts.real_player_id = pc.id
  group by pc.id, pc.name, pc.team_name, pc.role
  order by
    count(pts.points) desc,
    coalesce(round(avg(pts.points), 2), 0) desc,
    pc.role,
    pc.name;
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
  select league_id, competition_id, season_id
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
        and f.season_id = v_lc.season_id
        and f.matchday_number = p_matchday_number
    ), '[]'::jsonb),
    'expected_lineups', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'fixture_id', fel.fixture_id,
          'fixture_name', coalesce(f.name, 'Partita'),
          'starts_at', f.starts_at,
          'team_name', coalesce(rt.name, 'Squadra'),
          'player_name', fel.player_name,
          'role', fel.role,
          'status', fel.lineup_status
        )
        order by f.starts_at nulls last, rt.name, fel.lineup_status desc, fel.formation_position nulls last, fel.player_name
      )
      from public.fixture_expected_lineups fel
      left join public.fixtures f on f.id = fel.fixture_id
      left join public.real_teams rt on rt.id = fel.real_team_id
      where fel.competition_id = v_lc.competition_id
        and fel.season_id = v_lc.season_id
        and fel.matchday_number = p_matchday_number
    ), '[]'::jsonb)
  );
end;
$function$;

revoke execute on function public.get_player_stats(uuid) from public, anon;
revoke execute on function public.get_lineup_context_data(uuid, integer) from public, anon;

grant execute on function public.get_player_stats(uuid) to authenticated;
grant execute on function public.get_lineup_context_data(uuid, integer) to authenticated;
