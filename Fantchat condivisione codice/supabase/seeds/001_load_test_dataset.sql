-- FantaChat point 3 - realistic visible dataset
--
-- Creates a reversible load-test league for Mondiale 2026.
-- It includes pietrparod@gmail.com and all currently known Auth users.
--
-- Important: this league will be visible to the listed users because it
-- inserts rows in league_members. Use the cleanup seed to remove it.

do $$
begin
  if not exists (
    select 1
    from auth.users
    where id = 'f9767f72-0c89-497d-90f0-6e1022bf4a91'
      and lower(email) = lower('pietrparod@gmail.com')
  ) then
    raise exception 'Owner user pietrparod@gmail.com not found';
  end if;

  if not exists (
    select 1
    from public.competitions
    where id = '5062ba73-2587-4a5b-b29a-e0accd410bb0'
  ) then
    raise exception 'Mondiale 2026 competition not found';
  end if;

  if not exists (
    select 1
    from public.seasons
    where id = '1c8b9d56-17b5-45f0-8349-2140137cee0c'
      and competition_id = '5062ba73-2587-4a5b-b29a-e0accd410bb0'
  ) then
    raise exception 'Mondiale 2026 season not found';
  end if;
end $$;

with load_league as (
  insert into public.leagues(name, season_id, invite_code)
  values (
    'LOAD TEST - Mondiale 2026',
    '1c8b9d56-17b5-45f0-8349-2140137cee0c',
    'LOAD26P3'
  )
  on conflict (invite_code)
  do update set
    name = excluded.name,
    season_id = excluded.season_id
  returning id
),
league_row as (
  select id from load_league
  union all
  select id
  from public.leagues
  where invite_code = 'LOAD26P3'
  limit 1
),
load_users(idx, user_id, email, team_name, role, color_primary, color_secondary) as (
  values
    (1, 'f9767f72-0c89-497d-90f0-6e1022bf4a91'::uuid, 'pietrparod@gmail.com', 'La mia squadra Load', 'admin', '#0f7a3a', '#f07a13'),
    (2, '33d7a131-dc78-4eca-ad48-6db6240484f5'::uuid, 'alessandrodeluca5600@gmail.com', 'Load Team 02', 'player', '#155e75', '#f97316'),
    (3, '08938b1b-3f13-403c-93a6-5935559f40f7'::uuid, 'r00.gulminelli@gmail.com', 'Load Team 03', 'player', '#7c3aed', '#22c55e'),
    (4, '24e15efb-219f-4f7f-8c7c-af24fa7fc616'::uuid, 'franciuss2000@gmail.com', 'Load Team 04', 'player', '#be123c', '#0ea5e9'),
    (5, 'ec6f0352-0ebe-49a7-81c3-97b0e050e889'::uuid, 'andreadurante03@gmail.com', 'Load Team 05', 'player', '#166534', '#eab308'),
    (6, '16eecdcf-6447-4aae-91ae-58bdd7853bc5'::uuid, 'gastiedoardo1@gmail.com', 'Load Team 06', 'player', '#1d4ed8', '#ea580c'),
    (7, '290b73a1-abc4-4816-b307-7fd15f88d1f8'::uuid, 'rinaldo.loconte9@gmail.com', 'Load Team 07', 'player', '#0f766e', '#db2777'),
    (8, 'd85155f0-c292-46c4-99c0-090a54077872'::uuid, 'ricky.vinciguerra@gmail.com', 'Load Team 08', 'player', '#854d0e', '#16a34a'),
    (9, '1f3fc453-ddf0-446f-af53-6dd24e66eb90'::uuid, 'marco.scielzi@gmail.com', 'Load Team 09', 'player', '#4338ca', '#f59e0b'),
    (10, 'a7fc60e3-e6a5-45a1-aac2-6b21695cd6df'::uuid, 'andrealaiolo72@gmail.com', 'Load Team 10', 'player', '#047857', '#ef4444'),
    (11, '5d3c0670-e5da-4c55-90c2-6f714df55cd3'::uuid, 'dantelu13@icloud.com', 'Load Team 11', 'player', '#0369a1', '#84cc16'),
    (12, 'c7800b0e-1b3c-4757-b5cb-60062234fa19'::uuid, 'pietrocecconi00@gmail.com', 'Load Team 12', 'player', '#6d28d9', '#f97316'),
    (13, '13ca2939-2ef2-4f8c-9314-83f08033148a'::uuid, 'scarponiantonio92@gmail.com', 'Load Team 13', 'player', '#b91c1c', '#22c55e'),
    (14, '8bf4db48-ad54-4f72-bce8-d1f9a13e3c3b'::uuid, 'ciuci28@libero.it', 'Load Team 14', 'player', '#15803d', '#0ea5e9'),
    (15, '659cce78-759c-4e56-9ea8-34ab06581fbc'::uuid, 'seby0029@gmail.com', 'Load Team 15', 'player', '#0e7490', '#eab308'),
    (16, '89d9d09b-5daa-4ef0-ba8e-6c1920cdcee4'::uuid, 'ruggierodomy@gmail.com', 'Load Team 16', 'player', '#7c2d12', '#10b981'),
    (17, '47d590b2-bd22-4196-9952-e42db6c852ac'::uuid, 'francescodean1@gmail.com', 'Load Team 17', 'player', '#1e40af', '#f97316'),
    (18, 'fa30de13-c4df-45c4-9bbd-505e572bc468'::uuid, 'vinci0010@gmail.com', 'Load Team 18', 'player', '#166534', '#a855f7'),
    (19, 'f52d0bbe-ff9c-458e-a910-b33c943fe50e'::uuid, 'nandovich5@gmail.com', 'Load Team 19', 'player', '#be185d', '#22c55e'),
    (20, 'd68a0336-4d52-42fe-9cd8-86c713bccdad'::uuid, 'pietroparodi11@gmail.com', 'Load Team 20', 'player', '#334155', '#f97316')
)
insert into public.league_members(
  league_id,
  user_id,
  team_name,
  role,
  color_primary,
  color_secondary
)
select
  l.id,
  u.user_id,
  u.team_name,
  u.role,
  u.color_primary,
  u.color_secondary
from league_row l
join load_users u on true
where exists (
  select 1
  from auth.users au
  where au.id = u.user_id
)
on conflict (league_id, user_id)
do update set
  team_name = excluded.team_name,
  role = excluded.role,
  color_primary = excluded.color_primary,
  color_secondary = excluded.color_secondary;

with league_row as (
  select id
  from public.leagues
  where invite_code = 'LOAD26P3'
  limit 1
),
lc as (
  insert into public.league_competitions(
    league_id,
    competition_id,
    season_id,
    name,
    status,
    players_per_role,
    scoring_ruleset
  )
  select
    l.id,
    '5062ba73-2587-4a5b-b29a-e0accd410bb0',
    '1c8b9d56-17b5-45f0-8349-2140137cee0c',
    'LOAD TEST - Mondiale 2026',
    'active',
    '{"P":1,"D":1,"C":1,"A":1}'::jsonb,
    'classico'
  from league_row l
  on conflict (league_id, competition_id, season_id)
  do update set
    name = excluded.name,
    status = excluded.status,
    players_per_role = excluded.players_per_role,
    scoring_ruleset = excluded.scoring_ruleset
  returning id, league_id
)
insert into public.league_competition_members(
  league_competition_id,
  user_id,
  team_name
)
select
  lc.id,
  lm.user_id,
  lm.team_name
from lc
join public.league_members lm on lm.league_id = lc.league_id
on conflict (league_competition_id, user_id)
do update set team_name = excluded.team_name;

with md as (
  select id
  from public.matchdays
  where season_id = '1c8b9d56-17b5-45f0-8349-2140137cee0c'
    and status = 'open'
  order by number desc
  limit 1
),
missing_md as (
  insert into public.matchdays(season_id, number, status)
  select '1c8b9d56-17b5-45f0-8349-2140137cee0c', 1, 'open'
  where not exists (select 1 from md)
  returning id
)
select 1;

with league_row as (
  select id
  from public.leagues
  where invite_code = 'LOAD26P3'
  limit 1
),
lc as (
  select id, league_id, competition_id, season_id
  from public.league_competitions
  where league_id = (select id from league_row)
    and competition_id = '5062ba73-2587-4a5b-b29a-e0accd410bb0'
    and season_id = '1c8b9d56-17b5-45f0-8349-2140137cee0c'
  limit 1
),
md as (
  select id, number
  from public.matchdays
  where season_id = '1c8b9d56-17b5-45f0-8349-2140137cee0c'
    and status = 'open'
  order by number desc
  limit 1
),
members as (
  select
    row_number() over(order by lcm.team_name) as idx,
    lcm.user_id,
    lcm.team_name
  from public.league_competition_members lcm
  where lcm.league_competition_id = (select id from lc)
),
upserted_lineups as (
  insert into public.lineups(
    league_id,
    league_competition_id,
    matchday_id,
    user_id,
    submitted_at
  )
  select
    (select league_id from lc),
    (select id from lc),
    (select id from md),
    m.user_id,
    now() - (m.idx || ' minutes')::interval
  from members m
  on conflict (league_id, matchday_id, user_id)
  do update set
    league_competition_id = excluded.league_competition_id,
    submitted_at = excluded.submitted_at
  returning id
),
lineups_for_seed as (
  select
    li.id as lineup_id,
    m.idx,
    m.user_id
  from public.lineups li
  join members m on m.user_id = li.user_id
  where li.league_competition_id = (select id from lc)
    and li.matchday_id = (select id from md)
),
deleted_lp as (
  delete from public.lineup_players lp
  using lineups_for_seed lfs
  where lp.lineup_id = lfs.lineup_id
),
deleted_scores as (
  delete from public.scores s
  using lineups_for_seed lfs
  where s.lineup_id = lfs.lineup_id
),
players_ranked as (
  select
    rp.id,
    rp.role,
    row_number() over(partition by rp.role order by rp.name, rp.id) as rn,
    count(*) over(partition by rp.role) as cnt
  from public.real_players rp
  where rp.competition_id = '5062ba73-2587-4a5b-b29a-e0accd410bb0'
    and coalesce(rp.active, true) = true
    and rp.role in ('P', 'D', 'C', 'A')
),
role_offsets(role, offset_value) as (
  values
    ('P', 0),
    ('D', 5),
    ('C', 11),
    ('A', 17)
),
selected_players as (
  select
    lfs.lineup_id,
    pr.id as real_player_id,
    pr.role,
    lfs.idx
  from lineups_for_seed lfs
  join role_offsets ro on true
  join players_ranked pr
    on pr.role = ro.role
   and pr.rn = (((lfs.idx + ro.offset_value - 1) % pr.cnt) + 1)
),
inserted_lp as (
  insert into public.lineup_players(lineup_id, real_player_id, role)
  select lineup_id, real_player_id, role
  from selected_players
  returning lineup_id, real_player_id, role
)
insert into public.scores(lineup_id, real_player_id, role, points)
select
  sp.lineup_id,
  sp.real_player_id,
  sp.role,
  case sp.role
    when 'P' then 4 + ((sp.idx % 5) - 2) * 0.5
    when 'D' then 3 + ((sp.idx % 7) - 3) * 0.5
    when 'C' then 5 + ((sp.idx % 6) - 2) * 0.5
    when 'A' then 6 + ((sp.idx % 8) - 3) * 0.5
    else 0
  end
from selected_players sp;

with league_row as (
  select id
  from public.leagues
  where invite_code = 'LOAD26P3'
  limit 1
),
lc as (
  select id
  from public.league_competitions
  where league_id = (select id from league_row)
    and competition_id = '5062ba73-2587-4a5b-b29a-e0accd410bb0'
    and season_id = '1c8b9d56-17b5-45f0-8349-2140137cee0c'
  limit 1
),
totals as (
  select
    li.user_id,
    lcm.team_name,
    coalesce(sum(s.points), 0) as total_points
  from public.league_competition_members lcm
  join public.lineups li
    on li.league_competition_id = lcm.league_competition_id
   and li.user_id = lcm.user_id
  left join public.scores s on s.lineup_id = li.id
  where lcm.league_competition_id = (select id from lc)
  group by li.user_id, lcm.team_name
),
ranked as (
  select
    user_id,
    team_name,
    total_points,
    row_number() over(order by total_points desc, team_name) as rank
  from totals
)
insert into public.competition_standings(
  league_competition_id,
  user_id,
  team_name,
  total_points,
  rank,
  updated_at
)
select
  (select id from lc),
  user_id,
  team_name,
  total_points,
  rank,
  now()
from ranked
on conflict (league_competition_id, user_id)
do update set
  team_name = excluded.team_name,
  total_points = excluded.total_points,
  rank = excluded.rank,
  updated_at = now();

with league_row as (
  select id
  from public.leagues
  where invite_code = 'LOAD26P3'
  limit 1
),
lc as (
  select id
  from public.league_competitions
  where league_id = (select id from league_row)
    and competition_id = '5062ba73-2587-4a5b-b29a-e0accd410bb0'
    and season_id = '1c8b9d56-17b5-45f0-8349-2140137cee0c'
  limit 1
),
md as (
  select id
  from public.matchdays
  where season_id = '1c8b9d56-17b5-45f0-8349-2140137cee0c'
    and status = 'open'
  order by number desc
  limit 1
),
members as (
  select
    row_number() over(order by lcm.team_name) as idx,
    lcm.user_id,
    lcm.team_name
  from public.league_competition_members lcm
  where lcm.league_competition_id = (select id from lc)
),
deleted_messages as (
  delete from public.messages
  where league_id = (select id from league_row)
    and content like '[LOAD TEST]%'
)
insert into public.messages(
  league_id,
  league_competition_id,
  matchday_id,
  user_id,
  content,
  kind,
  created_at
)
select
  (select id from league_row),
  (select id from lc),
  (select id from md),
  m.user_id,
  '[LOAD TEST] Messaggio ' || gs.n || ' da ' || m.team_name,
  'text',
  now() - ((200 - gs.n) || ' minutes')::interval
from generate_series(1, 200) gs(n)
join members m on m.idx = (((gs.n - 1) % (select count(*) from members)) + 1);

with league_row as (
  select id
  from public.leagues
  where invite_code = 'LOAD26P3'
  limit 1
),
lc as (
  select id
  from public.league_competitions
  where league_id = (select id from league_row)
    and competition_id = '5062ba73-2587-4a5b-b29a-e0accd410bb0'
    and season_id = '1c8b9d56-17b5-45f0-8349-2140137cee0c'
  limit 1
)
insert into public.user_context(
  user_id,
  active_league_id,
  active_league_competition_id,
  updated_at
)
values(
  'f9767f72-0c89-497d-90f0-6e1022bf4a91',
  (select id from league_row),
  (select id from lc),
  now()
)
on conflict (user_id)
do update set
  active_league_id = excluded.active_league_id,
  active_league_competition_id = excluded.active_league_competition_id,
  updated_at = now();

select
  l.id as league_id,
  lc.id as league_competition_id,
  count(distinct lcm.user_id) as teams,
  count(distinct li.id) as lineups,
  count(distinct m.id) as messages
from public.leagues l
join public.league_competitions lc on lc.league_id = l.id
left join public.league_competition_members lcm on lcm.league_competition_id = lc.id
left join public.lineups li on li.league_competition_id = lc.id
left join public.messages m on m.league_competition_id = lc.id
where l.invite_code = 'LOAD26P3'
group by l.id, lc.id;

