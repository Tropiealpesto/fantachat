-- Bozze formazione anticipate.
-- Opzione B: ogni invio ufficiale processa prima le bozze scadute degli slot precedenti.

create table if not exists public.lineup_drafts (
  id uuid primary key default gen_random_uuid(),
  league_competition_id uuid not null references public.league_competitions(id) on delete cascade,
  matchday_id uuid not null references public.matchdays(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  players jsonb not null default '[]'::jsonb,
  coach_id uuid references public.real_coaches(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'failed', 'cancelled')),
  error text,
  submitted_lineup_id uuid references public.lineups(id) on delete set null,
  processed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (league_competition_id, matchday_id, user_id)
);

alter table public.lineup_drafts enable row level security;

drop policy if exists lineup_drafts_own_read on public.lineup_drafts;
create policy lineup_drafts_own_read
on public.lineup_drafts
for select
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.league_competitions lc
    where lc.id = lineup_drafts.league_competition_id
      and public.is_league_admin(lc.league_id)
  )
);

create index if not exists lineup_drafts_pending_idx
on public.lineup_drafts(league_competition_id, matchday_id, status);

create or replace function public.apply_lineup_for_user(
  p_league_competition_id uuid,
  p_matchday_id uuid,
  p_user_id uuid,
  p_players jsonb,
  p_coach_id uuid default null,
  p_auto boolean default false
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
  v_rules jsonb;
  v_expected_total int;
  v_selected_total int;
  v_club_violation int;
  v_top_count int;
  v_foreign int;
  v_bad_roles int;
  v_role_mismatch int;
  v_duplicates int;
  v_taken_players int;
begin
  perform pg_advisory_xact_lock(hashtext(p_league_competition_id::text), hashtext(p_matchday_id::text));

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

  if not exists (
    select 1
    from public.league_competition_members m
    where m.league_competition_id = p_league_competition_id
      and m.user_id = p_user_id
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

  if jsonb_typeof(coalesce(p_players, 'null'::jsonb)) <> 'array' then
    raise exception 'Giocatori non validi';
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
      and lc.user_id <> p_user_id
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

  select count(*)
    into v_taken_players
  from jsonb_array_elements(p_players) item
  join public.lineup_players lp
    on lp.real_player_id = (item->>'real_player_id')::uuid
  join public.lineups li
    on li.id = lp.lineup_id
  where li.league_competition_id = p_league_competition_id
    and li.matchday_id = p_matchday_id
    and li.user_id <> p_user_id
    and li.submitted_at is not null;

  if v_taken_players > 0 then
    raise exception 'Uno o piu giocatori sono gia stati selezionati';
  end if;

  select id
    into v_lineup_id
  from public.lineups
  where league_competition_id = p_league_competition_id
    and matchday_id = p_matchday_id
    and user_id = p_user_id;

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
      p_user_id,
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
      p_user_id,
      p_coach_id
    );
  end if;

  select team_name
    into v_team
  from public.league_members
  where league_id = v_lc.league_id
    and user_id = p_user_id;

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
    p_user_id,
    p_matchday_id,
    case
      when p_auto then coalesce(v_team, 'Una squadra') || ' ha caricato automaticamente la formazione dalla bozza'
      else coalesce(v_team, 'Una squadra') || ' ha caricato la formazione'
    end,
    'lineup',
    p_league_competition_id
  );

  return v_lineup_id;
end;
$function$;

create or replace function public.process_expired_lineup_drafts(
  p_league_competition_id uuid,
  p_matchday_id uuid
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lc record;
  v_draft record;
  v_count integer := 0;
  v_lineup_id uuid;
begin
  select *
    into v_lc
  from public.league_competitions
  where id = p_league_competition_id
    and status = 'active';

  if v_lc.id is null then
    raise exception 'Competizione non valida';
  end if;

  if not public.is_league_member(v_lc.league_id) then
    raise exception 'Accesso negato';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_league_competition_id::text), hashtext(p_matchday_id::text));

  for v_draft in
    select d.*
    from public.lineup_drafts d
    join public.lineup_slots ls
      on ls.league_competition_id = d.league_competition_id
     and ls.matchday_id = d.matchday_id
     and ls.user_id = d.user_id
    where d.league_competition_id = p_league_competition_id
      and d.matchday_id = p_matchday_id
      and d.status = 'pending'
      and ls.ends_at <= now()
      and not exists (
        select 1
        from public.lineups li
        where li.league_competition_id = d.league_competition_id
          and li.matchday_id = d.matchday_id
          and li.user_id = d.user_id
          and li.submitted_at is not null
      )
    order by ls.slot_order
  loop
    begin
      v_lineup_id := public.apply_lineup_for_user(
        v_draft.league_competition_id,
        v_draft.matchday_id,
        v_draft.user_id,
        v_draft.players,
        v_draft.coach_id,
        true
      );

      update public.lineup_drafts
      set status = 'submitted',
          submitted_lineup_id = v_lineup_id,
          processed_at = now(),
          updated_at = now(),
          error = null
      where id = v_draft.id;

      v_count := v_count + 1;
    exception when others then
      update public.lineup_drafts
      set status = 'failed',
          error = sqlerrm,
          processed_at = now(),
          updated_at = now()
      where id = v_draft.id;
    end;
  end loop;

  return v_count;
end;
$function$;

create or replace function public.save_lineup_draft(
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
  v_slot record;
  v_draft_id uuid;
begin
  select *
    into v_lc
  from public.league_competitions
  where id = p_league_competition_id
    and status = 'active';

  if v_lc.id is null or not public.is_league_member(v_lc.league_id) then
    raise exception 'Accesso negato';
  end if;

  if not exists (
    select 1
    from public.league_competition_members m
    where m.league_competition_id = p_league_competition_id
      and m.user_id = auth.uid()
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
    and user_id = auth.uid();

  if v_slot.id is null then
    raise exception 'Slot formazione non disponibile';
  end if;

  if now() >= v_slot.ends_at then
    raise exception 'Il tuo slot e gia terminato';
  end if;

  if exists (
    select 1
    from public.lineups li
    where li.league_competition_id = p_league_competition_id
      and li.matchday_id = p_matchday_id
      and li.user_id = auth.uid()
      and li.submitted_at is not null
  ) then
    raise exception 'La formazione e gia stata inviata';
  end if;

  if jsonb_typeof(coalesce(p_players, 'null'::jsonb)) <> 'array' then
    raise exception 'Giocatori non validi';
  end if;

  insert into public.lineup_drafts(
    league_competition_id,
    matchday_id,
    user_id,
    players,
    coach_id,
    status,
    error,
    processed_at,
    updated_at
  )
  values(
    p_league_competition_id,
    p_matchday_id,
    auth.uid(),
    p_players,
    p_coach_id,
    'pending',
    null,
    null,
    now()
  )
  on conflict (league_competition_id, matchday_id, user_id) do update
  set players = excluded.players,
      coach_id = excluded.coach_id,
      status = 'pending',
      error = null,
      processed_at = null,
      submitted_lineup_id = null,
      updated_at = now()
  returning id into v_draft_id;

  return v_draft_id;
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
  v_slot record;
  v_uid uuid := auth.uid();
  v_lineup_id uuid;
begin
  select *
    into v_lc
  from public.league_competitions
  where id = p_league_competition_id
    and status = 'active';

  if v_lc.id is null then
    raise exception 'Competizione non valida';
  end if;

  if not public.is_league_member(v_lc.league_id) then
    raise exception 'Accesso negato';
  end if;

  perform public.process_expired_lineup_drafts(p_league_competition_id, p_matchday_id);

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

  v_lineup_id := public.apply_lineup_for_user(
    p_league_competition_id,
    p_matchday_id,
    v_uid,
    p_players,
    p_coach_id,
    false
  );

  update public.lineup_drafts
  set status = 'submitted',
      submitted_lineup_id = v_lineup_id,
      processed_at = now(),
      updated_at = now(),
      error = null
  where league_competition_id = p_league_competition_id
    and matchday_id = p_matchday_id
    and user_id = v_uid
    and status = 'pending';

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
  v_draft record;
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
    perform public.process_expired_lineup_drafts(p_league_competition_id, v_matchday.id);

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

  if v_lineup.id is null then
    select *
      into v_draft
    from public.lineup_drafts
    where league_competition_id = p_league_competition_id
      and matchday_id = v_matchday.id
      and user_id = auth.uid()
    order by updated_at desc
    limit 1;
  end if;

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
            order by lp.role
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
    end,
    'draft', case
      when v_draft.id is null then null
      else jsonb_build_object(
        'id', v_draft.id,
        'status', v_draft.status,
        'error', v_draft.error,
        'players', coalesce(v_draft.players, '[]'::jsonb),
        'coach', case
          when v_draft.coach_id is null then null
          else jsonb_build_object('real_coach_id', v_draft.coach_id)
        end
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
    ), '[]'::jsonb)
  );
end;
$function$;

revoke execute on function public.apply_lineup_for_user(uuid, uuid, uuid, jsonb, uuid, boolean) from public, anon;
revoke execute on function public.process_expired_lineup_drafts(uuid, uuid) from public, anon;
revoke execute on function public.save_lineup_draft(uuid, uuid, jsonb, uuid) from public, anon;
revoke execute on function public.submit_lineup(uuid, uuid, jsonb, uuid) from public, anon;
revoke execute on function public.submit_lineup(uuid, uuid, jsonb) from public, anon;
revoke execute on function public.get_lineup_form_data(uuid) from public, anon;

grant execute on function public.process_expired_lineup_drafts(uuid, uuid) to authenticated;
grant execute on function public.save_lineup_draft(uuid, uuid, jsonb, uuid) to authenticated;
grant execute on function public.submit_lineup(uuid, uuid, jsonb, uuid) to authenticated;
grant execute on function public.submit_lineup(uuid, uuid, jsonb) to authenticated;
grant execute on function public.get_lineup_form_data(uuid) to authenticated;
grant all privileges on public.lineup_drafts to service_role;
