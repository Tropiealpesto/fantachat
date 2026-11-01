-- FantaChat - dynamic Top 6 lineup limit
--
-- The number of players allowed from Top 6 teams is 25% of the selected
-- formation size, rounded up. Examples: 4 -> 1, 7 -> 2, 11 -> 3.

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
  v_top_limit int;
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
    raise exception 'Puoi schierare al massimo % giocatori delle Top 6', v_top_limit;
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

revoke execute on function public.apply_lineup_for_user(uuid, uuid, uuid, jsonb, uuid, boolean) from public, anon;
