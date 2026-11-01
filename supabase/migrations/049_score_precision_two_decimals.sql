-- FantaChat - canonical score precision
--
-- Statistical components are calculated and stored at two decimals. The UI may
-- display the final FantaChat score at one decimal, but never rounds each line
-- before summing the player score.

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
    return round(v_points + public.compute_extra_points(v_ruleset, v_role, p_xg, p_xa), 2);
  end if;

  if v_ruleset not in ('non_standard', 'nonstandard', 'statistico') then
    return round(v_points, 2);
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
      then (coalesce(p_saves, 0)::numeric / (coalesce(p_saves, 0) + coalesce(p_goals_conceded, 0)::numeric)) * 100
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

  return round(v_points, 2);
end;
$function$;

create or replace function public.compute_coach_points(
  p_result text,
  p_npxg numeric,
  p_possession numeric,
  p_multiplier numeric default 1
)
returns numeric
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  v_possession numeric;
  v_points numeric;
begin
  v_possession := case
    when p_possession is null then 0
    when p_possession <= 1 then p_possession * 100
    else p_possession
  end;

  v_points :=
    case p_result
      when 'win' then 1
      when 'loss' then -1
      else 0
    end
    + coalesce(p_npxg, 0)
    + case when v_possession >= 60 then 0.5 else 0 end;

  v_points := least(3, greatest(-1, v_points));
  return round(v_points * coalesce(p_multiplier, 0), 2);
end;
$function$;

do $backfill$
begin
  -- Some environments do not yet have the aggregate tables. The function
  -- definitions above must still be deployable there.
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
    execute 'update public.competition_standings
      set total_points = round(total_points, 2)';

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'competition_standings' and column_name = 'p_total') then
      execute 'update public.competition_standings set p_total = round(p_total, 2)';
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'competition_standings' and column_name = 'd_total') then
      execute 'update public.competition_standings set d_total = round(d_total, 2)';
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'competition_standings' and column_name = 'c_total') then
      execute 'update public.competition_standings set c_total = round(c_total, 2)';
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'competition_standings' and column_name = 'a_total') then
      execute 'update public.competition_standings set a_total = round(a_total, 2)';
    end if;
  end if;
end
$backfill$;

revoke execute on function public.compute_player_points_v2(text, text, integer, integer, integer, integer, integer, integer, integer, boolean, numeric, numeric, integer, numeric, integer, integer, numeric, integer, numeric) from public, anon;
grant execute on function public.compute_player_points_v2(text, text, integer, integer, integer, integer, integer, integer, integer, boolean, numeric, numeric, integer, numeric, integer, integer, numeric, integer, numeric) to authenticated;

revoke execute on function public.compute_coach_points(text, numeric, numeric, numeric) from public, anon;
grant execute on function public.compute_coach_points(text, numeric, numeric, numeric) to authenticated;
