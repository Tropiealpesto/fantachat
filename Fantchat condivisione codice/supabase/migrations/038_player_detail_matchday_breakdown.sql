-- Adds raw matchday stats to the player detail payload so the app can show
-- exactly how each daily score is built.

create or replace function public.get_player_detail(
  p_real_player_id uuid,
  p_league_competition_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lc record;
  v_name text;
  v_role text;
  v_team text;
  v_image_url text;
  v_avg numeric;
  v_best numeric;
  v_worst numeric;
  v_hist jsonb;
begin
  select competition_id, season_id, scoring_ruleset, league_id
    into v_lc
  from public.league_competitions
  where id = p_league_competition_id;

  if v_lc.league_id is null or not public.is_league_member(v_lc.league_id) then
    raise exception 'Accesso negato';
  end if;

  select rp.name, rp.role, coalesce(rt.name, rp.team), coalesce(rp.image_url, rt.logo_url)
    into v_name, v_role, v_team, v_image_url
  from public.real_players rp
  left join public.real_teams rt on rt.id = rp.real_team_id
  where rp.id = p_real_player_id
    and rp.competition_id = v_lc.competition_id;

  if v_name is null then
    return null;
  end if;

  with stats as (
    select
      ps.matchday_number,
      coalesce(ps.goals, 0) as goals,
      coalesce(ps.assists, 0) as assists,
      coalesce(ps.yellow, 0) as yellow,
      coalesce(ps.red, 0) as red,
      coalesce(ps.pen_missed, 0) as pen_missed,
      coalesce(ps.pen_saved, 0) as pen_saved,
      coalesce(ps.goals_conceded, 0) as goals_conceded,
      coalesce(ps.clean_sheet, false) as clean_sheet,
      ps.xg,
      ps.xa,
      coalesce(ps.passes_completed, 0) as passes_completed,
      ps.pass_accuracy,
      coalesce(ps.tackles, 0) as tackles,
      coalesce(ps.interceptions, 0) as interceptions,
      ps.npxg,
      coalesce(ps.saves, 0) as saves,
      ps.save_pct
    from public.player_stats ps
    where ps.real_player_id = p_real_player_id
      and ps.competition_id = v_lc.competition_id
      and ps.season_id = v_lc.season_id
  ),
  pts as (
    select
      stats.*,
      public.compute_player_points_v2(
        v_lc.scoring_ruleset,
        v_role,
        goals,
        assists,
        yellow,
        red,
        pen_missed,
        pen_saved,
        goals_conceded,
        clean_sheet,
        xg,
        xa,
        passes_completed,
        pass_accuracy,
        tackles,
        interceptions,
        npxg,
        saves,
        save_pct
      ) as points
    from stats
  )
  select
    coalesce(round(avg(points), 2), 0),
    coalesce(max(points), 0),
    coalesce(min(points), 0),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'matchday_number', matchday_number,
          'points', points,
          'goals', goals,
          'assists', assists,
          'yellow', yellow,
          'red', red,
          'pen_missed', pen_missed,
          'pen_saved', pen_saved,
          'goals_conceded', goals_conceded,
          'clean_sheet', clean_sheet,
          'xg', xg,
          'xa', xa,
          'passes_completed', passes_completed,
          'pass_accuracy', pass_accuracy,
          'tackles', tackles,
          'interceptions', interceptions,
          'npxg', npxg,
          'saves', saves,
          'save_pct', save_pct
        )
        order by matchday_number
      ),
      '[]'::jsonb
    )
  into v_avg, v_best, v_worst, v_hist
  from pts;

  return jsonb_build_object(
    'player_name', v_name,
    'role', v_role,
    'team_name', v_team,
    'image_url', v_image_url,
    'scoring_ruleset', v_lc.scoring_ruleset,
    'avg_points', v_avg,
    'best_points', v_best,
    'worst_points', v_worst,
    'history', v_hist
  );
end;
$function$;

revoke execute on function public.get_player_detail(uuid, uuid) from public, anon;
grant execute on function public.get_player_detail(uuid, uuid) to authenticated;
