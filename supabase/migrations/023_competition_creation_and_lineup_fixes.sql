-- FantaChat - competition creation and lineup form fixes
--
-- Fixes:
-- - get_lineup_form_data no longer references lineup_players.created_at.
-- - get_app_context avoids selecting competitions where the user is not a participant.
-- - get_league_members gives the admin creation flow a stable member source.

drop function if exists public.get_league_members(uuid);

create or replace function public.get_league_members(
  p_league_id uuid
)
returns table(
  user_id uuid,
  team_name text
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
  select lm.user_id, lm.team_name
  from public.league_members lm
  where lm.league_id = p_league_id
  order by lm.team_name;
end;
$function$;

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
  from public.user_context
  where user_id = v_uid;

  if v_league is null then
    select lm.league_id into v_league
    from public.league_members lm
    join public.leagues l on l.id = lm.league_id
    where lm.user_id = v_uid
    order by l.created_at
    limit 1;

    if v_league is not null then
      insert into public.user_context(user_id, active_league_id, updated_at)
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
  from public.league_members lm
  join public.leagues l on l.id = lm.league_id
  where lm.league_id = v_league
    and lm.user_id = v_uid;

  v_is_admin := public.is_app_admin();

  if v_lc is not null
     and not exists (
       select 1
       from public.league_competitions lc
       where lc.id = v_lc
         and lc.league_id = v_league
         and lc.status = 'active'
         and (
           exists (
             select 1
             from public.league_competition_members lcm
             where lcm.league_competition_id = lc.id
               and lcm.user_id = v_uid
           )
           or not exists (
             select 1
             from public.league_competition_members any_lcm
             where any_lcm.league_competition_id = lc.id
           )
         )
     ) then
    v_lc := null;
  end if;

  if v_lc is null then
    select lc.id into v_lc
    from public.league_competitions lc
    where lc.league_id = v_league
      and lc.status = 'active'
      and (
        exists (
          select 1
          from public.league_competition_members lcm
          where lcm.league_competition_id = lc.id
            and lcm.user_id = v_uid
        )
        or not exists (
          select 1
          from public.league_competition_members any_lcm
          where any_lcm.league_competition_id = lc.id
        )
      )
    order by lc.created_at
    limit 1;

    if v_lc is not null then
      update public.user_context
      set active_league_competition_id = v_lc,
          updated_at = now()
      where user_id = v_uid;
    end if;
  end if;

  if v_lc is not null then
    select lc.competition_id, lc.season_id, c.name, c.type, c.slug
      into v_comp_id, v_season, v_comp_name, v_comp_type, v_comp_slug
    from public.league_competitions lc
    join public.competitions c on c.id = lc.competition_id
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
end;
$function$;

create or replace function public.get_lineup_form_data(
  p_league_competition_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lc record;
  v_matchday record;
  v_lineup record;
  v_players_per_role jsonb;
begin
  select *
    into v_lc
  from public.league_competitions
  where id = p_league_competition_id;

  if v_lc.id is null or not public.is_league_member(v_lc.league_id) then
    raise exception 'Accesso negato';
  end if;

  select *
    into v_matchday
  from public.matchdays
  where season_id = v_lc.season_id
    and status = 'open'
  order by number desc
  limit 1;

  select *
    into v_lineup
  from public.lineups
  where league_competition_id = p_league_competition_id
    and matchday_id = v_matchday.id
    and user_id = auth.uid();

  v_players_per_role := coalesce(v_lc.players_per_role, (
    select cc.players_per_role
    from public.competition_config cc
    where cc.competition_id = v_lc.competition_id
    limit 1
  ), '{"P":1,"D":1,"C":1,"A":1}'::jsonb);

  return jsonb_build_object(
    'competition_id', v_lc.competition_id,
    'is_participant', (
      exists (
        select 1
        from public.league_competition_members m
        where m.league_competition_id = p_league_competition_id
          and m.user_id = auth.uid()
      )
      or not exists (
        select 1
        from public.league_competition_members any_m
        where any_m.league_competition_id = p_league_competition_id
      )
    ),
    'coach_enabled', coalesce(v_lc.coach_enabled, false),
    'coach_multiplier', coalesce(v_lc.coach_multiplier, 0),
    'matchday', case
      when v_matchday.id is null then null
      else jsonb_build_object(
        'id', v_matchday.id,
        'number', v_matchday.number,
        'status', v_matchday.status
      )
    end,
    'players_per_role', v_players_per_role,
    'players', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', rp.id,
          'name', rp.name,
          'role', rp.role,
          'team', rp.team
        )
        order by rp.role, rp.name
      )
      from public.real_players rp
      where rp.competition_id = v_lc.competition_id
        and coalesce(rp.active, true)
    ), '[]'::jsonb),
    'coaches', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', rc.id,
          'name', rc.name,
          'team', rt.name,
          'real_team_id', rc.real_team_id
        )
        order by rt.name, rc.name
      )
      from public.real_coaches rc
      join public.real_teams rt on rt.id = rc.real_team_id
      where rc.competition_id = v_lc.competition_id
        and rc.active
    ), '[]'::jsonb),
    'lineup', case
      when v_lineup.id is null then null
      else jsonb_build_object(
        'id', v_lineup.id,
        'submitted_at', v_lineup.submitted_at,
        'players', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'role', lp.role,
              'real_player_id', lp.real_player_id
            )
            order by lp.role, lp.id
          )
          from public.lineup_players lp
          where lp.lineup_id = v_lineup.id
        ), '[]'::jsonb),
        'coach', (
          select jsonb_build_object(
            'real_coach_id', lc.real_coach_id,
            'name', rc.name,
            'team', rt.name
          )
          from public.lineup_coaches lc
          join public.real_coaches rc on rc.id = lc.real_coach_id
          join public.real_teams rt on rt.id = rc.real_team_id
          where lc.lineup_id = v_lineup.id
          limit 1
        )
      )
    end
  );
end;
$function$;

insert into public.league_competition_members(
  league_competition_id,
  user_id,
  team_name
)
select lc.id, lm.user_id, lm.team_name
from public.league_competitions lc
join public.league_members lm on lm.league_id = lc.league_id
where lc.status = 'active'
  and not exists (
    select 1
    from public.league_competition_members any_m
    where any_m.league_competition_id = lc.id
  )
on conflict (league_competition_id, user_id) do nothing;

insert into public.competition_standings(
  league_competition_id,
  user_id,
  team_name,
  total_points,
  rank
)
select
  m.league_competition_id,
  m.user_id,
  m.team_name,
  0,
  row_number() over(partition by m.league_competition_id order by m.team_name)
from public.league_competition_members m
where not exists (
  select 1
  from public.competition_standings cs
  where cs.league_competition_id = m.league_competition_id
    and cs.user_id = m.user_id
);

with ranked as (
  select
    cs.league_competition_id,
    cs.user_id,
    row_number() over(
      partition by cs.league_competition_id
      order by cs.total_points desc, cs.team_name
    ) as next_rank
  from public.competition_standings cs
)
update public.competition_standings cs
set rank = ranked.next_rank,
    updated_at = now()
from ranked
where cs.league_competition_id = ranked.league_competition_id
  and cs.user_id = ranked.user_id;

revoke execute on function public.get_league_members(uuid) from public, anon;
grant execute on function public.get_league_members(uuid) to authenticated;
