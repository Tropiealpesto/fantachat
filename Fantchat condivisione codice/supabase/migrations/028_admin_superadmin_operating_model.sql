-- FantaChat - admin/superadmin operating model
--
-- League admins:
-- - create league competitions;
-- - choose one slot duration for the whole league competition;
-- - inspect/reset submitted lineups.
--
-- Superadmin:
-- - opens/closes/finalizes matchdays globally for a competition season;
-- - slot rows are generated automatically for every active league competition.

alter table public.league_competitions
  add column if not exists slot_duration_minutes integer not null default 15,
  add column if not exists updated_at timestamp with time zone not null default now();

alter table public.matchdays
  add column if not exists slot_start timestamp with time zone,
  add column if not exists slot_end timestamp with time zone,
  add column if not exists deadline_end_at timestamp with time zone,
  add column if not exists updated_at timestamp with time zone not null default now();

create table if not exists public.lineup_slots (
  id uuid primary key default gen_random_uuid(),
  league_competition_id uuid not null references public.league_competitions(id) on delete cascade,
  matchday_id uuid not null references public.matchdays(id) on delete cascade,
  user_id uuid not null,
  slot_order integer not null,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (league_competition_id, matchday_id, user_id),
  unique (league_competition_id, matchday_id, slot_order)
);

alter table public.lineup_slots enable row level security;

drop policy if exists lineup_slots_member_read on public.lineup_slots;
create policy lineup_slots_member_read
on public.lineup_slots
for select
using (
  exists (
    select 1
    from public.league_competitions lc
    where lc.id = lineup_slots.league_competition_id
      and public.is_league_member(lc.league_id)
  )
);

create index if not exists lineup_slots_lc_matchday_order_idx
on public.lineup_slots(league_competition_id, matchday_id, slot_order);

create index if not exists lineup_slots_user_active_idx
on public.lineup_slots(user_id, starts_at, ends_at);

create or replace function public.admin_set_slot_duration(
  p_league_competition_id uuid,
  p_minutes integer
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_league_id uuid;
begin
  select league_id
    into v_league_id
  from public.league_competitions
  where id = p_league_competition_id
    and status = 'active';

  if v_league_id is null or not public.is_league_admin(v_league_id) then
    raise exception 'Solo admin lega';
  end if;

  if p_minutes is null or p_minutes < 3 or p_minutes > 180 then
    raise exception 'La durata slot deve essere tra 3 e 180 minuti';
  end if;

  update public.league_competitions
  set slot_duration_minutes = p_minutes,
      updated_at = now()
  where id = p_league_competition_id;
end;
$function$;

create or replace function public.admin_get_lineup_management(
  p_league_competition_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lc record;
  v_md record;
begin
  select *
    into v_lc
  from public.league_competitions
  where id = p_league_competition_id
    and status = 'active';

  if v_lc.id is null or not public.is_league_admin(v_lc.league_id) then
    raise exception 'Solo admin lega';
  end if;

  select *
    into v_md
  from public.matchdays
  where season_id = v_lc.season_id
    and status = 'open'
  order by number desc
  limit 1;

  return jsonb_build_object(
    'slot_duration_minutes', coalesce(v_lc.slot_duration_minutes, 15),
    'matchday', case
      when v_md.id is null then null
      else jsonb_build_object('id', v_md.id, 'number', v_md.number, 'status', v_md.status)
    end,
    'rows', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'user_id', lcm.user_id,
          'team_name', lcm.team_name,
          'rank', cs.rank,
          'slot_order', ls.slot_order,
          'slot_start', ls.starts_at,
          'slot_end', ls.ends_at,
          'lineup_id', li.id,
          'submitted_at', li.submitted_at,
          'players_count', coalesce((
            select count(*) from public.lineup_players lp where lp.lineup_id = li.id
          ), 0),
          'coach_count', coalesce((
            select count(*) from public.lineup_coaches lc where lc.lineup_id = li.id
          ), 0)
        )
        order by coalesce(ls.slot_order, 9999), coalesce(cs.rank, 9999), lcm.team_name
      )
      from public.league_competition_members lcm
      left join public.competition_standings cs
        on cs.league_competition_id = lcm.league_competition_id
       and cs.user_id = lcm.user_id
      left join public.lineup_slots ls
        on ls.league_competition_id = lcm.league_competition_id
       and ls.matchday_id = v_md.id
       and ls.user_id = lcm.user_id
      left join public.lineups li
        on li.league_competition_id = lcm.league_competition_id
       and li.matchday_id = v_md.id
       and li.user_id = lcm.user_id
      where lcm.league_competition_id = p_league_competition_id
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.reset_user_lineup(
  p_league_competition_id uuid,
  p_user_id uuid,
  p_matchday_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lc record;
  v_lineup_id uuid;
begin
  select *
    into v_lc
  from public.league_competitions
  where id = p_league_competition_id
    and status = 'active';

  if v_lc.id is null or not public.is_league_admin(v_lc.league_id) then
    raise exception 'Solo admin lega';
  end if;

  select id
    into v_lineup_id
  from public.lineups
  where league_competition_id = p_league_competition_id
    and matchday_id = p_matchday_id
    and user_id = p_user_id;

  if v_lineup_id is null then
    return;
  end if;

  delete from public.scores where lineup_id = v_lineup_id;
  delete from public.lineup_coaches where lineup_id = v_lineup_id;
  delete from public.lineup_players where lineup_id = v_lineup_id;
  delete from public.lineups where id = v_lineup_id;
end;
$function$;

create or replace function public.superadmin_generate_lineup_slots(
  p_matchday_id uuid,
  p_league_competition_id uuid default null,
  p_start_at timestamp with time zone default now()
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_matchday record;
  v_count integer := 0;
begin
  if not public.is_app_admin() then
    raise exception 'Solo superadmin';
  end if;

  select *
    into v_matchday
  from public.matchdays
  where id = p_matchday_id;

  if v_matchday.id is null then
    raise exception 'Giornata non valida';
  end if;

  delete from public.lineup_slots
  where matchday_id = p_matchday_id
    and (p_league_competition_id is null or league_competition_id = p_league_competition_id);

  with league_rows as (
    select
      lc.id as league_competition_id,
      lcm.user_id,
      coalesce(lc.slot_duration_minutes, 15) as duration_minutes,
      row_number() over(
        partition by lc.id
        order by coalesce(cs.rank, 999999) desc, lcm.team_name
      )::integer as slot_order
    from public.league_competitions lc
    join public.league_competition_members lcm
      on lcm.league_competition_id = lc.id
    left join public.competition_standings cs
      on cs.league_competition_id = lc.id
     and cs.user_id = lcm.user_id
    where lc.season_id = v_matchday.season_id
      and lc.status = 'active'
      and (p_league_competition_id is null or lc.id = p_league_competition_id)
  )
  insert into public.lineup_slots(
    league_competition_id,
    matchday_id,
    user_id,
    slot_order,
    starts_at,
    ends_at
  )
  select
    league_competition_id,
    p_matchday_id,
    user_id,
    slot_order,
    p_start_at + ((slot_order - 1) * duration_minutes) * interval '1 minute',
    p_start_at + (slot_order * duration_minutes) * interval '1 minute'
  from league_rows;

  get diagnostics v_count = row_count;

  update public.matchdays
  set slot_start = p_start_at,
      slot_end = (
        select max(ends_at)
        from public.lineup_slots
        where matchday_id = p_matchday_id
          and (p_league_competition_id is null or league_competition_id = p_league_competition_id)
      ),
      deadline_end_at = (
        select max(ends_at)
        from public.lineup_slots
        where matchday_id = p_matchday_id
          and (p_league_competition_id is null or league_competition_id = p_league_competition_id)
      ),
      updated_at = now()
  where id = p_matchday_id;

  return v_count;
end;
$function$;

create or replace function public.superadmin_open_matchday_for_competition(
  p_competition_id uuid,
  p_season_id uuid,
  p_number integer,
  p_start_at timestamp with time zone default now()
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_matchday_id uuid;
  v_slots integer;
begin
  if not public.is_app_admin() then
    raise exception 'Solo superadmin';
  end if;

  if not exists (
    select 1
    from public.seasons s
    where s.id = p_season_id
      and s.competition_id = p_competition_id
  ) then
    raise exception 'Stagione non valida per questa competizione';
  end if;

  if p_number is null or p_number < 1 then
    raise exception 'Numero giornata non valido';
  end if;

  update public.matchdays
  set status = 'completed',
      updated_at = now()
  where season_id = p_season_id
    and status = 'open';

  select id
    into v_matchday_id
  from public.matchdays
  where season_id = p_season_id
    and number = p_number
  limit 1;

  if v_matchday_id is null then
    insert into public.matchdays(season_id, number, status, slot_start, updated_at)
    values(p_season_id, p_number, 'open', p_start_at, now())
    returning id into v_matchday_id;
  else
    update public.matchdays
    set status = 'open',
        slot_start = p_start_at,
        updated_at = now()
    where id = v_matchday_id;
  end if;

  v_slots := public.superadmin_generate_lineup_slots(v_matchday_id, null, p_start_at);

  insert into public.messages(league_id, league_competition_id, matchday_id, user_id, content, kind)
  select lc.league_id, lc.id, v_matchday_id, null, 'Aperta giornata ' || p_number, 'matchday'
  from public.league_competitions lc
  where lc.competition_id = p_competition_id
    and lc.season_id = p_season_id
    and lc.status = 'active';

  return 'Giornata ' || p_number || ' aperta. Slot creati: ' || v_slots;
end;
$function$;

create or replace function public.superadmin_close_matchday_for_competition(
  p_competition_id uuid,
  p_season_id uuid,
  p_number integer
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_matchday_id uuid;
  v_lc record;
  v_recalcs integer := 0;
begin
  if not public.is_app_admin() then
    raise exception 'Solo superadmin';
  end if;

  if not exists (
    select 1
    from public.seasons s
    where s.id = p_season_id
      and s.competition_id = p_competition_id
  ) then
    raise exception 'Stagione non valida per questa competizione';
  end if;

  select id
    into v_matchday_id
  from public.matchdays
  where season_id = p_season_id
    and number = p_number
  limit 1;

  if v_matchday_id is null then
    raise exception 'Giornata non valida';
  end if;

  for v_lc in
    select id
    from public.league_competitions
    where competition_id = p_competition_id
      and season_id = p_season_id
      and status = 'active'
  loop
    perform public.recalc_competition_matchday(v_lc.id, v_matchday_id);
    v_recalcs := v_recalcs + 1;
  end loop;

  update public.matchdays
  set status = 'locked',
      updated_at = now()
  where id = v_matchday_id;

  return 'Giornata ' || p_number || ' chiusa. Leghe ricalcolate: ' || v_recalcs;
end;
$function$;

create or replace function public.open_competition_matchday(
  p_league_competition_id uuid,
  p_number int
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  raise exception 'Le giornate vengono aperte dal superadmin';
end;
$function$;

create or replace function public.close_competition_matchday(
  p_league_competition_id uuid
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  raise exception 'Le giornate vengono chiuse dal superadmin';
end;
$function$;

create or replace function public.finalize_competition_matchday(
  p_league_competition_id uuid
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  raise exception 'Le giornate vengono finalizzate dal superadmin';
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
  v_slot record;
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

  if v_matchday.id is not null then
    select *
      into v_slot
    from public.lineup_slots
    where league_competition_id = p_league_competition_id
      and matchday_id = v_matchday.id
      and user_id = auth.uid();
  end if;

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
    'is_participant', exists (
      select 1
      from public.league_competition_members m
      where m.league_competition_id = p_league_competition_id
        and m.user_id = auth.uid()
    ),
    'coach_enabled', coalesce(v_lc.coach_enabled, false),
    'coach_multiplier', coalesce(v_lc.coach_multiplier, 0),
    'slot_duration_minutes', coalesce(v_lc.slot_duration_minutes, 15),
    'slot', case
      when v_slot.id is null then null
      else jsonb_build_object(
        'id', v_slot.id,
        'order', v_slot.slot_order,
        'starts_at', v_slot.starts_at,
        'ends_at', v_slot.ends_at,
        'is_open',
          now() >= v_slot.starts_at
          or not exists (
            select 1
            from public.lineup_slots prev
            where prev.league_competition_id = p_league_competition_id
              and prev.matchday_id = v_matchday.id
              and prev.slot_order < v_slot.slot_order
              and not exists (
                select 1
                from public.lineups li_prev
                where li_prev.league_competition_id = prev.league_competition_id
                  and li_prev.matchday_id = prev.matchday_id
                  and li_prev.user_id = prev.user_id
                  and li_prev.submitted_at is not null
              )
          )
      )
    end,
    'matchday', case
      when v_matchday.id is null then null
      else jsonb_build_object(
        'id', v_matchday.id,
        'number', v_matchday.number,
        'status', v_matchday.status,
        'slot_start', v_matchday.slot_start,
        'slot_end', v_matchday.slot_end
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

create or replace function public.submit_lineup(
  p_league_competition_id uuid,
  p_matchday_id uuid,
  p_players jsonb,
  p_coach_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lc record;
  v_lineup_id uuid;
  v_item jsonb;
  v_team text;
  v_uid uuid := auth.uid();
  v_rules jsonb;
  v_expected_total int;
  v_selected_total int;
  v_club_violation int;
  v_top_count int;
  v_foreign int;
  v_bad_roles int;
  v_role_mismatch int;
  v_duplicates int;
  v_slot record;
begin
  select
    lc.id,
    lc.league_id,
    lc.competition_id,
    lc.season_id,
    lc.players_per_role,
    coalesce(lc.coach_enabled, false) as coach_enabled
  into v_lc
  from public.league_competitions lc
  where lc.id = p_league_competition_id
    and lc.status = 'active';

  if v_lc.id is null then
    raise exception 'Competizione non valida';
  end if;

  if not public.is_league_member(v_lc.league_id) then
    raise exception 'Accesso negato';
  end if;

  if not exists (
    select 1
    from public.league_competition_members m
    where m.league_competition_id = p_league_competition_id
      and m.user_id = v_uid
  ) then
    raise exception 'Non partecipi a questa competizione';
  end if;

  if not exists (
    select 1
    from public.matchdays md
    where md.id = p_matchday_id
      and md.season_id = v_lc.season_id
      and md.status = 'open'
  ) then
    raise exception 'Giornata non aperta';
  end if;

  select *
    into v_slot
  from public.lineup_slots
  where league_competition_id = p_league_competition_id
    and matchday_id = p_matchday_id
    and user_id = v_uid;

  if v_slot.id is null then
    raise exception 'Slot formazione non disponibile';
  end if;

  if now() < v_slot.starts_at and exists (
    select 1
    from public.lineup_slots prev
    where prev.league_competition_id = p_league_competition_id
      and prev.matchday_id = p_matchday_id
      and prev.slot_order < v_slot.slot_order
      and not exists (
        select 1
        from public.lineups li_prev
        where li_prev.league_competition_id = prev.league_competition_id
          and li_prev.matchday_id = prev.matchday_id
          and li_prev.user_id = prev.user_id
          and li_prev.submitted_at is not null
      )
  ) then
    raise exception 'Il tuo slot formazione non e ancora iniziato';
  end if;

  if v_lc.coach_enabled and p_coach_id is null then
    raise exception 'Allenatore obbligatorio';
  end if;

  if (not v_lc.coach_enabled) and p_coach_id is not null then
    raise exception 'Allenatore non previsto per questa competizione';
  end if;

  if p_coach_id is not null and not exists (
    select 1
    from public.real_coaches rc
    where rc.id = p_coach_id
      and rc.competition_id = v_lc.competition_id
      and rc.active
  ) then
    raise exception 'Allenatore non valido';
  end if;

  if p_coach_id is not null and exists (
    select 1
    from public.lineup_coaches lc
    where lc.league_competition_id = p_league_competition_id
      and lc.matchday_id = p_matchday_id
      and lc.real_coach_id = p_coach_id
      and lc.user_id <> v_uid
  ) then
    raise exception 'Allenatore gia selezionato da un altro partecipante';
  end if;

  v_rules := v_lc.players_per_role;

  if v_rules is null then
    select cc.players_per_role
      into v_rules
    from public.competition_config cc
    where cc.competition_id = v_lc.competition_id
    limit 1;
  end if;

  v_rules := coalesce(v_rules, '{"P":1,"D":1,"C":1,"A":1}'::jsonb);

  select coalesce(sum((value)::int), 0)
    into v_expected_total
  from jsonb_each_text(v_rules);

  select count(*)
    into v_selected_total
  from jsonb_array_elements(p_players);

  if v_selected_total <> v_expected_total then
    raise exception 'Numero giocatori non valido';
  end if;

  select count(*) - count(distinct item->>'real_player_id')
    into v_duplicates
  from jsonb_array_elements(p_players) item;

  if coalesce(v_duplicates, 0) > 0 then
    raise exception 'Non puoi schierare due volte lo stesso giocatore';
  end if;

  select count(*)
    into v_foreign
  from jsonb_array_elements(p_players) item
  left join public.real_players rp
    on rp.id = (item->>'real_player_id')::uuid
   and rp.competition_id = v_lc.competition_id
   and coalesce(rp.active, true)
  where rp.id is null;

  if v_foreign > 0 then
    raise exception 'Uno o piu giocatori non sono validi';
  end if;

  select count(*)
    into v_bad_roles
  from jsonb_array_elements(p_players) item
  where not (v_rules ? (item->>'role'));

  if v_bad_roles > 0 then
    raise exception 'Ruolo non valido';
  end if;

  select count(*)
    into v_role_mismatch
  from jsonb_array_elements(p_players) item
  join public.real_players rp on rp.id = (item->>'real_player_id')::uuid
  where rp.role <> item->>'role';

  if v_role_mismatch > 0 then
    raise exception 'Ruolo giocatore non coerente';
  end if;

  with selected_roles as (
    select item->>'role' as role, count(*) as n
    from jsonb_array_elements(p_players) item
    group by item->>'role'
  )
  select count(*)
    into v_bad_roles
  from selected_roles sr
  where sr.n <> coalesce((v_rules->>sr.role)::int, 0);

  if v_bad_roles > 0 then
    raise exception 'Composizione ruoli non valida';
  end if;

  select count(*)
    into v_club_violation
  from (
    select coalesce(rp.real_team_id::text, lower(rp.team)) as team_key
    from jsonb_array_elements(p_players) item
    join public.real_players rp on rp.id = (item->>'real_player_id')::uuid
    group by coalesce(rp.real_team_id::text, lower(rp.team))
    having count(*) > 1
  ) x;

  if v_club_violation > 0 then
    raise exception 'Puoi schierare al massimo un giocatore per squadra';
  end if;

  select count(*)
    into v_top_count
  from jsonb_array_elements(p_players) item
  join public.real_players rp on rp.id = (item->>'real_player_id')::uuid
  join public.top_teams tt
    on tt.competition_id = v_lc.competition_id
   and tt.season_id = v_lc.season_id
   and tt.matchday_number = (
     select number from public.matchdays where id = p_matchday_id
   )
   and (
     tt.real_team_id = rp.real_team_id
     or exists (
       select 1
       from public.real_teams rt
       where rt.id = tt.real_team_id
         and lower(rt.name) = lower(rp.team)
     )
   );

  if v_top_count > 1 then
    raise exception 'Puoi schierare al massimo un giocatore di una Top squadra';
  end if;

  select id
    into v_lineup_id
  from public.lineups
  where league_competition_id = p_league_competition_id
    and matchday_id = p_matchday_id
    and user_id = v_uid;

  if v_lineup_id is null then
    insert into public.lineups(
      league_id,
      league_competition_id,
      matchday_id,
      user_id,
      submitted_at
    )
    values(
      v_lc.league_id,
      p_league_competition_id,
      p_matchday_id,
      v_uid,
      now()
    )
    returning id into v_lineup_id;
  else
    update public.lineups
    set submitted_at = now()
    where id = v_lineup_id;

    delete from public.lineup_players
    where lineup_id = v_lineup_id;

    delete from public.lineup_coaches
    where lineup_id = v_lineup_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_players) loop
    insert into public.lineup_players(
      lineup_id,
      real_player_id,
      role
    )
    values(
      v_lineup_id,
      (v_item->>'real_player_id')::uuid,
      v_item->>'role'
    );
  end loop;

  if p_coach_id is not null then
    insert into public.lineup_coaches(
      lineup_id,
      league_competition_id,
      matchday_id,
      user_id,
      real_coach_id
    )
    values(
      v_lineup_id,
      p_league_competition_id,
      p_matchday_id,
      v_uid,
      p_coach_id
    );
  end if;

  select team_name
    into v_team
  from public.league_members
  where league_id = v_lc.league_id
    and user_id = v_uid;

  insert into public.messages(
    league_id,
    user_id,
    matchday_id,
    content,
    kind,
    league_competition_id
  )
  values(
    v_lc.league_id,
    v_uid,
    p_matchday_id,
    coalesce(v_team, 'Una squadra') || ' ha caricato la formazione',
    'lineup',
    p_league_competition_id
  );

  return v_lineup_id;
end;
$function$;

create or replace function public.submit_lineup(
  p_league_competition_id uuid,
  p_matchday_id uuid,
  p_players jsonb
)
returns uuid
language sql
security definer
set search_path to 'public'
as $function$
  select public.submit_lineup(p_league_competition_id, p_matchday_id, p_players, null::uuid);
$function$;

revoke execute on function public.admin_set_slot_duration(uuid, integer) from public, anon;
revoke execute on function public.admin_get_lineup_management(uuid) from public, anon;
revoke execute on function public.reset_user_lineup(uuid, uuid, uuid) from public, anon;
revoke execute on function public.superadmin_generate_lineup_slots(uuid, uuid, timestamp with time zone) from public, anon;
revoke execute on function public.superadmin_open_matchday_for_competition(uuid, uuid, integer, timestamp with time zone) from public, anon;
revoke execute on function public.superadmin_close_matchday_for_competition(uuid, uuid, integer) from public, anon;
revoke execute on function public.open_competition_matchday(uuid, int) from public, anon;
revoke execute on function public.close_competition_matchday(uuid) from public, anon;
revoke execute on function public.finalize_competition_matchday(uuid) from public, anon;
revoke execute on function public.submit_lineup(uuid, uuid, jsonb) from public, anon;
revoke execute on function public.submit_lineup(uuid, uuid, jsonb, uuid) from public, anon;

grant execute on function public.admin_set_slot_duration(uuid, integer) to authenticated;
grant execute on function public.admin_get_lineup_management(uuid) to authenticated;
grant execute on function public.reset_user_lineup(uuid, uuid, uuid) to authenticated;
grant execute on function public.superadmin_generate_lineup_slots(uuid, uuid, timestamp with time zone) to authenticated;
grant execute on function public.superadmin_open_matchday_for_competition(uuid, uuid, integer, timestamp with time zone) to authenticated;
grant execute on function public.superadmin_close_matchday_for_competition(uuid, uuid, integer) to authenticated;
grant execute on function public.open_competition_matchday(uuid, int) to authenticated;
grant execute on function public.close_competition_matchday(uuid) to authenticated;
grant execute on function public.finalize_competition_matchday(uuid) to authenticated;
grant execute on function public.submit_lineup(uuid, uuid, jsonb) to authenticated;
grant execute on function public.submit_lineup(uuid, uuid, jsonb, uuid) to authenticated;

grant all privileges on public.lineup_slots to service_role;
