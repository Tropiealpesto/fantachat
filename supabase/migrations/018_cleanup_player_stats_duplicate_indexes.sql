-- FantaChat launch readiness - point 2
-- Remove duplicate indexes/constraints on player_stats natural key.
--
-- Keep:
-- - player_stats_pkey on id
-- - player_stats_natural_uniq on (competition_id, season_id, matchday_number, real_player_id)
--
-- Drop duplicate structures on the same natural key to reduce write overhead
-- when importing or updating many player stats.

alter table public.player_stats
drop constraint if exists player_stats_competition_id_season_id_matchday_number_real__key;

drop index if exists public.player_stats_unique_key;

drop index if exists public.player_stats_lookup_idx;

