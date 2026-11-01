-- 001_schema_league_competitions.sql
-- Additive migration: new league -> league_competitions -> competition/season model.

create extension if not exists pgcrypto;

alter table leagues add column if not exists created_by uuid references auth.users(id);
alter table leagues add column if not exists created_at timestamptz not null default now();
alter table leagues add column if not exists invite_code text;

update leagues
set invite_code = upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))
where invite_code is null;

create unique index if not exists leagues_invite_code_key on leagues(invite_code);

alter table league_members add column if not exists created_at timestamptz not null default now();
alter table league_members add column if not exists role text not null default 'player';
alter table league_members add constraint league_members_role_check check (role in ('player','admin','super_admin')) not valid;

do $$ begin
  alter table competitions add column type text not null default 'campionato';
exception when duplicate_column then null; end $$;
alter table competitions add column if not exists default_total_matchdays integer not null default 38;
alter table competitions add column if not exists theme_key text;
alter table competitions add column if not exists active boolean not null default true;
alter table competitions add column if not exists created_at timestamptz not null default now();

alter table seasons add column if not exists starts_at timestamptz;
alter table seasons add column if not exists ends_at timestamptz;
alter table seasons add column if not exists active boolean not null default true;
alter table seasons add column if not exists created_at timestamptz not null default now();

create table if not exists league_competitions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  competition_id uuid not null references competitions(id) on delete restrict,
  season_id uuid not null references seasons(id) on delete restrict,
  name text not null,
  status text not null default 'active' check (status in ('active','archived','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, competition_id, season_id)
);

alter table user_context add column if not exists active_league_competition_id uuid references league_competitions(id) on delete set null;
alter table user_context add column if not exists updated_at timestamptz not null default now();

alter table competition_config add column if not exists id uuid default gen_random_uuid();
alter table competition_config add column if not exists league_competition_id uuid references league_competitions(id) on delete cascade;
alter table competition_config add column if not exists scoring_rules jsonb not null default '{}'::jsonb;
alter table competition_config add column if not exists created_at timestamptz not null default now();
alter table competition_config add column if not exists updated_at timestamptz not null default now();

alter table matchdays add column if not exists league_competition_id uuid references league_competitions(id) on delete cascade;
alter table matchdays add column if not exists deadline_end_at timestamptz;
alter table matchdays add column if not exists created_at timestamptz not null default now();
alter table matchdays add column if not exists updated_at timestamptz not null default now();

alter table real_teams add column if not exists country text;
alter table real_teams add column if not exists logo_url text;
alter table real_teams add column if not exists active boolean not null default true;
alter table real_teams add column if not exists created_at timestamptz not null default now();

create table if not exists competition_real_teams (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  real_team_id uuid not null references real_teams(id) on delete cascade,
  active boolean not null default true,
  unique (competition_id, real_team_id)
);

alter table real_players add column if not exists real_team_id uuid references real_teams(id);
alter table real_players add column if not exists active boolean not null default true;
alter table real_players add column if not exists created_at timestamptz not null default now();

create table if not exists competition_players (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  real_player_id uuid not null references real_players(id) on delete cascade,
  active boolean not null default true,
  unique (competition_id, real_player_id)
);

alter table fixtures add column if not exists competition_id uuid references competitions(id) on delete cascade;
alter table fixtures add column if not exists season_id uuid references seasons(id) on delete cascade;
alter table fixtures add column if not exists matchday_number integer;
alter table fixtures add column if not exists home_team_id uuid references real_teams(id);
alter table fixtures add column if not exists away_team_id uuid references real_teams(id);
alter table fixtures add column if not exists starts_at timestamptz;
alter table fixtures add column if not exists status text not null default 'scheduled';
alter table fixtures add column if not exists created_at timestamptz not null default now();
alter table fixtures add column if not exists updated_at timestamptz not null default now();

alter table top_n add column if not exists competition_id uuid references competitions(id) on delete cascade;
alter table top_n add column if not exists season_id uuid references seasons(id) on delete cascade;
alter table top_n add column if not exists matchday_number integer;
alter table top_n add column if not exists real_team_id uuid references real_teams(id);
alter table top_n add column if not exists rank integer;
alter table top_n add column if not exists created_at timestamptz not null default now();
alter table top_n add column if not exists updated_at timestamptz not null default now();

create table if not exists player_votes (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  matchday_number integer not null,
  real_player_id uuid not null references real_players(id) on delete cascade,
  vote numeric,
  goals integer not null default 0,
  assists integer not null default 0,
  yellow integer not null default 0,
  red integer not null default 0,
  clean_sheet boolean not null default false,
  goals_conceded integer not null default 0,
  pen_missed integer not null default 0,
  total_points_base numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (competition_id, season_id, matchday_number, real_player_id)
);

alter table lineups add column if not exists league_competition_id uuid references league_competitions(id) on delete cascade;
alter table lineups add column if not exists submitted_status text not null default 'none';
alter table lineups add column if not exists created_at timestamptz not null default now();
alter table lineups add column if not exists updated_at timestamptz not null default now();

alter table lineup_players add column if not exists created_at timestamptz not null default now();

alter table scores add column if not exists league_id uuid references leagues(id) on delete cascade;
alter table scores add column if not exists league_competition_id uuid references league_competitions(id) on delete cascade;
alter table scores add column if not exists matchday_id uuid references matchdays(id) on delete cascade;
alter table scores add column if not exists lineup_id uuid references lineups(id) on delete cascade;
alter table scores add column if not exists real_player_id uuid references real_players(id) on delete cascade;
alter table scores add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table scores add column if not exists calculated_at timestamptz not null default now();

create table if not exists matchday_team_scores (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  league_competition_id uuid not null references league_competitions(id) on delete cascade,
  matchday_id uuid not null references matchdays(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_name text not null,
  total_score numeric not null default 0,
  p_score numeric not null default 0,
  d_score numeric not null default 0,
  c_score numeric not null default 0,
  a_score numeric not null default 0,
  rank integer,
  calculated_at timestamptz not null default now(),
  unique (league_competition_id, matchday_id, user_id)
);

create table if not exists competition_standings (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references leagues(id) on delete cascade,
  league_competition_id uuid not null references league_competitions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_name text not null,
  total_points numeric not null default 0,
  p_total numeric not null default 0,
  d_total numeric not null default 0,
  c_total numeric not null default 0,
  a_total numeric not null default 0,
  rank integer,
  updated_at timestamptz not null default now(),
  unique (league_competition_id, user_id)
);

alter table messages add column if not exists league_competition_id uuid references league_competitions(id) on delete set null;
alter table messages add column if not exists mentions_data jsonb;
alter table messages add column if not exists created_at timestamptz not null default now();

alter table nyx_content add column if not exists league_competition_id uuid references league_competitions(id) on delete cascade;
alter table nyx_content add column if not exists title text;
alter table nyx_content add column if not exists created_by uuid references auth.users(id);
alter table nyx_content add column if not exists updated_at timestamptz not null default now();
