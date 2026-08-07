-- FantaChat - Sportmonks import schema compatibility
--
-- Some production databases may have skipped older additive columns. Keep this
-- migration small and idempotent so the server-side importer has a stable target.

alter table public.real_teams
  add column if not exists logo_url text,
  add column if not exists country text,
  add column if not exists active boolean not null default true;

alter table public.real_players
  add column if not exists real_team_id uuid,
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
  add column if not exists name text,
  add column if not exists updated_at timestamp with time zone not null default now();

alter table public.player_stats
  add column if not exists sportmonks_fixture_id bigint,
  add column if not exists passes_completed integer not null default 0,
  add column if not exists pass_accuracy numeric,
  add column if not exists tackles integer not null default 0,
  add column if not exists interceptions integer not null default 0,
  add column if not exists npxg numeric,
  add column if not exists saves integer not null default 0,
  add column if not exists save_pct numeric,
  add column if not exists source text default 'manual',
  add column if not exists updated_at timestamp with time zone not null default now();

alter table public.coach_stats
  add column if not exists sportmonks_fixture_id bigint,
  add column if not exists updated_at timestamp with time zone not null default now();

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
