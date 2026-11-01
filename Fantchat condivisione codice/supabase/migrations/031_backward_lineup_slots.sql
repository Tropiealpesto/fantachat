-- Slots formazione calcolati a ritroso dalla prima partita della giornata.
-- Il parametro p_start_at resta invariato per compatibilita RPC, ma rappresenta
-- la deadline della prima partita, non l'inizio del primo slot.

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
  v_lineup_deadline timestamp with time zone;
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

  v_lineup_deadline := p_start_at - interval '1 hour';

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
        order by
          case
            when cs.rank is null or cs.rank >= 999 then 999999
            else cs.rank
          end desc,
          lcm.team_name
      )::integer as slot_order,
      count(*) over(partition by lc.id)::integer as league_size
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
    v_lineup_deadline - ((league_size - slot_order + 1) * duration_minutes) * interval '1 minute',
    v_lineup_deadline - ((league_size - slot_order) * duration_minutes) * interval '1 minute'
  from league_rows;

  get diagnostics v_count = row_count;

  update public.matchdays
  set slot_start = (
        select min(starts_at)
        from public.lineup_slots
        where matchday_id = p_matchday_id
          and (p_league_competition_id is null or league_competition_id = p_league_competition_id)
      ),
      slot_end = v_lineup_deadline,
      deadline_end_at = v_lineup_deadline,
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
  v_lineup_deadline timestamp with time zone;
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

  v_lineup_deadline := p_start_at - interval '1 hour';

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
    values(p_season_id, p_number, 'open', v_lineup_deadline, v_lineup_deadline, now())
    returning id into v_matchday_id;
  else
    update public.matchdays
    set status = 'open',
        slot_end = v_lineup_deadline,
        deadline_end_at = v_lineup_deadline,
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

  return 'Giornata ' || p_number || ' aperta. Prima partita: ' || to_char(p_start_at, 'DD/MM HH24:MI') || '. Chiusura formazioni: ' || to_char(v_lineup_deadline, 'DD/MM HH24:MI') || '. Primo slot: ' || coalesce(to_char(v_slot_start, 'DD/MM HH24:MI'), '-') || '. Slot creati: ' || v_slots;
end;
$function$;

revoke execute on function public.superadmin_generate_lineup_slots(uuid, uuid, timestamp with time zone) from public, anon;
revoke execute on function public.superadmin_open_matchday_for_competition(uuid, uuid, integer, timestamp with time zone) from public, anon;

grant execute on function public.superadmin_generate_lineup_slots(uuid, uuid, timestamp with time zone) to authenticated;
grant execute on function public.superadmin_open_matchday_for_competition(uuid, uuid, integer, timestamp with time zone) to authenticated;
