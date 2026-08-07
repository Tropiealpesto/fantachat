-- FantaChat - Sportmonks mapping
--
-- Adds stable external identifiers used by server-side import scripts.
-- This migration is additive and does not change existing app logic.

alter table public.competitions
  add column if not exists sportmonks_league_id bigint;

alter table public.seasons
  add column if not exists sportmonks_id bigint;

alter table public.real_teams
  add column if not exists sportmonks_id bigint,
  add column if not exists short_code text;

alter table public.real_players
  add column if not exists sportmonks_id bigint,
  add column if not exists sportmonks_team_id bigint,
  add column if not exists sportmonks_position_id bigint,
  add column if not exists sportmonks_detailed_position_id bigint,
  add column if not exists image_url text,
  add column if not exists source text not null default 'manual';

alter table public.real_coaches
  add column if not exists sportmonks_id bigint,
  add column if not exists sportmonks_team_id bigint,
  add column if not exists image_url text;

alter table public.fixtures
  add column if not exists sportmonks_id bigint,
  add column if not exists sportmonks_state_id bigint,
  add column if not exists home_score integer,
  add column if not exists away_score integer,
  add column if not exists result_info text,
  add column if not exists name text;

alter table public.player_stats
  add column if not exists sportmonks_fixture_id bigint;

alter table public.coach_stats
  add column if not exists sportmonks_fixture_id bigint;

create unique index if not exists competitions_sportmonks_league_uidx
on public.competitions(sportmonks_league_id)
where sportmonks_league_id is not null;

create unique index if not exists seasons_competition_sportmonks_uidx
on public.seasons(competition_id, sportmonks_id)
where sportmonks_id is not null;

create unique index if not exists seasons_competition_name_uidx
on public.seasons(competition_id, name);

create unique index if not exists real_teams_competition_sportmonks_uidx
on public.real_teams(competition_id, sportmonks_id)
where sportmonks_id is not null;

create index if not exists real_players_competition_sportmonks_idx
on public.real_players(competition_id, sportmonks_id)
where sportmonks_id is not null;

create index if not exists real_players_competition_team_role_idx
on public.real_players(competition_id, real_team_id, role);

create unique index if not exists real_coaches_competition_sportmonks_uidx
on public.real_coaches(competition_id, sportmonks_id)
where sportmonks_id is not null;

create unique index if not exists fixtures_competition_season_sportmonks_uidx
on public.fixtures(competition_id, season_id, sportmonks_id)
where sportmonks_id is not null;

create index if not exists player_stats_sportmonks_fixture_idx
on public.player_stats(sportmonks_fixture_id)
where sportmonks_fixture_id is not null;

create index if not exists coach_stats_sportmonks_fixture_idx
on public.coach_stats(sportmonks_fixture_id)
where sportmonks_fixture_id is not null;
