-- FantaChat - non standard scoring
--
-- Ruleset name: non_standard
--
-- Keeps existing classico/pro behavior and adds the extra statistics needed
-- for the non standard scoring model.

alter table public.player_stats
  add column if not exists passes_completed integer not null default 0,
  add column if not exists pass_accuracy numeric,
  add column if not exists tackles integer not null default 0,
  add column if not exists interceptions integer not null default 0,
  add column if not exists npxg numeric,
  add column if not exists saves integer not null default 0,
  add column if not exists save_pct numeric;

create or replace function public.compute_player_points_v2(
  p_ruleset text,
  p_role text,
  p_goals integer,
  p_assists integer,
  p_yellow integer,
  p_red integer,
  p_pen_missed integer,
  p_pen_saved integer,
  p_goals_conceded integer,
  p_clean_sheet boolean,
  p_xg numeric default null,
  p_xa numeric default null,
  p_passes_completed integer default 0,
  p_pass_accuracy numeric default null,
  p_tackles integer default 0,
  p_interceptions integer default 0,
  p_npxg numeric default null,
  p_saves integer default 0,
  p_save_pct numeric default null
)
returns numeric
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  v_ruleset text := coalesce(p_ruleset, 'classico');
  v_role text := upper(coalesce(p_role, ''));
  v_points numeric;
  v_pass_accuracy numeric;
  v_save_pct numeric;
begin
  v_points := public.compute_player_points(
    v_role,
    coalesce(p_goals, 0),
    coalesce(p_assists, 0),
    coalesce(p_yellow, 0),
    coalesce(p_red, 0),
    coalesce(p_pen_missed, 0),
    coalesce(p_pen_saved, 0),
    coalesce(p_goals_conceded, 0),
    coalesce(p_clean_sheet, false)
  );

  if v_ruleset = 'pro' then
    return v_points + public.compute_extra_points(v_ruleset, v_role, p_xg, p_xa);
  end if;

  if v_ruleset not in ('non_standard', 'nonstandard', 'statistico') then
    return v_points;
  end if;

  v_pass_accuracy := case
    when p_pass_accuracy is null then null
    when p_pass_accuracy <= 1 then p_pass_accuracy * 100
    else p_pass_accuracy
  end;

  v_save_pct := case
    when p_save_pct is not null and p_save_pct <= 1 then p_save_pct * 100
    when p_save_pct is not null then p_save_pct
    when coalesce(p_saves, 0) + coalesce(p_goals_conceded, 0) > 0
      then (coalesce(p_saves, 0)::numeric / (coalesce(p_saves, 0) + coalesce(p_goals_conceded, 0))::numeric) * 100
    else null
  end;

  v_points :=
    v_points
    + coalesce(p_passes_completed, 0) * 0.005
    + case when coalesce(p_passes_completed, 0) >= 20 and coalesce(v_pass_accuracy, 0) > 85 then 0.3 else 0 end
    + coalesce(p_tackles, 0) * 0.10
    + coalesce(p_interceptions, 0) * 0.10
    + coalesce(p_npxg, p_xg, 0)
    + coalesce(p_xa, 0);

  if v_role = 'P' then
    v_points :=
      v_points
      + case when coalesce(v_save_pct, 0) > 80 then 0.5 else 0 end
      + case when coalesce(v_save_pct, 0) > 80 and coalesce(p_saves, 0) >= 5 then 1 else 0 end;
  end if;

  return round(v_points, 3);
end;
$function$;

create or replace function public.set_scoring_ruleset(
  p_league_competition_id uuid,
  p_ruleset text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_league_id uuid;
  v_ruleset text := coalesce(p_ruleset, 'classico');
begin
  select league_id
    into v_league_id
  from public.league_competitions
  where id = p_league_competition_id;

  if v_league_id is null then
    raise exception 'Competizione non valida';
  end if;

  if not public.is_league_admin(v_league_id) then
    raise exception 'Solo admin lega';
  end if;

  if v_ruleset not in ('classico', 'pro', 'non_standard') then
    raise exception 'Ruleset non valido';
  end if;

  update public.league_competitions
  set scoring_ruleset = v_ruleset
  where id = p_league_competition_id;
end;
$function$;

create or replace function public.recalc_competition_matchday(
  p_league_competition_id uuid,
  p_matchday_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_comp uuid;
  v_season uuid;
  v_mdnum int;
  v_ruleset text;
begin
  select competition_id, season_id, scoring_ruleset
    into v_comp, v_season, v_ruleset
  from public.league_competitions
  where id = p_league_competition_id;

  select number into v_mdnum
  from public.matchdays
  where id = p_matchday_id;

  if v_comp is null or v_mdnum is null then
    raise exception 'Competizione o giornata non valida';
  end if;

  delete from public.scores
  where lineup_id in (
    select id
    from public.lineups
    where league_competition_id = p_league_competition_id
      and matchday_id = p_matchday_id
  );

  insert into public.scores(lineup_id, real_player_id, role, points)
  select
    li.id,
    lp.real_player_id,
    lp.role,
    public.compute_player_points_v2(
      v_ruleset,
      lp.role,
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
    )
  from public.lineups li
  join public.lineup_players lp on lp.lineup_id = li.id
  left join public.player_stats ps
    on ps.real_player_id = lp.real_player_id
   and ps.competition_id = v_comp
   and ps.season_id = v_season
   and ps.matchday_number = v_mdnum
  where li.league_competition_id = p_league_competition_id
    and li.matchday_id = p_matchday_id;

  update public.competition_standings cs
  set total_points = t.tot,
      updated_at = now()
  from (
    select lcm.user_id, coalesce(sum(s.points), 0) as tot
    from public.league_competition_members lcm
    left join public.lineups li
      on li.league_competition_id = p_league_competition_id
     and li.user_id = lcm.user_id
    left join public.scores s on s.lineup_id = li.id
    where lcm.league_competition_id = p_league_competition_id
    group by lcm.user_id
  ) t
  where cs.league_competition_id = p_league_competition_id
    and cs.user_id = t.user_id;

  insert into public.competition_standings(
    league_competition_id,
    user_id,
    team_name,
    total_points,
    rank
  )
  select
    p_league_competition_id,
    lcm.user_id,
    coalesce(lcm.team_name, 'Squadra'),
    coalesce((
      select sum(s.points)
      from public.lineups li
      join public.scores s on s.lineup_id = li.id
      where li.league_competition_id = p_league_competition_id
        and li.user_id = lcm.user_id
    ), 0),
    0
  from public.league_competition_members lcm
  where lcm.league_competition_id = p_league_competition_id
    and not exists (
      select 1
      from public.competition_standings cs
      where cs.league_competition_id = p_league_competition_id
        and cs.user_id = lcm.user_id
    );

  with r as (
    select user_id, row_number() over(order by total_points desc, team_name) as rnk
    from public.competition_standings
    where league_competition_id = p_league_competition_id
  )
  update public.competition_standings cs
  set rank = r.rnk
  from r
  where cs.league_competition_id = p_league_competition_id
    and cs.user_id = r.user_id;
end;
$function$;

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
  with pts as (
    select
      ps.real_player_id,
      rp.name,
      rp.team,
      rp.role,
      public.compute_player_points_v2(
        v_lc.scoring_ruleset,
        rp.role,
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
    from public.player_stats ps
    join public.real_players rp on rp.id = ps.real_player_id
    where ps.competition_id = v_lc.competition_id
      and ps.season_id = v_lc.season_id
  )
  select
    pts.real_player_id,
    pts.name,
    pts.team,
    pts.role,
    count(*)::int,
    coalesce(round(avg(pts.points), 2), 0),
    coalesce(sum(pts.points), 0),
    coalesce(max(pts.points), 0),
    coalesce(min(pts.points), 0)
  from pts
  group by pts.real_player_id, pts.name, pts.team, pts.role
  order by avg(pts.points) desc nulls last;
end;
$function$;

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

  select rp.name, rp.role, rp.team
    into v_name, v_role, v_team
  from public.real_players rp
  where rp.id = p_real_player_id;

  with pts as (
    select
      ps.matchday_number,
      public.compute_player_points_v2(
        v_lc.scoring_ruleset,
        v_role,
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
    from public.player_stats ps
    where ps.real_player_id = p_real_player_id
      and ps.competition_id = v_lc.competition_id
      and ps.season_id = v_lc.season_id
  )
  select
    coalesce(round(avg(points), 2), 0),
    coalesce(max(points), 0),
    coalesce(min(points), 0),
    coalesce(
      jsonb_agg(
        jsonb_build_object('matchday_number', matchday_number, 'points', points)
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
    'avg_points', v_avg,
    'best_points', v_best,
    'worst_points', v_worst,
    'history', v_hist
  );
end;
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
        'clean_sheet', ps.clean_sheet,
        'xg', ps.xg,
        'xa', ps.xa,
        'passes_completed', ps.passes_completed,
        'pass_accuracy', ps.pass_accuracy,
        'tackles', ps.tackles,
        'interceptions', ps.interceptions,
        'npxg', ps.npxg,
        'saves', ps.saves,
        'save_pct', ps.save_pct
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

drop function if exists public.superadmin_upsert_player_stats(
  uuid,
  uuid,
  integer,
  uuid,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  boolean
);

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
  p_clean_sheet boolean default false,
  p_xg numeric default null,
  p_xa numeric default null,
  p_passes_completed integer default 0,
  p_pass_accuracy numeric default null,
  p_tackles integer default 0,
  p_interceptions integer default 0,
  p_npxg numeric default null,
  p_saves integer default 0,
  p_save_pct numeric default null
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
    xg,
    xa,
    passes_completed,
    pass_accuracy,
    tackles,
    interceptions,
    npxg,
    saves,
    save_pct,
    updated_at
  )
  values(
    p_competition_id,
    p_season_id,
    p_matchday_number,
    p_real_player_id,
    coalesce(p_goals, 0),
    coalesce(p_assists, 0),
    coalesce(p_yellow, 0),
    coalesce(p_red, 0),
    coalesce(p_pen_missed, 0),
    coalesce(p_pen_saved, 0),
    coalesce(p_goals_conceded, 0),
    coalesce(p_clean_sheet, false),
    p_xg,
    p_xa,
    coalesce(p_passes_completed, 0),
    p_pass_accuracy,
    coalesce(p_tackles, 0),
    coalesce(p_interceptions, 0),
    p_npxg,
    coalesce(p_saves, 0),
    p_save_pct,
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
    xg = excluded.xg,
    xa = excluded.xa,
    passes_completed = excluded.passes_completed,
    pass_accuracy = excluded.pass_accuracy,
    tackles = excluded.tackles,
    interceptions = excluded.interceptions,
    npxg = excluded.npxg,
    saves = excluded.saves,
    save_pct = excluded.save_pct,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$function$;

revoke execute on function public.compute_player_points_v2(text, text, integer, integer, integer, integer, integer, integer, integer, boolean, numeric, numeric, integer, numeric, integer, integer, numeric, integer, numeric) from public, anon;
revoke execute on function public.set_scoring_ruleset(uuid, text) from public, anon;
revoke execute on function public.superadmin_upsert_player_stats(uuid, uuid, integer, uuid, integer, integer, integer, integer, integer, integer, integer, boolean, numeric, numeric, integer, numeric, integer, integer, numeric, integer, numeric) from public, anon;

grant execute on function public.compute_player_points_v2(text, text, integer, integer, integer, integer, integer, integer, integer, boolean, numeric, numeric, integer, numeric, integer, integer, numeric, integer, numeric) to authenticated;
grant execute on function public.set_scoring_ruleset(uuid, text) to authenticated;
grant execute on function public.superadmin_upsert_player_stats(uuid, uuid, integer, uuid, integer, integer, integer, integer, integer, integer, integer, boolean, numeric, numeric, integer, numeric, integer, integer, numeric, integer, numeric) to authenticated;
