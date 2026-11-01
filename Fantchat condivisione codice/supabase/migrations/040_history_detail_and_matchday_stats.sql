-- FantaChat - history detail and matchday player stats
--
-- Makes the history detail independent from precomputed summary tables and
-- exposes per-matchday player stats for the statistics page.

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
      md.status in ('open', 'completed', 'locked', 'closed')
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
  order by md.number desc;
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
      ) as points,
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
    coalesce(round(pts.points, 2), 0),
    coalesce(pts.points, 0),
    coalesce(pts.points, 0),
    coalesce(pts.points, 0)
  from player_catalog pc
  left join pts on pts.real_player_id = pc.id
  order by coalesce(pts.points, 0) desc, pc.role, pc.name;
end;
$function$;

create or replace function public.get_matchday_detail(
  p_matchday_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_matchday record;
  v_lc record;
begin
  select *
    into v_matchday
  from public.matchdays
  where id = p_matchday_id;

  if v_matchday.id is null then
    return jsonb_build_object('matchday_number', null, 'rows', '[]'::jsonb);
  end if;

  select lc.*
    into v_lc
  from public.league_competitions lc
  join public.user_context uc
    on uc.active_league_competition_id = lc.id
   and uc.user_id = auth.uid()
  where lc.season_id = v_matchday.season_id
    and public.is_league_member(lc.league_id)
  limit 1;

  if v_lc.id is null then
    select lc.*
      into v_lc
    from public.league_competitions lc
    where lc.season_id = v_matchday.season_id
      and public.is_league_member(lc.league_id)
    order by lc.created_at desc
    limit 1;
  end if;

  if v_lc.id is null then
    raise exception 'Accesso negato';
  end if;

  return jsonb_build_object(
    'matchday_number', v_matchday.number,
    'rows', coalesce((
      with lineup_scores as (
        select
          li.id as lineup_id,
          li.user_id,
          coalesce((
            select sum(s.points)
            from public.scores s
            where s.lineup_id = li.id
          ), 0) + coalesce((
            select sum(lcoach.points)
            from public.lineup_coaches lcoach
            where lcoach.lineup_id = li.id
          ), 0) as total_score
        from public.lineups li
        where li.league_competition_id = v_lc.id
          and li.matchday_id = p_matchday_id
          and li.submitted_at is not null
      ),
      base as (
        select
          lcm.user_id,
          coalesce(lcm.team_name, 'Squadra') as team_name,
          ls.lineup_id,
          coalesce(ls.total_score, 0) as total_score
        from public.league_competition_members lcm
        left join lineup_scores ls on ls.user_id = lcm.user_id
        where lcm.league_competition_id = v_lc.id
      ),
      ranked as (
        select
          base.*,
          row_number() over(order by base.total_score desc, base.team_name) as rank
        from base
      )
      select jsonb_agg(
        jsonb_build_object(
          'user_id', r.user_id,
          'team_name', r.team_name,
          'total_score', r.total_score,
          'rank', r.rank,
          'players', coalesce((
            select jsonb_agg(z.item order by z.role_order, z.name)
            from (
              select
                case lp.role when 'P' then 1 when 'D' then 2 when 'C' then 3 when 'A' then 4 else 9 end as role_order,
                coalesce(rp.name, '') as name,
                jsonb_build_object(
                  'role', lp.role,
                  'name', rp.name,
                  'team', coalesce(rt.name, rp.team),
                  'points', sc.points,
                  'image_url', coalesce(rp.image_url, rt.logo_url)
                ) as item
              from public.lineup_players lp
              join public.real_players rp on rp.id = lp.real_player_id
              left join public.real_teams rt on rt.id = rp.real_team_id
              left join public.scores sc
                on sc.lineup_id = lp.lineup_id
               and sc.real_player_id = lp.real_player_id
              where lp.lineup_id = r.lineup_id

              union all

              select
                0 as role_order,
                coalesce(rc.name, '') as name,
                jsonb_build_object(
                  'role', 'AL',
                  'name', rc.name,
                  'team', rt.name,
                  'points', lc.points,
                  'image_url', coalesce(rc.image_url, rt.logo_url)
                ) as item
              from public.lineup_coaches lc
              join public.real_coaches rc on rc.id = lc.real_coach_id
              join public.real_teams rt on rt.id = rc.real_team_id
              where lc.lineup_id = r.lineup_id
            ) z
          ), '[]'::jsonb)
        )
        order by r.rank
      )
      from ranked r
    ), '[]'::jsonb)
  );
end;
$function$;

revoke execute on function public.get_player_stats_matchdays(uuid) from public, anon;
revoke execute on function public.get_player_stats_by_matchday(uuid, integer) from public, anon;
revoke execute on function public.get_matchday_detail(uuid) from public, anon;

grant execute on function public.get_player_stats_matchdays(uuid) to authenticated;
grant execute on function public.get_player_stats_by_matchday(uuid, integer) to authenticated;
grant execute on function public.get_matchday_detail(uuid) to authenticated;
