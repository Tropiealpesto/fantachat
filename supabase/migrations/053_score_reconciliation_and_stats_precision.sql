-- FantaChat - score reconciliation and stats precision
--
-- The scoring engine stores components at two decimals. The final FantaChat
-- score is formatted at one decimal only in the client. This migration makes
-- aggregate read models follow the same contract and safely repairs databases
-- where an earlier precision migration was only partially applied.

do $backfill$
declare
  v_column text;
begin
  if to_regclass('public.scores') is not null then
    execute 'update public.scores set points = round(points, 2) where points is not null';
  end if;

  if to_regclass('public.lineup_coaches') is not null then
    execute 'update public.lineup_coaches set points = round(points, 2) where points is not null';
  end if;

  if to_regclass('public.matchday_team_scores') is not null then
    execute 'update public.matchday_team_scores
      set total_score = round(total_score, 2),
          p_score = round(p_score, 2),
          d_score = round(d_score, 2),
          c_score = round(c_score, 2),
          a_score = round(a_score, 2)';
  end if;

  if to_regclass('public.competition_standings') is not null then
    execute 'update public.competition_standings set total_points = round(total_points, 2)';

    foreach v_column in array['p_total', 'd_total', 'c_total', 'a_total'] loop
      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'competition_standings'
          and column_name = v_column
      ) then
        execute format('update public.competition_standings set %I = round(%I, 2)', v_column, v_column);
      end if;
    end loop;
  end if;
end
$backfill$;

do $constraints$
begin
  if to_regclass('public.scores') is not null then
    begin
      alter table public.scores
        add constraint scores_points_two_decimals
        check (points is null or points = round(points, 2));
    exception when duplicate_object then
      null;
    end;
  end if;

  if to_regclass('public.lineup_coaches') is not null then
    begin
      alter table public.lineup_coaches
        add constraint lineup_coaches_points_two_decimals
        check (points is null or points = round(points, 2));
    exception when duplicate_object then
      null;
    end;
  end if;
end
$constraints$;

create or replace function public.get_player_stats(
  p_league_competition_id uuid
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
    pc.image_url,
    pc.role,
    count(pts.points)::integer,
    coalesce(round(avg(pts.points), 2), 0::numeric),
    coalesce(round(sum(pts.points), 2), 0::numeric),
    coalesce(round(max(pts.points), 2), 0::numeric),
    coalesce(round(min(pts.points), 2), 0::numeric)
  from player_catalog pc
  left join pts on pts.real_player_id = pc.id
  group by pc.id, pc.name, pc.team_name, pc.image_url, pc.role
  order by
    count(pts.points) desc,
    coalesce(round(avg(pts.points), 2), 0) desc,
    pc.role,
    pc.name;
end;
$function$;

revoke execute on function public.get_player_stats(uuid) from public, anon;
grant execute on function public.get_player_stats(uuid) to authenticated;
