-- FantaChat launch readiness - point 6
-- Recovery snapshots for risky matchday operations.
--
-- Purpose:
-- - take an application-level snapshot before vote imports, recalculations
--   or finalization;
-- - restore league-local matchday state if a calculation/import corrupts
--   lineups, scores or standings.
--
-- This does not replace Supabase platform backups or point-in-time recovery.

create table if not exists public.recovery_snapshots (
  id uuid primary key default gen_random_uuid(),
  league_competition_id uuid not null references public.league_competitions(id) on delete cascade,
  matchday_id uuid not null references public.matchdays(id) on delete cascade,
  created_by uuid,
  reason text,
  payload jsonb not null,
  restored_at timestamp with time zone,
  restored_by uuid,
  created_at timestamp with time zone not null default now()
);

alter table public.recovery_snapshots enable row level security;

create index if not exists recovery_snapshots_lc_matchday_created_idx
on public.recovery_snapshots(league_competition_id, matchday_id, created_at desc);

create or replace function public.superadmin_list_recovery_snapshots(
  p_league_competition_id uuid default null
)
returns table(
  id uuid,
  league_competition_id uuid,
  matchday_id uuid,
  reason text,
  restored_at timestamp with time zone,
  created_at timestamp with time zone
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_app_admin() then
    raise exception 'Solo superadmin';
  end if;

  return query
  select rs.id, rs.league_competition_id, rs.matchday_id, rs.reason, rs.restored_at, rs.created_at
  from public.recovery_snapshots rs
  where p_league_competition_id is null
     or rs.league_competition_id = p_league_competition_id
  order by rs.created_at desc;
end;
$function$;

create or replace function public.superadmin_create_matchday_recovery_snapshot(
  p_league_competition_id uuid,
  p_matchday_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_snapshot_id uuid;
  v_payload jsonb;
begin
  if not public.is_app_admin() then
    raise exception 'Solo superadmin';
  end if;

  if not exists (
    select 1
    from public.league_competitions lc
    join public.matchdays md on md.id = p_matchday_id and md.season_id = lc.season_id
    where lc.id = p_league_competition_id
  ) then
    raise exception 'Competizione o giornata non valida';
  end if;

  select jsonb_build_object(
    'matchday', (
      select to_jsonb(md)
      from public.matchdays md
      where md.id = p_matchday_id
    ),
    'lineups', coalesce((
      select jsonb_agg(to_jsonb(li) order by li.submitted_at, li.id)
      from public.lineups li
      where li.league_competition_id = p_league_competition_id
        and li.matchday_id = p_matchday_id
    ), '[]'::jsonb),
    'lineup_players', coalesce((
      select jsonb_agg(to_jsonb(lp) order by lp.lineup_id, lp.role, lp.id)
      from public.lineup_players lp
      join public.lineups li on li.id = lp.lineup_id
      where li.league_competition_id = p_league_competition_id
        and li.matchday_id = p_matchday_id
    ), '[]'::jsonb),
    'scores', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.lineup_id, s.role, s.id)
      from public.scores s
      join public.lineups li on li.id = s.lineup_id
      where li.league_competition_id = p_league_competition_id
        and li.matchday_id = p_matchday_id
    ), '[]'::jsonb),
    'competition_standings', coalesce((
      select jsonb_agg(to_jsonb(cs) order by cs.rank nulls last, cs.team_name, cs.user_id)
      from public.competition_standings cs
      where cs.league_competition_id = p_league_competition_id
    ), '[]'::jsonb)
  )
  into v_payload;

  insert into public.recovery_snapshots(
    league_competition_id,
    matchday_id,
    created_by,
    reason,
    payload
  )
  values (
    p_league_competition_id,
    p_matchday_id,
    auth.uid(),
    p_reason,
    v_payload
  )
  returning id into v_snapshot_id;

  return v_snapshot_id;
end;
$function$;

create or replace function public.superadmin_restore_matchday_recovery_snapshot(
  p_snapshot_id uuid
)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lc_id uuid;
  v_matchday_id uuid;
  v_payload jsonb;
begin
  if not public.is_app_admin() then
    raise exception 'Solo superadmin';
  end if;

  select league_competition_id, matchday_id, payload
    into v_lc_id, v_matchday_id, v_payload
  from public.recovery_snapshots
  where id = p_snapshot_id;

  if v_lc_id is null then
    raise exception 'Snapshot non trovato';
  end if;

  if v_payload ? 'matchday' then
    insert into public.matchdays
    select *
    from jsonb_populate_record(null::public.matchdays, v_payload -> 'matchday')
    on conflict (id) do update set
      season_id = excluded.season_id,
      number = excluded.number,
      status = excluded.status,
      slot_start = excluded.slot_start,
      slot_end = excluded.slot_end,
      created_at = excluded.created_at;
  end if;

  delete from public.scores s
  using public.lineups li
  where s.lineup_id = li.id
    and li.league_competition_id = v_lc_id
    and li.matchday_id = v_matchday_id;

  delete from public.lineup_players lp
  using public.lineups li
  where lp.lineup_id = li.id
    and li.league_competition_id = v_lc_id
    and li.matchday_id = v_matchday_id;

  delete from public.lineups
  where league_competition_id = v_lc_id
    and matchday_id = v_matchday_id;

  delete from public.competition_standings
  where league_competition_id = v_lc_id;

  if jsonb_array_length(coalesce(v_payload -> 'lineups', '[]'::jsonb)) > 0 then
    insert into public.lineups
    select *
    from jsonb_populate_recordset(null::public.lineups, v_payload -> 'lineups');
  end if;

  if jsonb_array_length(coalesce(v_payload -> 'lineup_players', '[]'::jsonb)) > 0 then
    insert into public.lineup_players
    select *
    from jsonb_populate_recordset(null::public.lineup_players, v_payload -> 'lineup_players');
  end if;

  if jsonb_array_length(coalesce(v_payload -> 'scores', '[]'::jsonb)) > 0 then
    insert into public.scores
    select *
    from jsonb_populate_recordset(null::public.scores, v_payload -> 'scores');
  end if;

  if jsonb_array_length(coalesce(v_payload -> 'competition_standings', '[]'::jsonb)) > 0 then
    insert into public.competition_standings
    select *
    from jsonb_populate_recordset(null::public.competition_standings, v_payload -> 'competition_standings');
  end if;

  update public.recovery_snapshots
  set restored_at = now(),
      restored_by = auth.uid()
  where id = p_snapshot_id;

  return 'Snapshot ripristinato';
end;
$function$;

revoke all on function public.superadmin_list_recovery_snapshots(uuid) from public, anon;
revoke all on function public.superadmin_create_matchday_recovery_snapshot(uuid, uuid, text) from public, anon;
revoke all on function public.superadmin_restore_matchday_recovery_snapshot(uuid) from public, anon;

grant execute on function public.superadmin_list_recovery_snapshots(uuid) to authenticated;
grant execute on function public.superadmin_create_matchday_recovery_snapshot(uuid, uuid, text) to authenticated;
grant execute on function public.superadmin_restore_matchday_recovery_snapshot(uuid) to authenticated;
