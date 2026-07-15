-- FantaChat - coach support
--
-- Coach is a separate lineup entity:
-- - mandatory only when coach_enabled is true;
-- - not part of player Top/team constraints;
-- - not duplicable inside the same league competition and matchday;
-- - multiplier is 0 when disabled, so imported coach/team stats can always exist.

alter table public.league_competitions
  add column if not exists coach_enabled boolean not null default false,
  add column if not exists coach_multiplier numeric not null default 0;

create table if not exists public.real_coaches (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  real_team_id uuid not null references public.real_teams(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  unique (competition_id, real_team_id)
);

create table if not exists public.coach_stats (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  matchday_number integer not null,
  real_team_id uuid not null references public.real_teams(id) on delete cascade,
  result text,
  npxg numeric,
  possession numeric,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (competition_id, season_id, matchday_number, real_team_id),
  check (result is null or result in ('win', 'draw', 'loss'))
);

create table if not exists public.lineup_coaches (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid not null references public.lineups(id) on delete cascade,
  league_competition_id uuid not null references public.league_competitions(id) on delete cascade,
  matchday_id uuid not null references public.matchdays(id) on delete cascade,
  user_id uuid not null,
  real_coach_id uuid not null references public.real_coaches(id) on delete restrict,
  points numeric not null default 0,
  created_at timestamp with time zone not null default now(),
  unique (lineup_id),
  unique (league_competition_id, matchday_id, real_coach_id)
);

alter table public.real_coaches enable row level security;
alter table public.coach_stats enable row level security;
alter table public.lineup_coaches enable row level security;

create index if not exists real_coaches_comp_active_team_idx
on public.real_coaches(competition_id, active, real_team_id);

create index if not exists coach_stats_lookup_idx
on public.coach_stats(competition_id, season_id, matchday_number, real_team_id);

create index if not exists lineup_coaches_lineup_idx
on public.lineup_coaches(lineup_id);

create index if not exists lineup_coaches_lc_matchday_user_idx
on public.lineup_coaches(league_competition_id, matchday_id, user_id);

create or replace function public.compute_coach_points(
  p_result text,
  p_npxg numeric,
  p_possession numeric,
  p_multiplier numeric default 1
)
returns numeric
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  v_possession numeric;
  v_points numeric;
begin
  v_possession := case
    when p_possession is null then 0
    when p_possession <= 1 then p_possession * 100
    else p_possession
  end;

  v_points :=
    case p_result
      when 'win' then 1
      when 'loss' then -1
      else 0
    end
    + coalesce(p_npxg, 0)
    + case when v_possession >= 60 then 0.5 else 0 end;

  v_points := least(3, greatest(-1, v_points));

  return round(v_points * coalesce(p_multiplier, 0), 3);
end;
$function$;

create or replace function public.set_coach_mode(
  p_league_competition_id uuid,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_league_id uuid;
begin
  select league_id
    into v_league_id
  from public.league_competitions
  where id = p_league_competition_id;

  if v_league_id is null then
    raise exception 'Competizione non valida';
  end if;

  if not public.is_league_admin(v_league_id) then
    raise exception 'Solo admin lega';
  end if;

  update public.league_competitions
  set coach_enabled = coalesce(p_enabled, false),
      coach_multiplier = case when coalesce(p_enabled, false) then 1 else 0 end
  where id = p_league_competition_id;
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
  v_players_per_role jsonb;
begin
  select *
    into v_lc
  from public.league_competitions
  where id = p_league_competition_id;

  if v_lc.id is null or not public.is_league_member(v_lc.league_id) then
    raise exception 'Accesso negato';
  end if;

  select *
    into v_matchday
  from public.matchdays
  where season_id = v_lc.season_id
    and status = 'open'
  order by number desc
  limit 1;

  select *
    into v_lineup
  from public.lineups
  where league_competition_id = p_league_competition_id
    and matchday_id = v_matchday.id
    and user_id = auth.uid();

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
    'matchday', case
      when v_matchday.id is null then null
      else jsonb_build_object(
        'id', v_matchday.id,
        'number', v_matchday.number,
        'status', v_matchday.status
      )
    end,
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
    ), '[]'::jsonb),
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
            order by lp.role, lp.id
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
    end
  );
end;
$function$;

drop function if exists public.submit_lineup(uuid, uuid, jsonb);

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
  v_lineup_id uuid;
  v_item jsonb;
  v_team text;
  v_uid uuid := auth.uid();
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
    lc.players_per_role,
    coalesce(lc.coach_enabled, false) as coach_enabled
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

  if not exists (
    select 1
    from public.matchdays md
    where md.id = p_matchday_id
      and md.season_id = v_lc.season_id
      and md.status = 'open'
  ) then
    raise exception 'Giornata non aperta';
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
      and lc.user_id <> v_uid
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
    select rp.team
    from jsonb_array_elements(p_players) item
    join public.real_players rp on rp.id = (item->>'real_player_id')::uuid
    group by rp.team
    having count(*) > 1
  ) x;

  if v_club_violation > 0 then
    raise exception 'Puoi schierare al massimo un giocatore per squadra';
  end if;

  select count(*)
    into v_top_count
  from jsonb_array_elements(p_players) item
  join public.real_players rp on rp.id = (item->>'real_player_id')::uuid
  join public.real_teams rt
    on rt.competition_id = v_lc.competition_id
   and lower(rt.name) = lower(rp.team)
  join public.top_teams tt
    on tt.real_team_id = rt.id
   and tt.competition_id = v_lc.competition_id
   and tt.season_id = v_lc.season_id
   and tt.matchday_number = (
     select number from public.matchdays where id = p_matchday_id
   );

  if v_top_count > 1 then
    raise exception 'Puoi schierare al massimo un giocatore di una Top squadra';
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
      v_uid,
      p_coach_id
    );
  end if;

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
end;
$function$;

create or replace function public.recalc_competition_matchday(
  p_league_competition_id uuid,
  p_matchday_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_comp uuid;
  v_season uuid;
  v_mdnum int;
  v_ruleset text;
  v_coach_multiplier numeric;
begin
  select competition_id, season_id, scoring_ruleset, coach_multiplier
    into v_comp, v_season, v_ruleset, v_coach_multiplier
  from public.league_competitions
  where id = p_league_competition_id;

  select number into v_mdnum
  from public.matchdays
  where id = p_matchday_id;

  if v_comp is null or v_mdnum is null then
    raise exception 'Competizione o giornata non valida';
  end if;

  delete from public.scores
  where lineup_id in (
    select id
    from public.lineups
    where league_competition_id = p_league_competition_id
      and matchday_id = p_matchday_id
  );

  insert into public.scores(lineup_id, real_player_id, role, points)
  select
    li.id,
    lp.real_player_id,
    lp.role,
    public.compute_player_points_v2(
      v_ruleset,
      lp.role,
      coalesce(ps.goals, 0),
      coalesce(ps.assists, 0),
      coalesce(ps.yellow, 0),
      coalesce(ps.red, 0),
      coalesce(ps.pen_missed, 0),
      coalesce(ps.pen_saved, 0),
      coalesce(ps.goals_conceded, 0),
      coalesce(ps.clean_sheet, false),
      ps.xg,
      ps.xa,
      coalesce(ps.passes_completed, 0),
      ps.pass_accuracy,
      coalesce(ps.tackles, 0),
      coalesce(ps.interceptions, 0),
      ps.npxg,
      coalesce(ps.saves, 0),
      ps.save_pct
    )
  from public.lineups li
  join public.lineup_players lp on lp.lineup_id = li.id
  left join public.player_stats ps
    on ps.real_player_id = lp.real_player_id
   and ps.competition_id = v_comp
   and ps.season_id = v_season
   and ps.matchday_number = v_mdnum
  where li.league_competition_id = p_league_competition_id
    and li.matchday_id = p_matchday_id;

  update public.lineup_coaches lc
  set points = public.compute_coach_points(cs.result, cs.npxg, cs.possession, v_coach_multiplier)
  from public.real_coaches rc
  left join public.coach_stats cs
    on cs.real_team_id = rc.real_team_id
   and cs.competition_id = v_comp
   and cs.season_id = v_season
   and cs.matchday_number = v_mdnum
  where lc.real_coach_id = rc.id
    and lc.league_competition_id = p_league_competition_id
    and lc.matchday_id = p_matchday_id;

  update public.competition_standings cs
  set total_points = t.tot,
      updated_at = now()
  from (
    select
      lcm.user_id,
      coalesce((
        select sum(s.points)
        from public.lineups li
        join public.scores s on s.lineup_id = li.id
        where li.league_competition_id = p_league_competition_id
          and li.user_id = lcm.user_id
      ), 0) + coalesce((
        select sum(lcoach.points)
        from public.lineups li
        join public.lineup_coaches lcoach on lcoach.lineup_id = li.id
        where li.league_competition_id = p_league_competition_id
          and li.user_id = lcm.user_id
      ), 0) as tot
    from public.league_competition_members lcm
    where lcm.league_competition_id = p_league_competition_id
  ) t
  where cs.league_competition_id = p_league_competition_id
    and cs.user_id = t.user_id;

  insert into public.competition_standings(
    league_competition_id,
    user_id,
    team_name,
    total_points,
    rank
  )
  select
    p_league_competition_id,
    lcm.user_id,
    coalesce(lcm.team_name, 'Squadra'),
    coalesce((
      select sum(s.points)
      from public.lineups li
      join public.scores s on s.lineup_id = li.id
      where li.league_competition_id = p_league_competition_id
        and li.user_id = lcm.user_id
    ), 0) + coalesce((
      select sum(lcoach.points)
      from public.lineups li
      join public.lineup_coaches lcoach on lcoach.lineup_id = li.id
      where li.league_competition_id = p_league_competition_id
        and li.user_id = lcm.user_id
    ), 0),
    0
  from public.league_competition_members lcm
  where lcm.league_competition_id = p_league_competition_id
    and not exists (
      select 1
      from public.competition_standings cs
      where cs.league_competition_id = p_league_competition_id
        and cs.user_id = lcm.user_id
    );

  with r as (
    select user_id, row_number() over(order by total_points desc, team_name) as rnk
    from public.competition_standings
    where league_competition_id = p_league_competition_id
  )
  update public.competition_standings cs
  set rank = r.rnk
  from r
  where cs.league_competition_id = p_league_competition_id
    and cs.user_id = r.user_id;
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
        'slot_end', v_md.slot_end
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
              select jsonb_build_object('role', lp.role, 'name', rp.name, 'team', rp.team, 'points', sc.points) as item
              from public.lineups li2
              join public.lineup_players lp on lp.lineup_id = li2.id
              join public.real_players rp on rp.id = lp.real_player_id
              left join public.scores sc on sc.lineup_id = li2.id and sc.real_player_id = lp.real_player_id
              where li2.league_competition_id = p_league_competition_id
                and li2.matchday_id = v_md.id
                and li2.user_id = lcm.user_id
              union all
              select jsonb_build_object('role', 'AL', 'name', rc.name, 'team', rt.name, 'points', lc.points) as item
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

create or replace function public.get_user_history(
  p_league_competition_id uuid
)
returns table(
  matchday_id uuid,
  matchday_number integer,
  status text,
  total_score numeric,
  rank integer
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lc record;
begin
  select *
    into v_lc
  from public.league_competitions
  where id = p_league_competition_id;

  if v_lc.league_id is null or not public.is_league_member(v_lc.league_id) then
    raise exception 'Accesso negato';
  end if;

  return query
  with team_scores as (
    select
      li.matchday_id,
      li.user_id,
      coalesce((
        select sum(s.points)
        from public.scores s
        where s.lineup_id = li.id
      ), 0) + coalesce((
        select sum(lc.points)
        from public.lineup_coaches lc
        where lc.lineup_id = li.id
      ), 0) as score
    from public.lineups li
    where li.league_competition_id = p_league_competition_id
  ), ranked as (
    select
      ts.*,
      row_number() over(partition by ts.matchday_id order by ts.score desc, lcm.team_name) as rnk
    from team_scores ts
    join public.league_competition_members lcm
      on lcm.league_competition_id = p_league_competition_id
     and lcm.user_id = ts.user_id
  )
  select md.id, md.number, md.status, r.score, r.rnk::int
  from ranked r
  join public.matchdays md on md.id = r.matchday_id
  where r.user_id = auth.uid()
  order by md.number desc;
end;
$function$;

create or replace function public.get_matchday_detail(
  p_matchday_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_matchday record;
  v_lc record;
begin
  select *
    into v_matchday
  from public.matchdays
  where id = p_matchday_id;

  select lc.*
    into v_lc
  from public.league_competitions lc
  where lc.season_id = v_matchday.season_id
    and public.is_league_member(lc.league_id)
  limit 1;

  if v_lc.id is null then
    raise exception 'Accesso negato';
  end if;

  return jsonb_build_object(
    'matchday_number', v_matchday.number,
    'rows', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.rank)
      from (
        select
          li.user_id,
          coalesce(lcm.team_name, 'Squadra') as team_name,
          coalesce((
            select sum(s.points)
            from public.scores s
            where s.lineup_id = li.id
          ), 0) + coalesce((
            select sum(lcoach.points)
            from public.lineup_coaches lcoach
            where lcoach.lineup_id = li.id
          ), 0) as total_score,
          row_number() over(order by
            coalesce((select sum(s.points) from public.scores s where s.lineup_id = li.id), 0)
            + coalesce((select sum(lcoach.points) from public.lineup_coaches lcoach where lcoach.lineup_id = li.id), 0)
            desc,
            coalesce(lcm.team_name, 'Squadra')
          ) as rank,
          coalesce((
            select jsonb_agg(item order by item->>'role', item->>'name')
            from (
              select jsonb_build_object('role', lp.role, 'name', rp.name, 'team', rp.team, 'points', sc.points) as item
              from public.lineup_players lp
              join public.real_players rp on rp.id = lp.real_player_id
              left join public.scores sc on sc.lineup_id = lp.lineup_id and sc.real_player_id = lp.real_player_id
              where lp.lineup_id = li.id
              union all
              select jsonb_build_object('role', 'AL', 'name', rc.name, 'team', rt.name, 'points', lc.points) as item
              from public.lineup_coaches lc
              join public.real_coaches rc on rc.id = lc.real_coach_id
              join public.real_teams rt on rt.id = rc.real_team_id
              where lc.lineup_id = li.id
            ) z
          ), '[]'::jsonb) as players
        from public.lineups li
        join public.league_competition_members lcm
          on lcm.league_competition_id = li.league_competition_id
         and lcm.user_id = li.user_id
        where li.matchday_id = p_matchday_id
          and li.league_competition_id = v_lc.id
      ) r
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.superadmin_upsert_coach(
  p_competition_id uuid,
  p_real_team_id uuid,
  p_name text,
  p_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if not public.is_app_admin() then
    raise exception 'Solo superadmin';
  end if;

  insert into public.real_coaches(competition_id, real_team_id, name, active)
  values(p_competition_id, p_real_team_id, trim(p_name), coalesce(p_active, true))
  on conflict (competition_id, real_team_id)
  do update set name = excluded.name,
                active = excluded.active
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.superadmin_upsert_coach_stats(
  p_competition_id uuid,
  p_season_id uuid,
  p_matchday_number integer,
  p_real_team_id uuid,
  p_result text,
  p_npxg numeric,
  p_possession numeric
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  if not public.is_app_admin() then
    raise exception 'Solo superadmin';
  end if;

  insert into public.coach_stats(
    competition_id,
    season_id,
    matchday_number,
    real_team_id,
    result,
    npxg,
    possession,
    updated_at
  )
  values(
    p_competition_id,
    p_season_id,
    p_matchday_number,
    p_real_team_id,
    p_result,
    p_npxg,
    p_possession,
    now()
  )
  on conflict (competition_id, season_id, matchday_number, real_team_id)
  do update set result = excluded.result,
                npxg = excluded.npxg,
                possession = excluded.possession,
                updated_at = now()
  returning id into v_id;

  return v_id;
end;
$function$;

revoke execute on function public.compute_coach_points(text, numeric, numeric, numeric) from public, anon;
revoke execute on function public.set_coach_mode(uuid, boolean) from public, anon;
revoke execute on function public.get_lineup_form_data(uuid) from public, anon;
revoke execute on function public.submit_lineup(uuid, uuid, jsonb, uuid) from public, anon;
revoke execute on function public.superadmin_upsert_coach(uuid, uuid, text, boolean) from public, anon;
revoke execute on function public.superadmin_upsert_coach_stats(uuid, uuid, integer, uuid, text, numeric, numeric) from public, anon;

grant execute on function public.compute_coach_points(text, numeric, numeric, numeric) to authenticated;
grant execute on function public.set_coach_mode(uuid, boolean) to authenticated;
grant execute on function public.get_lineup_form_data(uuid) to authenticated;
grant execute on function public.submit_lineup(uuid, uuid, jsonb, uuid) to authenticated;
grant execute on function public.superadmin_upsert_coach(uuid, uuid, text, boolean) to authenticated;
grant execute on function public.superadmin_upsert_coach_stats(uuid, uuid, integer, uuid, text, numeric, numeric) to authenticated;
