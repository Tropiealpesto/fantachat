-- FantaChat - deadline formazioni al calcio d'inizio
--
-- Gli slot continuano a finire un'ora prima della prima partita, ma la
-- deadline ufficiale per salvare la formazione e il calcio d'inizio.

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
  v_slot_cutoff timestamp with time zone;
  v_submission_deadline timestamp with time zone;
  v_count integer := 0;
  v_row record;
  v_current_lc uuid;
  v_cursor timestamp with time zone;
  v_slot_start timestamp with time zone;
  v_slot_end timestamp with time zone;
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

  v_submission_deadline := p_start_at;
  v_slot_cutoff := p_start_at - interval '1 hour';

  delete from public.lineup_slots
  where matchday_id = p_matchday_id
    and (p_league_competition_id is null or league_competition_id = p_league_competition_id);

  for v_row in
    with league_rows as (
      select
        lc.id as league_competition_id,
        lcm.user_id,
        coalesce(lc.slot_duration_minutes, 15) as duration_minutes,
        row_number() over(
          partition by lc.id
          order by
            case
              when cs.rank is null or cs.rank >= 999 then 999999
              else cs.rank
            end desc,
            lcm.team_name
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
    select *
    from league_rows
    order by league_competition_id, slot_order desc
  loop
    if v_current_lc is distinct from v_row.league_competition_id then
      v_current_lc := v_row.league_competition_id;
      v_cursor := v_slot_cutoff;
    end if;

    select s.starts_at, s.ends_at
      into v_slot_start, v_slot_end
    from public.previous_allowed_lineup_slot(v_cursor, v_row.duration_minutes) s;

    insert into public.lineup_slots(
      league_competition_id,
      matchday_id,
      user_id,
      slot_order,
      starts_at,
      ends_at
    )
    values(
      v_row.league_competition_id,
      p_matchday_id,
      v_row.user_id,
      v_row.slot_order,
      v_slot_start,
      v_slot_end
    );

    v_cursor := v_slot_start;
    v_count := v_count + 1;
  end loop;

  update public.matchdays
  set slot_start = (
        select min(starts_at)
        from public.lineup_slots
        where matchday_id = p_matchday_id
          and (p_league_competition_id is null or league_competition_id = p_league_competition_id)
      ),
      slot_end = (
        select max(ends_at)
        from public.lineup_slots
        where matchday_id = p_matchday_id
          and (p_league_competition_id is null or league_competition_id = p_league_competition_id)
      ),
      deadline_end_at = v_submission_deadline,
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
  v_slot_start timestamp with time zone;
  v_slot_cutoff timestamp with time zone;
  v_submission_deadline timestamp with time zone;
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

  v_submission_deadline := p_start_at;
  v_slot_cutoff := p_start_at - interval '1 hour';

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
    insert into public.matchdays(season_id, number, status, slot_end, deadline_end_at, updated_at)
    values(p_season_id, p_number, 'open', v_slot_cutoff, v_submission_deadline, now())
    returning id into v_matchday_id;
  else
    update public.matchdays
    set status = 'open',
        slot_end = v_slot_cutoff,
        deadline_end_at = v_submission_deadline,
        updated_at = now()
    where id = v_matchday_id;
  end if;

  v_slots := public.superadmin_generate_lineup_slots(v_matchday_id, null, p_start_at);

  select slot_start
    into v_slot_start
  from public.matchdays
  where id = v_matchday_id;

  insert into public.messages(league_id, league_competition_id, matchday_id, user_id, content, kind)
  select lc.league_id, lc.id, v_matchday_id, null, 'Aperta giornata ' || p_number, 'matchday'
  from public.league_competitions lc
  where lc.competition_id = p_competition_id
    and lc.season_id = p_season_id
    and lc.status = 'active';

  return 'Giornata ' || p_number || ' aperta. Prima partita: ' || to_char(p_start_at, 'DD/MM HH24:MI') || '. Fine slot: ' || to_char(v_slot_cutoff, 'DD/MM HH24:MI') || '. Chiusura formazioni: ' || to_char(v_submission_deadline, 'DD/MM HH24:MI') || '. Primo slot: ' || coalesce(to_char(v_slot_start, 'DD/MM HH24:MI'), '-') || '. Slot creati: ' || v_slots;
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
  v_matchday record;
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

  select *
    into v_matchday
  from public.matchdays
  where id = p_matchday_id
    and season_id = v_lc.season_id
    and status = 'open';

  if v_matchday.id is null then
    raise exception 'Giornata non aperta';
  end if;

  if v_matchday.deadline_end_at is not null and now() >= v_matchday.deadline_end_at then
    raise exception 'La deadline formazioni e gia passata';
  end if;

  perform public.process_expired_lineup_drafts(p_league_competition_id, p_matchday_id);

  select id
    into v_lineup_id
  from public.lineups
  where league_competition_id = p_league_competition_id
    and matchday_id = p_matchday_id
    and user_id = v_uid
  limit 1;

  if v_lineup_id is not null then
    raise exception 'Rosa gia inviata. Per modificarla serve il reset admin.';
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

-- Le giornate gia aperte prima di questa migrazione avevano la deadline
-- uguale alla fine degli slot. Spostala avanti di un'ora senza rigenerare.
update public.matchdays
set deadline_end_at = slot_end + interval '1 hour',
    updated_at = now()
where status = 'open'
  and slot_end is not null
  and (deadline_end_at is null or deadline_end_at <= slot_end + interval '1 minute');

revoke execute on function public.superadmin_generate_lineup_slots(uuid, uuid, timestamp with time zone) from public, anon;
revoke execute on function public.superadmin_open_matchday_for_competition(uuid, uuid, integer, timestamp with time zone) from public, anon;
revoke execute on function public.submit_lineup(uuid, uuid, jsonb, uuid) from public, anon;
revoke execute on function public.submit_lineup(uuid, uuid, jsonb) from public, anon;

grant execute on function public.superadmin_generate_lineup_slots(uuid, uuid, timestamp with time zone) to authenticated;
grant execute on function public.superadmin_open_matchday_for_competition(uuid, uuid, integer, timestamp with time zone) to authenticated;
grant execute on function public.submit_lineup(uuid, uuid, jsonb, uuid) to authenticated;
grant execute on function public.submit_lineup(uuid, uuid, jsonb) to authenticated;
