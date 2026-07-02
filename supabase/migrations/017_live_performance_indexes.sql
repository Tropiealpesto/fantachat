-- FantaChat launch readiness - point 2
-- Performance indexes aligned to the current live Supabase schema.
--
-- These indexes target the hottest app paths:
-- Home, Rosa, Live, Classifica, Chat and Superadmin.

create index if not exists competition_config_competition_idx
on public.competition_config(competition_id);

create index if not exists competition_standings_lc_rank_idx
on public.competition_standings(league_competition_id, rank);

create index if not exists competition_standings_lc_points_idx
on public.competition_standings(league_competition_id, total_points desc, team_name);

create index if not exists fixtures_lookup_idx
on public.fixtures(competition_id, season_id, matchday_number);

create index if not exists league_competitions_comp_season_status_idx
on public.league_competitions(competition_id, season_id, status);

create index if not exists league_competitions_league_status_idx
on public.league_competitions(league_id, status);

create index if not exists lineup_players_lineup_idx
on public.lineup_players(lineup_id);

create index if not exists lineup_players_player_idx
on public.lineup_players(real_player_id);

create index if not exists lineups_lc_matchday_user_idx
on public.lineups(league_competition_id, matchday_id, user_id);

create index if not exists lineups_lc_user_idx
on public.lineups(league_competition_id, user_id);

create index if not exists matchdays_season_status_number_idx
on public.matchdays(season_id, status, number desc);

create index if not exists matchdays_season_number_idx
on public.matchdays(season_id, number);

create index if not exists messages_league_created_desc_idx
on public.messages(league_id, created_at desc);

create index if not exists messages_lc_created_desc_idx
on public.messages(league_competition_id, created_at desc);

create index if not exists player_stats_lookup_idx
on public.player_stats(competition_id, season_id, matchday_number, real_player_id);

create index if not exists real_players_comp_active_role_name_idx
on public.real_players(competition_id, active, role, name);

create index if not exists real_players_comp_active_team_idx
on public.real_players(competition_id, active, team);

create index if not exists real_players_real_team_idx
on public.real_players(real_team_id);

create index if not exists scores_real_player_idx
on public.scores(real_player_id);

create index if not exists top_teams_lookup_idx
on public.top_teams(competition_id, season_id, matchday_number);

create index if not exists top_teams_lookup_rank_idx
on public.top_teams(competition_id, season_id, matchday_number, rank);

