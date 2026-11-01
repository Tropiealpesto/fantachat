-- Return player and coach images directly from the mobile read-model RPCs.
-- This avoids fragile client-side lookups by name/team and makes Home, Rosa
-- and Live render player faces consistently.

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
      'team', coalesce(rt.name, rp.team),
      'points', s.points,
      'image_url', coalesce(rp.image_url, rt.logo_url)
    )
    order by lp.role
  ), '[]'::jsonb)
  into v_players
  from public.lineup_players lp
  join public.real_players rp on rp.id = lp.real_player_id
  left join public.real_teams rt on rt.id = rp.real_team_id
  left join public.scores s on s.lineup_id = lp.lineup_id and s.real_player_id = lp.real_player_id
  where lp.lineup_id = v_lineup.id;

  select jsonb_build_object(
    'name', rc.name,
    'team', rt.name,
    'points', lc.points,
    'image_url', coalesce(rc.image_url, rt.logo_url)
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

create or replace function public.get_live_data(
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
  where id = p_league_competition_id;

  if v_lc.league_id is null or not public.is_league_member(v_lc.league_id) then
    raise exception 'Accesso negato';
  end if;

  select *
    into v_md
  from public.matchdays
  where season_id = v_lc.season_id
    and status in ('open', 'completed', 'locked')
  order by case status when 'open' then 0 else 1 end, number desc
  limit 1;

  return jsonb_build_object(
    'matchday', case when v_md.id is null then null else jsonb_build_object('id', v_md.id, 'number', v_md.number, 'status', v_md.status) end,
    'rows', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.rank)
      from (
        select
          lcm.user_id,
          coalesce(lcm.team_name, 'Squadra') as team_name,
          coalesce(pts.live_score, 0) as live_score,
          coalesce(cs.total_points, 0) as projected_total,
          row_number() over(order by coalesce(pts.live_score, 0) desc, coalesce(lcm.team_name, 'Squadra')) as rank,
          coalesce((
            select jsonb_agg(item order by item->>'role', item->>'name')
            from (
              select jsonb_build_object(
                'role', lp.role,
                'name', rp.name,
                'team', coalesce(rt.name, rp.team),
                'points', sc.points,
                'image_url', coalesce(rp.image_url, rt.logo_url)
              ) as item
              from public.lineups li2
              join public.lineup_players lp on lp.lineup_id = li2.id
              join public.real_players rp on rp.id = lp.real_player_id
              left join public.real_teams rt on rt.id = rp.real_team_id
              left join public.scores sc on sc.lineup_id = li2.id and sc.real_player_id = lp.real_player_id
              where li2.league_competition_id = p_league_competition_id
                and li2.matchday_id = v_md.id
                and li2.user_id = lcm.user_id
              union all
              select jsonb_build_object(
                'role', 'AL',
                'name', rc.name,
                'team', rt.name,
                'points', lc.points,
                'image_url', coalesce(rc.image_url, rt.logo_url)
              ) as item
              from public.lineups li3
              join public.lineup_coaches lc on lc.lineup_id = li3.id
              join public.real_coaches rc on rc.id = lc.real_coach_id
              join public.real_teams rt on rt.id = rc.real_team_id
              where li3.league_competition_id = p_league_competition_id
                and li3.matchday_id = v_md.id
                and li3.user_id = lcm.user_id
            ) z
          ), '[]'::jsonb) as players
        from public.league_competition_members lcm
        left join lateral (
          select coalesce((
            select sum(s.points)
            from public.lineups li
            join public.scores s on s.lineup_id = li.id
            where li.league_competition_id = p_league_competition_id
              and li.matchday_id = v_md.id
              and li.user_id = lcm.user_id
          ), 0) + coalesce((
            select sum(lcoach.points)
            from public.lineups li
            join public.lineup_coaches lcoach on lcoach.lineup_id = li.id
            where li.league_competition_id = p_league_competition_id
              and li.matchday_id = v_md.id
              and li.user_id = lcm.user_id
          ), 0) as live_score
        ) pts on true
        left join public.competition_standings cs
          on cs.league_competition_id = p_league_competition_id
         and cs.user_id = lcm.user_id
        where lcm.league_competition_id = p_league_competition_id
      ) r
    ), '[]'::jsonb)
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
            'team', rt.name,
            'image_url', coalesce(rc.image_url, rt.logo_url)
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
          'team', coalesce(rt.name, rp.team),
          'real_team_id', rp.real_team_id,
          'image_url', coalesce(rp.image_url, rt.logo_url)
        )
        order by rp.role, rp.name
      )
      from public.real_players rp
      left join public.real_teams rt on rt.id = rp.real_team_id
      where rp.competition_id = v_lc.competition_id
        and coalesce(rp.active, true)
    ), '[]'::jsonb),
    'coaches', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', rc.id,
          'name', rc.name,
          'team', rt.name,
          'real_team_id', rc.real_team_id,
          'image_url', coalesce(rc.image_url, rt.logo_url)
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

drop function if exists public.get_home_top_players(uuid, integer);

create or replace function public.get_home_top_players(
  p_league_competition_id uuid,
  p_limit integer default 6
)
returns table(
  name text,
  role text,
  team text,
  points numeric,
  image_url text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lc record;
  v_md_id uuid;
begin
  select lc.id, lc.league_id, lc.season_id, lc.competition_id
    into v_lc
  from public.league_competitions lc
  where lc.id = p_league_competition_id;

  if v_lc.id is null or not public.is_league_member(v_lc.league_id) then
    return;
  end if;

  select m.id
    into v_md_id
  from public.matchdays m
  where m.season_id = v_lc.season_id
    and exists (
      select 1
      from public.lineups l
      join public.scores s on s.lineup_id = l.id
      where l.league_competition_id = p_league_competition_id
        and l.matchday_id = m.id
    )
  order by m.number desc
  limit 1;

  if v_md_id is null then
    return;
  end if;

  return query
  select t.name, t.role, t.team, t.points, t.image_url
  from (
    select distinct on (s.real_player_id)
      rp.name,
      rp.role,
      coalesce(rt.name, rp.team) as team,
      s.points,
      coalesce(rp.image_url, rt.logo_url) as image_url
    from public.scores s
    join public.lineups l on l.id = s.lineup_id
    join public.real_players rp on rp.id = s.real_player_id
    left join public.real_teams rt on rt.id = rp.real_team_id
    where l.league_competition_id = p_league_competition_id
      and l.matchday_id = v_md_id
    order by s.real_player_id, s.points desc
  ) t
  order by t.points desc, t.name
  limit greatest(1, coalesce(p_limit, 6));
end;
$function$;

revoke execute on function public.get_home_data(uuid, uuid) from public, anon;
revoke execute on function public.get_live_data(uuid) from public, anon;
revoke execute on function public.get_lineup_form_data(uuid) from public, anon;
revoke execute on function public.get_home_top_players(uuid, integer) from public, anon;

grant execute on function public.get_home_data(uuid, uuid) to authenticated;
grant execute on function public.get_live_data(uuid) to authenticated;
grant execute on function public.get_lineup_form_data(uuid) to authenticated;
grant execute on function public.get_home_top_players(uuid, integer) to authenticated;
