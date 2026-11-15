-- FantaChat - enforce lineup rules during drafts and keep formation events out of chat.

create or replace function public.validate_lineup_selection(
  p_league_competition_id uuid,
  p_matchday_id uuid,
  p_user_id uuid,
  p_players jsonb,
  p_coach_id uuid default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lc record;
  v_rules jsonb;
  v_expected_total int;
  v_selected_total int;
  v_top_limit int;
  v_club_violation int;
  v_top_count int;
  v_foreign int;
  v_bad_roles int;
  v_role_mismatch int;
  v_duplicates int;
  v_taken_players int;
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

  v_top_limit := greatest(1, ceil(v_expected_total::numeric * 0.25)::int);

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

  if v_top_count > v_top_limit then
    raise exception 'Puoi schierare al massimo % giocatori delle Top squadre', v_top_limit;
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

  perform public.validate_lineup_selection(
    p_league_competition_id,
    p_matchday_id,
    auth.uid(),
    p_players,
    p_coach_id
  );

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

create or replace function public.get_lineup_taken_player_info(
  p_league_competition_id uuid,
  p_matchday_id uuid
)
returns table(
  real_player_id uuid,
  owner_team_name text
)
language sql
security definer
set search_path to 'public'
as $function$
  select distinct
    lp.real_player_id,
    coalesce(lcm.team_name, lm.team_name, 'un altro utente') as owner_team_name
  from public.lineup_players lp
  join public.lineups li on li.id = lp.lineup_id
  left join public.league_competition_members lcm
    on lcm.league_competition_id = li.league_competition_id
   and lcm.user_id = li.user_id
  left join public.league_members lm
    on lm.league_id = li.league_id
   and lm.user_id = li.user_id
  where li.league_competition_id = p_league_competition_id
    and li.matchday_id = p_matchday_id
    and li.user_id <> auth.uid()
    and li.submitted_at is not null
    and public.is_league_member(li.league_id);
$function$;

drop function if exists public.get_chat_messages(uuid, integer);

create or replace function public.get_chat_messages(
  p_league_id uuid,
  p_limit integer default 200
)
returns table(
  id uuid,
  league_id uuid,
  league_competition_id uuid,
  user_id uuid,
  kind text,
  content text,
  meta jsonb,
  matchday_id uuid,
  matchday_number integer,
  created_at timestamptz,
  team_name text
)
language sql
security definer
set search_path to 'public'
as $function$
  select
    m.id,
    m.league_id,
    m.league_competition_id,
    m.user_id,
    coalesce(m.kind, m.message_type, 'text') as kind,
    m.content,
    coalesce(m.meta, m.mentions_data) as meta,
    m.matchday_id,
    md.number as matchday_number,
    m.created_at,
    coalesce(lcm.team_name, lm.team_name, 'Squadra') as team_name
  from public.messages m
  left join public.matchdays md on md.id = m.matchday_id
  left join public.league_competition_members lcm
    on lcm.league_competition_id = m.league_competition_id
   and lcm.user_id = m.user_id
  left join public.league_members lm
    on lm.league_id = m.league_id
   and lm.user_id = m.user_id
  where m.league_id = p_league_id
    and public.is_league_member(p_league_id)
    and coalesce(m.moderation_status, 'visible') = 'visible'
    and coalesce(m.kind, m.message_type, 'text') not in ('lineup', 'lineup_notification')
    and not exists (
      select 1
      from public.chat_user_blocks b
      where b.blocker_id = auth.uid()
        and b.blocked_id = m.user_id
    )
  order by m.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 500));
$function$;

revoke execute on function public.validate_lineup_selection(uuid, uuid, uuid, jsonb, uuid) from public, anon;
revoke execute on function public.save_lineup_draft(uuid, uuid, jsonb, uuid) from public, anon;
revoke execute on function public.get_lineup_taken_player_info(uuid, uuid) from public, anon;
revoke execute on function public.get_chat_messages(uuid, integer) from public, anon;

grant execute on function public.validate_lineup_selection(uuid, uuid, uuid, jsonb, uuid) to authenticated;
grant execute on function public.save_lineup_draft(uuid, uuid, jsonb, uuid) to authenticated;
grant execute on function public.get_lineup_taken_player_info(uuid, uuid) to authenticated;
grant execute on function public.get_chat_messages(uuid, integer) to authenticated;
