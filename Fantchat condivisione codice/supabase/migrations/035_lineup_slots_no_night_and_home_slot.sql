-- Slot formazione:
-- - generati a ritroso dalla chiusura formazioni;
-- - l'ultimo slot termina un'ora prima della prima partita;
-- - nessuno slot cade nella fascia notturna 22:00-09:00 Europe/Rome;
-- - la Home riceve anche lo slot personale dell'utente.

create or replace function public.previous_allowed_lineup_slot(
  p_cursor timestamp with time zone,
  p_duration_minutes integer
)
returns table(
  starts_at timestamp with time zone,
  ends_at timestamp with time zone
)
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  v_cursor timestamp with time zone := p_cursor;
  v_local timestamp without time zone;
  v_available_minutes numeric;
begin
  if p_cursor is null then
    raise exception 'Orario slot non valido';
  end if;

  if p_duration_minutes is null or p_duration_minutes < 1 then
    raise exception 'Durata slot non valida';
  end if;

  loop
    v_local := v_cursor at time zone 'Europe/Rome';

    if v_local::time > time '22:00' then
      v_cursor := (v_local::date + time '22:00') at time zone 'Europe/Rome';
      continue;
    end if;

    if v_local::time <= time '09:00' then
      v_cursor := ((v_local::date - 1) + time '22:00') at time zone 'Europe/Rome';
      continue;
    end if;

    v_available_minutes := extract(epoch from (v_local - (v_local::date + time '09:00'))) / 60;

    if v_available_minutes >= p_duration_minutes then
      ends_at := v_cursor;
      starts_at := (v_local - make_interval(mins => p_duration_minutes)) at time zone 'Europe/Rome';
      return next;
      return;
    end if;

    v_cursor := ((v_local::date - 1) + time '22:00') at time zone 'Europe/Rome';
  end loop;
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
  v_lineup_deadline timestamp with time zone;
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

  v_lineup_deadline := p_start_at - interval '1 hour';

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
      v_cursor := v_lineup_deadline;
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
      deadline_end_at = v_lineup_deadline,
      updated_at = now()
  where id = p_matchday_id;

  return v_count;
end;
$function$;

create or replace function public.get_home_data(
  p_league_id uuid,
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
  v_lineup record;
  v_slot record;
  v_players jsonb;
  v_coach jsonb;
  v_stats record;
  v_hist jsonb;
begin
  if not public.is_league_member(p_league_id) then
    raise exception 'Accesso negato';
  end if;

  select * into v_lc
  from public.league_competitions
  where id = p_league_competition_id
    and league_id = p_league_id;

  select *
    into v_md
  from public.matchdays
  where season_id = v_lc.season_id
    and status in ('open', 'completed', 'locked')
  order by case status when 'open' then 0 else 1 end, number desc
  limit 1;

  if v_md.id is not null then
    select *
      into v_lineup
    from public.lineups
    where league_competition_id = p_league_competition_id
      and matchday_id = v_md.id
      and user_id = auth.uid();

    select *
      into v_slot
    from public.lineup_slots
    where league_competition_id = p_league_competition_id
      and matchday_id = v_md.id
      and user_id = auth.uid();
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'role', lp.role,
      'name', rp.name,
      'team', rp.team,
      'points', s.points
    )
    order by lp.role
  ), '[]'::jsonb)
  into v_players
  from public.lineup_players lp
  join public.real_players rp on rp.id = lp.real_player_id
  left join public.scores s on s.lineup_id = lp.lineup_id and s.real_player_id = lp.real_player_id
  where lp.lineup_id = v_lineup.id;

  select jsonb_build_object(
    'name', rc.name,
    'team', rt.name,
    'points', lc.points
  )
  into v_coach
  from public.lineup_coaches lc
  join public.real_coaches rc on rc.id = lc.real_coach_id
  join public.real_teams rt on rt.id = rc.real_team_id
  where lc.lineup_id = v_lineup.id
  limit 1;

  select *
    into v_stats
  from public.competition_standings
  where league_competition_id = p_league_competition_id
    and user_id = auth.uid();

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'matchday_number', md.number,
      'score', coalesce(x.total_score, 0)
    )
    order by md.number
  ), '[]'::jsonb)
  into v_hist
  from public.matchdays md
  left join lateral (
    select coalesce((
      select sum(s.points)
      from public.lineups li
      join public.scores s on s.lineup_id = li.id
      where li.league_competition_id = p_league_competition_id
        and li.matchday_id = md.id
        and li.user_id = auth.uid()
    ), 0) + coalesce((
      select sum(lc.points)
      from public.lineups li
      join public.lineup_coaches lc on lc.lineup_id = li.id
      where li.league_competition_id = p_league_competition_id
        and li.matchday_id = md.id
        and li.user_id = auth.uid()
    ), 0) as total_score
  ) x on true
  where md.season_id = v_lc.season_id
    and exists (
      select 1
      from public.lineups li
      where li.league_competition_id = p_league_competition_id
        and li.matchday_id = md.id
        and li.user_id = auth.uid()
    );

  return jsonb_build_object(
    'matchday', case
      when v_md.id is null then null
      else jsonb_build_object(
        'id', v_md.id,
        'number', v_md.number,
        'status', v_md.status,
        'slot_start', v_md.slot_start,
        'slot_end', v_md.slot_end,
        'deadline_end_at', v_md.deadline_end_at
      )
    end,
    'my_slot', case
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
              and prev.matchday_id = v_md.id
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
    'lineup', case
      when v_lineup.id is null then null
      else jsonb_build_object(
        'total_points', coalesce((select sum(points) from public.scores where lineup_id = v_lineup.id), 0) + coalesce((select sum(points) from public.lineup_coaches where lineup_id = v_lineup.id), 0),
        'players', coalesce(v_players, '[]'::jsonb),
        'coach', v_coach
      )
    end,
    'stats', jsonb_build_object(
      'rank', v_stats.rank,
      'total_points', coalesce(v_stats.total_points, 0),
      'avg_points', case when jsonb_array_length(coalesce(v_hist, '[]'::jsonb)) > 0 then coalesce(v_stats.total_points, 0) / jsonb_array_length(v_hist) else 0 end,
      'history', coalesce(v_hist, '[]'::jsonb)
    )
  );
end;
$function$;

revoke execute on function public.previous_allowed_lineup_slot(timestamp with time zone, integer) from public, anon;
revoke execute on function public.superadmin_generate_lineup_slots(uuid, uuid, timestamp with time zone) from public, anon;
revoke execute on function public.get_home_data(uuid, uuid) from public, anon;

grant execute on function public.superadmin_generate_lineup_slots(uuid, uuid, timestamp with time zone) to authenticated;
grant execute on function public.get_home_data(uuid, uuid) to authenticated;
