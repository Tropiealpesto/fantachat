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

  select null::uuid as id, null::integer as number, null::text as status, null::timestamptz as slot_start, null::timestamptz as slot_end
    into v_matchday;

  select null::uuid as id, null::timestamptz as submitted_at
    into v_lineup;

  select null::uuid as id, null::text as status, null::text as error, '[]'::jsonb as players, null::uuid as coach_id
    into v_draft;

  select null::uuid as id, null::integer as slot_order, null::timestamptz as starts_at, null::timestamptz as ends_at
    into v_slot;

  select *
    into v_matchday
  from public.matchdays
  where season_id = v_lc.season_id
    and status = 'open'
  order by number desc
  limit 1;

  if v_matchday.id is null then
    select md.*
      into v_matchday
    from public.matchdays md
    join public.lineups li
      on li.matchday_id = md.id
     and li.league_competition_id = p_league_competition_id
     and li.user_id = auth.uid()
    where md.season_id = v_lc.season_id
    order by md.number desc
    limit 1;
  end if;

  if v_matchday.id is null then
    select *
      into v_matchday
    from public.matchdays
    where season_id = v_lc.season_id
    order by number desc
    limit 1;
  end if;

  if v_matchday.id is not null then
    perform public.process_expired_lineup_drafts(p_league_competition_id, v_matchday.id);

    select *
      into v_slot
    from public.lineup_slots
    where league_competition_id = p_league_competition_id
      and matchday_id = v_matchday.id
      and user_id = auth.uid();

    select *
      into v_lineup
    from public.lineups
    where league_competition_id = p_league_competition_id
      and matchday_id = v_matchday.id
      and user_id = auth.uid();

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
      when v_draft.id is null or v_lineup.id is not null then null
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
    'unavailable_player_ids', coalesce((
      select jsonb_agg(distinct lp.real_player_id)
      from public.lineup_players lp
      join public.lineups li on li.id = lp.lineup_id
      where li.league_competition_id = p_league_competition_id
        and li.matchday_id = v_matchday.id
        and li.user_id <> auth.uid()
        and li.submitted_at is not null
    ), '[]'::jsonb),
    'unavailable_coach_ids', coalesce((
      select jsonb_agg(distinct lc.real_coach_id)
      from public.lineup_coaches lc
      where lc.league_competition_id = p_league_competition_id
        and lc.matchday_id = v_matchday.id
        and lc.user_id <> auth.uid()
    ), '[]'::jsonb),
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

grant execute on function public.get_lineup_form_data(uuid) to authenticated;

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

grant execute on function public.submit_lineup(uuid, uuid, jsonb, uuid) to authenticated;
grant execute on function public.submit_lineup(uuid, uuid, jsonb) to authenticated;
