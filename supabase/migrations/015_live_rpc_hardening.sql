-- FantaChat launch readiness - point 1
-- RPC hardening aligned to the current live Supabase schema.
--
-- This migration intentionally avoids table shape changes.
-- It only strengthens parameter consistency and backend validation.

create or replace function public.create_league_competition(
  p_league_id uuid,
  p_competition_id uuid,
  p_season_id uuid,
  p_name text,
  p_participant_user_ids uuid[],
  p_players_per_role jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lc uuid;
  v_name text;
  v_users uuid[];
  u uuid;
begin
  if not public.is_league_admin(p_league_id) then
    raise exception 'Solo admin lega';
  end if;

  select coalesce(nullif(btrim(p_name), ''), c.name, 'Competizione')
    into v_name
  from public.competitions c
  join public.seasons s on s.competition_id = c.id
  where c.id = p_competition_id
    and s.id = p_season_id
    and coalesce(c.active, true) = true
    and coalesce(s.active, true) = true;

  if v_name is null then
    raise exception 'Competizione o stagione non valida';
  end if;

  v_users := p_participant_user_ids;
  if v_users is null then
    select array_agg(lm.user_id order by lm.team_name)
      into v_users
    from public.league_members lm
    where lm.league_id = p_league_id;
  end if;

  if coalesce(array_length(v_users, 1), 0) = 0 then
    raise exception 'Seleziona almeno un partecipante';
  end if;

  if exists (
    select 1
    from unnest(v_users) as selected_user(user_id)
    where not exists (
      select 1
      from public.league_members lm
      where lm.league_id = p_league_id
        and lm.user_id = selected_user.user_id
    )
  ) then
    raise exception 'Uno o piu partecipanti non appartengono alla lega';
  end if;

  select id
    into v_lc
  from public.league_competitions
  where league_id = p_league_id
    and competition_id = p_competition_id
    and season_id = p_season_id;

  if v_lc is null then
    insert into public.league_competitions(
      league_id,
      competition_id,
      season_id,
      name,
      status,
      players_per_role
    )
    values(
      p_league_id,
      p_competition_id,
      p_season_id,
      v_name,
      'active',
      p_players_per_role
    )
    returning id into v_lc;
  else
    update public.league_competitions
    set name = v_name,
        status = 'active',
        players_per_role = coalesce(p_players_per_role, players_per_role)
    where id = v_lc;
  end if;

  foreach u in array v_users loop
    insert into public.league_competition_members(
      league_competition_id,
      user_id,
      team_name
    )
    select
      v_lc,
      u,
      lm.team_name
    from public.league_members lm
    where lm.league_id = p_league_id
      and lm.user_id = u
    on conflict (league_competition_id, user_id) do nothing;
  end loop;

  if p_players_per_role is not null
     and not exists (
       select 1
       from public.competition_config cc
       where cc.competition_id = p_competition_id
     ) then
    insert into public.competition_config(
      competition_id,
      roles,
      players_per_role
    )
    values(
      p_competition_id,
      '[{"key":"P","label":"Portiere"},{"key":"D","label":"Difensore"},{"key":"C","label":"Centrocampista"},{"key":"A","label":"Attaccante"}]'::jsonb,
      p_players_per_role
    );
  end if;

  insert into public.competition_standings(
    league_competition_id,
    user_id,
    team_name,
    total_points,
    rank
  )
  select
    m.league_competition_id,
    m.user_id,
    m.team_name,
    0,
    row_number() over(order by m.team_name)
  from public.league_competition_members m
  where m.league_competition_id = v_lc
    and not exists (
      select 1
      from public.competition_standings cs
      where cs.league_competition_id = v_lc
        and cs.user_id = m.user_id
    );

  insert into public.user_context(
    user_id,
    active_league_id,
    active_league_competition_id,
    updated_at
  )
  values(auth.uid(), p_league_id, v_lc, now())
  on conflict(user_id) do update
    set active_league_id = excluded.active_league_id,
        active_league_competition_id = excluded.active_league_competition_id,
        updated_at = now();

  return jsonb_build_object('league_competition_id', v_lc);
end
$function$;

create or replace function public.create_nyx_content(
  p_league_id uuid,
  p_league_competition_id uuid,
  p_matchday_id uuid,
  p_title text,
  p_text text,
  p_audio_url text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if not public.is_league_admin(p_league_id) then
    raise exception 'Solo admin lega';
  end if;

  if not exists (
    select 1
    from public.league_competitions lc
    where lc.id = p_league_competition_id
      and lc.league_id = p_league_id
      and lc.status = 'active'
  ) then
    raise exception 'Competizione non valida';
  end if;

  if p_matchday_id is not null and not exists (
    select 1
    from public.matchdays m
    join public.league_competitions lc on lc.season_id = m.season_id
    where m.id = p_matchday_id
      and lc.id = p_league_competition_id
      and lc.league_id = p_league_id
  ) then
    raise exception 'Giornata non valida';
  end if;

  if coalesce(nullif(btrim(p_title), ''), nullif(btrim(p_text), '')) is null then
    raise exception 'Contenuto Nyx vuoto';
  end if;

  insert into public.nyx_content(
    league_id,
    matchday_id,
    text,
    audio_url
  )
  values(
    p_league_id,
    p_matchday_id,
    case
      when coalesce(p_title, '') = '' then p_text
      else p_title || E'\n\n' || coalesce(p_text, '')
    end,
    p_audio_url
  )
  returning id into v_id;

  insert into public.messages(
    league_id,
    user_id,
    matchday_id,
    content,
    kind,
    league_competition_id
  )
  values(
    p_league_id,
    auth.uid(),
    p_matchday_id,
    coalesce(nullif(btrim(p_title), ''), 'Nuova puntata Nyx'),
    'nyx',
    p_league_competition_id
  );

  return v_id;
end
$function$;

create or replace function public.send_chat_message(
  p_league_id uuid,
  p_league_competition_id uuid,
  p_matchday_id uuid,
  p_content text,
  p_kind text default 'text',
  p_meta jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if not public.is_league_member(p_league_id) then
    raise exception 'Accesso negato';
  end if;

  if coalesce(btrim(p_content), '') = '' and coalesce(p_kind, 'text') = 'text' then
    raise exception 'Messaggio vuoto';
  end if;

  if p_league_competition_id is not null and not exists (
    select 1
    from public.league_competitions lc
    where lc.id = p_league_competition_id
      and lc.league_id = p_league_id
      and lc.status = 'active'
  ) then
    raise exception 'Competizione non valida';
  end if;

  if p_matchday_id is not null and not exists (
    select 1
    from public.matchdays m
    join public.league_competitions lc on lc.season_id = m.season_id
    where m.id = p_matchday_id
      and lc.league_id = p_league_id
      and (
        p_league_competition_id is null
        or lc.id = p_league_competition_id
      )
  ) then
    raise exception 'Giornata non valida';
  end if;

  insert into public.messages(
    league_id,
    user_id,
    content,
    kind,
    meta,
    matchday_id,
    league_competition_id
  )
  values(
    p_league_id,
    auth.uid(),
    p_content,
    coalesce(p_kind, 'text'),
    p_meta,
    p_matchday_id,
    p_league_competition_id
  )
  returning id into v_id;

  return v_id;
end
$function$;

create or replace function public.submit_lineup(
  p_league_competition_id uuid,
  p_matchday_id uuid,
  p_players jsonb
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
  v_mdnum int;
  v_rules jsonb;
  v_expected_total int;
  v_selected_total int;
  v_club_violation int;
  v_top_count int;
  v_foreign int;
  v_bad_roles int;
  v_role_mismatch int;
  v_duplicates int;
begin
  select
    lc.id,
    lc.league_id,
    lc.competition_id,
    lc.season_id,
    lc.players_per_role
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

  select number
    into v_mdnum
  from public.matchdays
  where id = p_matchday_id
    and season_id = v_lc.season_id
    and status = 'open';

  if v_mdnum is null then
    raise exception 'Giornata non aperta';
  end if;

  if jsonb_typeof(p_players) is distinct from 'array' then
    raise exception 'Formazione non valida';
  end if;

  v_rules := v_lc.players_per_role;
  if v_rules is null then
    select cc.players_per_role
      into v_rules
    from public.competition_config cc
    where cc.competition_id = v_lc.competition_id
    limit 1;
  end if;

  if v_rules is null or jsonb_typeof(v_rules) is distinct from 'object' then
    raise exception 'Regole formazione mancanti';
  end if;

  select coalesce(sum(value::int), 0)
    into v_expected_total
  from jsonb_each_text(v_rules);

  v_selected_total := jsonb_array_length(p_players);
  if v_selected_total <> v_expected_total then
    raise exception 'Numero giocatori non valido';
  end if;

  with sel as (
    select
      (e->>'real_player_id')::uuid as pid,
      e->>'role' as role
    from jsonb_array_elements(p_players) e
  )
  select count(*)
    into v_bad_roles
  from (
    select role, count(*) as actual
    from sel
    group by role
  ) actual_roles
  full join (
    select key as role, value::int as expected
    from jsonb_each_text(v_rules)
  ) expected_roles using (role)
  where coalesce(actual_roles.actual, 0) <> coalesce(expected_roles.expected, 0);

  if coalesce(v_bad_roles, 0) > 0 then
    raise exception 'Ruoli formazione non validi';
  end if;

  with sel as (
    select
      (e->>'real_player_id')::uuid as pid,
      e->>'role' as role
    from jsonb_array_elements(p_players) e
  )
  select count(*)
    into v_duplicates
  from (
    select pid
    from sel
    group by pid
    having count(*) > 1
  ) d;

  if coalesce(v_duplicates, 0) > 0 then
    raise exception 'Hai selezionato due volte lo stesso giocatore.';
  end if;

  with sel as (
    select
      (e->>'real_player_id')::uuid as pid,
      e->>'role' as role
    from jsonb_array_elements(p_players) e
  )
  select
    count(*) filter (
      where rp.id is null
         or rp.competition_id is distinct from v_lc.competition_id
         or coalesce(rp.active, true) = false
    ),
    count(*) filter (where rp.id is not null and rp.role is distinct from sel.role),
    count(*) filter (where tt.real_team_id is not null)
  into v_foreign, v_role_mismatch, v_top_count
  from sel
  left join public.real_players rp on rp.id = sel.pid
  left join public.top_teams tt
    on tt.competition_id = v_lc.competition_id
   and tt.season_id = v_lc.season_id
   and tt.matchday_number = v_mdnum
   and tt.real_team_id = rp.real_team_id;

  if coalesce(v_foreign, 0) > 0 then
    raise exception 'Hai selezionato un giocatore che non appartiene a questa competizione.';
  end if;

  if coalesce(v_role_mismatch, 0) > 0 then
    raise exception 'Il ruolo di un giocatore non corrisponde al ruolo reale.';
  end if;

  if coalesce(v_top_count, 0) > 1 then
    raise exception 'Puoi schierare al massimo un giocatore di una Top squadra (il capitano).';
  end if;

  with sel as (
    select (e->>'real_player_id')::uuid as pid
    from jsonb_array_elements(p_players) e
  ),
  info as (
    select coalesce(rp.real_team_id::text, nullif(btrim(rp.team), '')) as club_key
    from sel
    join public.real_players rp on rp.id = sel.pid
  )
  select count(*)
    into v_club_violation
  from (
    select club_key
    from info
    where club_key is not null
    group by club_key
    having count(*) > 1
  ) c;

  if coalesce(v_club_violation, 0) > 0 then
    raise exception 'Puoi schierare al massimo un giocatore per squadra.';
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
end
$function$;

revoke execute on function public.create_league_competition(uuid, uuid, uuid, text, uuid[], jsonb) from public;
revoke execute on function public.create_nyx_content(uuid, uuid, uuid, text, text, text) from public;
revoke execute on function public.send_chat_message(uuid, uuid, uuid, text, text, jsonb) from public;
revoke execute on function public.submit_lineup(uuid, uuid, jsonb) from public;

revoke execute on function public.create_league_competition(uuid, uuid, uuid, text, uuid[], jsonb) from anon;
revoke execute on function public.create_nyx_content(uuid, uuid, uuid, text, text, text) from anon;
revoke execute on function public.send_chat_message(uuid, uuid, uuid, text, text, jsonb) from anon;
revoke execute on function public.submit_lineup(uuid, uuid, jsonb) from anon;

grant execute on function public.create_league_competition(uuid, uuid, uuid, text, uuid[], jsonb) to authenticated;
grant execute on function public.create_nyx_content(uuid, uuid, uuid, text, text, text) to authenticated;
grant execute on function public.send_chat_message(uuid, uuid, uuid, text, text, jsonb) to authenticated;
grant execute on function public.submit_lineup(uuid, uuid, jsonb) to authenticated;
