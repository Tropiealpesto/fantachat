-- Make player images in Home and Live less fragile by returning stable ids too.

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
      'real_player_id', lp.real_player_id,
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
    'real_coach_id', lc.real_coach_id,
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
                'real_player_id', lp.real_player_id,
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
                'real_coach_id', lc.real_coach_id,
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

revoke execute on function public.get_home_data(uuid, uuid) from public, anon;
revoke execute on function public.get_live_data(uuid) from public, anon;

grant execute on function public.get_home_data(uuid, uuid) to authenticated;
grant execute on function public.get_live_data(uuid) to authenticated;
