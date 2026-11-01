-- FantaChat point 3 - cleanup load-test dataset
--
-- Removes the test league created by 001_load_test_dataset.sql.
-- The target is identified by invite_code = LOAD26P3.

with target_league as (
  select id
  from public.leagues
  where invite_code = 'LOAD26P3'
),
target_lc as (
  select id
  from public.league_competitions
  where league_id in (select id from target_league)
),
target_lineups as (
  select id
  from public.lineups
  where league_competition_id in (select id from target_lc)
),
deleted_scores as (
  delete from public.scores
  where lineup_id in (select id from target_lineups)
),
deleted_lineup_players as (
  delete from public.lineup_players
  where lineup_id in (select id from target_lineups)
),
deleted_messages as (
  delete from public.messages
  where league_id in (select id from target_league)
     or league_competition_id in (select id from target_lc)
),
deleted_standings as (
  delete from public.competition_standings
  where league_competition_id in (select id from target_lc)
),
deleted_lineups as (
  delete from public.lineups
  where id in (select id from target_lineups)
),
deleted_lc_members as (
  delete from public.league_competition_members
  where league_competition_id in (select id from target_lc)
),
reset_context as (
  update public.user_context
  set active_league_id = null,
      active_league_competition_id = null,
      updated_at = now()
  where active_league_id in (select id from target_league)
     or active_league_competition_id in (select id from target_lc)
),
deleted_lc as (
  delete from public.league_competitions
  where id in (select id from target_lc)
),
deleted_members as (
  delete from public.league_members
  where league_id in (select id from target_league)
)
delete from public.leagues
where id in (select id from target_league);

