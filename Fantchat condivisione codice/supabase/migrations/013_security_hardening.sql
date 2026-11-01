-- FantaChat security hardening - launch readiness point 1
-- DRAFT ONLY - DO NOT APPLY YET.
-- The live database has newer RPC signatures than the local migration history.
-- This file must be realigned with the live definitions before use.

-- ------------------------------------------------------------
-- 1) RLS for tables created/used after the baseline migration
-- ------------------------------------------------------------

alter table if exists public.user_context enable row level security;
alter table if exists public.competition_config enable row level security;
alter table if exists public.competition_real_teams enable row level security;
alter table if exists public.competition_players enable row level security;
alter table if exists public.league_competition_members enable row level security;
alter table if exists public.app_admins enable row level security;

drop policy if exists user_context_self_read on public.user_context;
create policy user_context_self_read
on public.user_context
for select
using (user_id = auth.uid());

drop policy if exists user_context_self_insert on public.user_context;
create policy user_context_self_insert
on public.user_context
for insert
with check (user_id = auth.uid());

drop policy if exists user_context_self_update on public.user_context;
create policy user_context_self_update
on public.user_context
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists competition_config_member_read on public.competition_config;
create policy competition_config_member_read
on public.competition_config
for select
using (
  exists (
    select 1
    from public.league_competitions lc
    where lc.id = competition_config.league_competition_id
      and public.is_league_member(lc.league_id)
  )
);

drop policy if exists competition_config_admin_write on public.competition_config;
create policy competition_config_admin_write
on public.competition_config
for all
using (
  exists (
    select 1
    from public.league_competitions lc
    where lc.id = competition_config.league_competition_id
      and public.is_league_admin(lc.league_id)
  )
)
with check (
  exists (
    select 1
    from public.league_competitions lc
    where lc.id = competition_config.league_competition_id
      and public.is_league_admin(lc.league_id)
  )
);

drop policy if exists league_competition_members_member_read on public.league_competition_members;
create policy league_competition_members_member_read
on public.league_competition_members
for select
using (
  exists (
    select 1
    from public.league_competitions lc
    where lc.id = league_competition_members.league_competition_id
      and public.is_league_member(lc.league_id)
  )
);

drop policy if exists league_competition_members_admin_write on public.league_competition_members;
create policy league_competition_members_admin_write
on public.league_competition_members
for all
using (
  exists (
    select 1
    from public.league_competitions lc
    where lc.id = league_competition_members.league_competition_id
      and public.is_league_admin(lc.league_id)
  )
)
with check (
  exists (
    select 1
    from public.league_competitions lc
    where lc.id = league_competition_members.league_competition_id
      and public.is_league_admin(lc.league_id)
  )
);

drop policy if exists competition_real_teams_active_read on public.competition_real_teams;
create policy competition_real_teams_active_read
on public.competition_real_teams
for select
using (
  active = true
  and exists (
    select 1
    from public.competitions c
    where c.id = competition_real_teams.competition_id
      and (c.active = true or public.is_app_admin())
  )
);

drop policy if exists competition_players_active_read on public.competition_players;
create policy competition_players_active_read
on public.competition_players
for select
using (
  active = true
  and exists (
    select 1
    from public.competitions c
    where c.id = competition_players.competition_id
      and (c.active = true or public.is_app_admin())
  )
);

-- Keep app_admins closed to direct clients. is_app_admin() remains the public interface.

-- ------------------------------------------------------------
-- 2) Harden RPC parameter consistency
-- ------------------------------------------------------------

create or replace function public.create_league_competition(
  p_league_id uuid,
  p_competition_id uuid,
  p_season_id uuid,
  p_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lc uuid;
  v_total int;
  v_i int;
  v_name text;
begin
  if not public.is_league_admin(p_league_id) then
    raise exception 'Solo admin lega';
  end if;

  select coalesce(p_name, s.name), coalesce(s.total_matchdays, c.default_total_matchdays, 38)
    into v_name, v_total
  from public.seasons s
  join public.competitions c on c.id = s.competition_id
  where s.id = p_season_id
    and s.competition_id = p_competition_id
    and s.active = true
    and c.active = true;

  if v_name is null then
    raise exception 'Competizione o stagione non valida';
  end if;

  insert into public.league_competitions(league_id, competition_id, season_id, name)
  values(p_league_id, p_competition_id, p_season_id, coalesce(v_name, 'Competizione'))
  on conflict(league_id, competition_id, season_id)
  do update set status = 'active', updated_at = now()
  returning id into v_lc;

  insert into public.competition_config(league_competition_id, roles, players_per_role, scoring_rules)
  values(
    v_lc,
    '[{"key":"P","label":"Portiere"},{"key":"D","label":"Difensore"},{"key":"C","label":"Centrocampista"},{"key":"A","label":"Attaccante"}]'::jsonb,
    '{"P":1,"D":1,"C":1,"A":1}'::jsonb,
    '{"goal":3,"assist":1,"yellow":-0.5,"red":-1,"clean_sheet_gk":1,"clean_sheet_def":1,"goals_conceded_gk":-1,"pen_missed":-3}'::jsonb
  )
  on conflict do nothing;

  for v_i in 1..coalesce(v_total, 38) loop
    insert into public.matchdays(league_competition_id, number, status)
    values(v_lc, v_i, 'scheduled')
    on conflict do nothing;
  end loop;

  insert into public.competition_standings(league_id, league_competition_id, user_id, team_name, total_points, rank)
  select p_league_id, v_lc, lm.user_id, lm.team_name, 0, row_number() over(order by lm.team_name)
  from public.league_members lm
  where lm.league_id = p_league_id
  on conflict(league_competition_id, user_id) do nothing;

  insert into public.league_competition_members(league_competition_id, user_id, team_name)
  select v_lc, lm.user_id, lm.team_name
  from public.league_members lm
  where lm.league_id = p_league_id
  on conflict(league_competition_id, user_id) do nothing;

  update public.user_context
  set active_league_competition_id = v_lc,
      updated_at = now()
  where user_id = auth.uid();

  return jsonb_build_object('league_competition_id', v_lc);
end
$function$;

create or replace function public.create_nyx_content(
  p_league_id uuid,
  p_league_competition_id uuid,
  p_matchday_id uuid,
  p_title text,
  p_text text,
  p_audio_url text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if not public.is_league_admin(p_league_id) then
    raise exception 'Solo admin lega';
  end if;

  if not exists (
    select 1
    from public.league_competitions lc
    join public.matchdays m on m.league_competition_id = lc.id
    where lc.id = p_league_competition_id
      and lc.league_id = p_league_id
      and m.id = p_matchday_id
  ) then
    raise exception 'Competizione o giornata non valida';
  end if;

  insert into public.nyx_content(
    league_id,
    league_competition_id,
    matchday_id,
    title,
    text,
    audio_url,
    created_by,
    updated_at
  )
  values(
    p_league_id,
    p_league_competition_id,
    p_matchday_id,
    p_title,
    p_text,
    p_audio_url,
    auth.uid(),
    now()
  )
  returning id into v_id;

  insert into public.messages(
    league_id,
    league_competition_id,
    matchday_id,
    user_id,
    message_type,
    content
  )
  values(
    p_league_id,
    p_league_competition_id,
    p_matchday_id,
    auth.uid(),
    'nyx',
    p_title
  );

  return v_id;
end
$function$;

-- ------------------------------------------------------------
-- 3) RPC execute privileges: authenticated clients only
-- ------------------------------------------------------------
-- Keep this targeted. Do not blindly revoke every function until the live DB is fully inventoried.

revoke execute on function public.create_league_competition(uuid, uuid, uuid, text) from public;
revoke execute on function public.create_nyx_content(uuid, uuid, uuid, text, text, text) from public;

grant execute on function public.create_league_competition(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.create_nyx_content(uuid, uuid, uuid, text, text, text) to authenticated;
