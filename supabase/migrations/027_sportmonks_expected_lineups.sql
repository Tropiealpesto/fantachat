-- FantaChat - Sportmonks expected lineups
--
-- Stores Sportmonks predicted lineups in Supabase. The app can later use this
-- table to show probable starters/candidates while users pick their team.

create table if not exists public.fixture_expected_lineups (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  fixture_id uuid references public.fixtures(id) on delete cascade,
  matchday_number integer not null,
  sportmonks_fixture_id bigint not null,
  real_team_id uuid references public.real_teams(id) on delete cascade,
  sportmonks_team_id bigint not null,
  real_player_id uuid references public.real_players(id) on delete set null,
  sportmonks_player_id bigint,
  player_name text not null,
  jersey_number integer,
  role text,
  sportmonks_position_id bigint,
  sportmonks_detailed_position_id bigint,
  formation_field text,
  formation_position integer,
  type_id bigint,
  lineup_status text not null default 'unknown',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (competition_id, season_id, sportmonks_fixture_id, sportmonks_team_id, sportmonks_player_id, type_id)
);

alter table public.fixture_expected_lineups enable row level security;

drop policy if exists fixture_expected_lineups_read on public.fixture_expected_lineups;
create policy fixture_expected_lineups_read
on public.fixture_expected_lineups
for select
using (true);

create index if not exists fixture_expected_lineups_fixture_idx
on public.fixture_expected_lineups(competition_id, season_id, sportmonks_fixture_id);

create index if not exists fixture_expected_lineups_player_idx
on public.fixture_expected_lineups(competition_id, real_player_id)
where real_player_id is not null;

create index if not exists fixture_expected_lineups_team_status_idx
on public.fixture_expected_lineups(competition_id, season_id, matchday_number, real_team_id, lineup_status);

grant all privileges on public.fixture_expected_lineups to service_role;
grant select on public.fixture_expected_lineups to authenticated;
