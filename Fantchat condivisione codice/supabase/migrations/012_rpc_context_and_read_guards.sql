-- FantaChat RPC hardening
-- - Return the real competition type from get_app_context.
-- - Add league membership checks to read RPCs exposed to the client.

create or replace function public.get_app_context()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_league uuid;
  v_lc uuid;
  v_team text;
  v_role text;
  v_league_name text;
  v_comp_id uuid;
  v_comp_name text;
  v_comp_type text;
  v_comp_slug text;
  v_season uuid;
  v_is_admin boolean;
begin
  if v_uid is null then
    return null;
  end if;

  select email into v_email
  from auth.users
  where id = v_uid;

  select active_league_id, active_league_competition_id
    into v_league, v_lc
  from user_context
  where user_id = v_uid;

  if v_league is null then
    select lm.league_id into v_league
    from league_members lm
    join leagues l on l.id = lm.league_id
    where lm.user_id = v_uid
    order by l.created_at
    limit 1;

    if v_league is not null then
      insert into user_context(user_id, active_league_id, updated_at)
      values(v_uid, v_league, now())
      on conflict(user_id) do update
        set active_league_id = excluded.active_league_id,
            updated_at = now();
    end if;
  end if;

  if v_league is null then
    return jsonb_build_object('user_id', v_uid, 'user_email', v_email);
  end if;

  select lm.team_name, lm.role, l.name
    into v_team, v_role, v_league_name
  from league_members lm
  join leagues l on l.id = lm.league_id
  where lm.league_id = v_league
    and lm.user_id = v_uid;

  v_is_admin := is_app_admin();

  if v_lc is not null
     and not exists (
       select 1
       from league_competitions
       where id = v_lc
         and league_id = v_league
         and status = 'active'
     ) then
    v_lc := null;
  end if;

  if v_lc is null then
    select id into v_lc
    from league_competitions
    where league_id = v_league
      and status = 'active'
    order by created_at
    limit 1;

    if v_lc is not null then
      update user_context
      set active_league_competition_id = v_lc,
          updated_at = now()
      where user_id = v_uid;
    end if;
  end if;

  if v_lc is not null then
    select lc.competition_id, lc.season_id, c.name, c.type, c.slug
      into v_comp_id, v_season, v_comp_name, v_comp_type, v_comp_slug
    from league_competitions lc
    join competitions c on c.id = lc.competition_id
    where lc.id = v_lc;
  end if;

  return jsonb_build_object(
    'user_id', v_uid,
    'user_email', v_email,
    'active_league_id', v_league,
    'active_league_competition_id', v_lc,
    'league_name', v_league_name,
    'team_name', v_team,
    'role', case when v_is_admin then 'super_admin' else coalesce(v_role, 'player') end,
    'competition_id', v_comp_id,
    'competition_name', v_comp_name,
    'competition_type', v_comp_type,
    'competition_slug', v_comp_slug,
    'season_id', v_season
  );
end
$function$;

create or replace function public.get_standings(p_league_competition_id uuid)
returns table(
  user_id uuid,
  team_name text,
  total_points numeric,
  rank integer,
  p_total numeric,
  d_total numeric,
  c_total numeric,
  a_total numeric
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_league uuid;
begin
  select league_id into v_league
  from league_competitions
  where id = p_league_competition_id;

  if v_league is null or not is_league_member(v_league) then
    raise exception 'Accesso negato';
  end if;

  return query
  select cs.user_id,
         cs.team_name,
         cs.total_points,
         cs.rank::int,
         coalesce(r.p_total, 0),
         coalesce(r.d_total, 0),
         coalesce(r.c_total, 0),
         coalesce(r.a_total, 0)
  from competition_standings cs
  left join (
    select l.user_id,
           sum(s.points) filter (where s.role = 'P') as p_total,
           sum(s.points) filter (where s.role = 'D') as d_total,
           sum(s.points) filter (where s.role = 'C') as c_total,
           sum(s.points) filter (where s.role = 'A') as a_total
    from lineups l
    join scores s on s.lineup_id = l.id
    where l.league_competition_id = p_league_competition_id
    group by l.user_id
  ) r on r.user_id = cs.user_id
  where cs.league_competition_id = p_league_competition_id
  order by cs.rank nulls last, cs.total_points desc;
end
$function$;

create or replace function public.get_player_stats(p_league_competition_id uuid)
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
  from league_competitions
  where id = p_league_competition_id;

  if v_lc.league_id is null or not is_league_member(v_lc.league_id) then
    raise exception 'Accesso negato';
  end if;

  return query
  with pts as (
    select ps.real_player_id,
           rp.name,
           rp.team,
           rp.role,
           compute_player_points(
             rp.role,
             coalesce(ps.goals, 0),
             coalesce(ps.assists, 0),
             coalesce(ps.yellow, 0),
             coalesce(ps.red, 0),
             coalesce(ps.pen_missed, 0),
             coalesce(ps.pen_saved, 0),
             coalesce(ps.goals_conceded, 0),
             coalesce(ps.clean_sheet, false)
           ) + compute_extra_points(v_lc.scoring_ruleset, rp.role, ps.xg, ps.xa) as points
    from player_stats ps
    join real_players rp on rp.id = ps.real_player_id
    where ps.competition_id = v_lc.competition_id
      and ps.season_id = v_lc.season_id
  )
  select pts.real_player_id,
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
end
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
  from league_competitions
  where id = p_league_competition_id;

  if v_lc.league_id is null or not is_league_member(v_lc.league_id) then
    raise exception 'Accesso negato';
  end if;

  select rp.name, rp.role, rp.team
    into v_name, v_role, v_team
  from real_players rp
  where rp.id = p_real_player_id;

  with pts as (
    select ps.matchday_number,
           compute_player_points(
             v_role,
             coalesce(ps.goals, 0),
             coalesce(ps.assists, 0),
             coalesce(ps.yellow, 0),
             coalesce(ps.red, 0),
             coalesce(ps.pen_missed, 0),
             coalesce(ps.pen_saved, 0),
             coalesce(ps.goals_conceded, 0),
             coalesce(ps.clean_sheet, false)
           ) + compute_extra_points(v_lc.scoring_ruleset, v_role, ps.xg, ps.xa) as points
    from player_stats ps
    where ps.real_player_id = p_real_player_id
      and ps.competition_id = v_lc.competition_id
      and ps.season_id = v_lc.season_id
  )
  select coalesce(round(avg(points), 2), 0),
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
end
$function$;

create or replace function public.get_nyx_content(
  p_league_competition_id uuid,
  p_limit integer default 20
)
returns table(
  id uuid,
  title text,
  text text,
  audio_url text,
  matchday_number integer
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_league uuid;
begin
  select league_id into v_league
  from league_competitions
  where id = p_league_competition_id;

  if v_league is null or not is_league_member(v_league) then
    raise exception 'Accesso negato';
  end if;

  return query
  select n.id,
         'Nyx'::text,
         n.text,
         n.audio_url,
         m.number
  from nyx_content n
  left join matchdays m on m.id = n.matchday_id
  where n.league_id = v_league
  order by n.created_at desc
  limit p_limit;
end
$function$;

create or replace function public.get_competition_team_colors(p_league_competition_id uuid)
returns table(
  name text,
  color_primary text,
  color_secondary text,
  kit_pattern text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_lc record;
begin
  select league_id, competition_id
    into v_lc
  from league_competitions
  where id = p_league_competition_id;

  if v_lc.league_id is null or not is_league_member(v_lc.league_id) then
    raise exception 'Accesso negato';
  end if;

  return query
  select rt.name,
         rt.color_primary,
         rt.color_secondary,
         coalesce(rt.kit_pattern, 'split')
  from real_teams rt
  where rt.competition_id = v_lc.competition_id;
end
$function$;

create or replace function public.get_active_league_competition_status(p_league_competition_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lc record;
begin
  select lc.id,
         lc.league_id,
         lc.status,
         lc.competition_id,
         c.name as competition_name
    into v_lc
  from league_competitions lc
  join competitions c on c.id = lc.competition_id
  where lc.id = p_league_competition_id;

  if v_lc.league_id is null or not is_league_member(v_lc.league_id) then
    raise exception 'Accesso negato';
  end if;

  return jsonb_build_object(
    'league_competition_id', v_lc.id,
    'league_competition_status', v_lc.status,
    'competition_id', v_lc.competition_id,
    'competition_name', v_lc.competition_name,
    'competition_visibility_status', null,
    'competition_active', true
  );
end
$function$;
