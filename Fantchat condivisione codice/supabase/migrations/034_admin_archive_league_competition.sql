-- Admin safety tools for league competitions:
-- 1) archive a league competition instead of deleting data;
-- 2) prevent accidental overwrites when the same competition/season is added twice.

create or replace function public.admin_archive_league_competition(
  p_league_competition_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_league_id uuid;
  v_next_lc uuid;
begin
  select lc.league_id
    into v_league_id
  from public.league_competitions lc
  where lc.id = p_league_competition_id;

  if v_league_id is null then
    raise exception 'Competizione non trovata';
  end if;

  if not public.is_league_admin(v_league_id) then
    raise exception 'Solo admin lega';
  end if;

  update public.league_competitions
  set status = 'archived',
      updated_at = now()
  where id = p_league_competition_id;

  select lc.id
    into v_next_lc
  from public.league_competitions lc
  where lc.league_id = v_league_id
    and lc.status = 'active'
    and lc.id <> p_league_competition_id
  order by lc.created_at desc
  limit 1;

  update public.user_context
  set active_league_competition_id = v_next_lc,
      updated_at = now()
  where active_league_id = v_league_id
    and active_league_competition_id = p_league_competition_id;
end;
$function$;

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
  v_existing_status text;
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

  select lc.id, lc.status
    into v_lc, v_existing_status
  from public.league_competitions lc
  where lc.league_id = p_league_id
    and lc.competition_id = p_competition_id
    and lc.season_id = p_season_id;

  if v_lc is not null then
    if v_existing_status = 'active' then
      raise exception 'Questa competizione e gia presente nella lega. Se devi correggerla, archiviala prima.';
    end if;

    raise exception 'Questa competizione era gia stata archiviata. Chiedi al superadmin se va ripristinata o cancellata definitivamente.';
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
end;
$function$;

revoke execute on function public.admin_archive_league_competition(uuid) from public, anon;
revoke execute on function public.create_league_competition(uuid, uuid, uuid, text, uuid[], jsonb) from public, anon;

grant execute on function public.admin_archive_league_competition(uuid) to authenticated;
grant execute on function public.create_league_competition(uuid, uuid, uuid, text, uuid[], jsonb) to authenticated;
