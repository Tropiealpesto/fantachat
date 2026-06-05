-- Baseline RLS policies. Review before running in production.

create or replace function public.is_league_member(p_league_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from league_members lm where lm.league_id=p_league_id and lm.user_id=auth.uid());
$$;

create or replace function public.is_league_admin(p_league_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from league_members lm where lm.league_id=p_league_id and lm.user_id=auth.uid() and lm.role in ('admin','super_admin'));
$$;

create or replace function public.is_app_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from app_admins a where lower(a.email)=lower((select email from auth.users where id=auth.uid())));
$$;

alter table leagues enable row level security;
alter table league_members enable row level security;
alter table league_competitions enable row level security;
alter table matchdays enable row level security;
alter table lineups enable row level security;
alter table lineup_players enable row level security;
alter table scores enable row level security;
alter table matchday_team_scores enable row level security;
alter table competition_standings enable row level security;
alter table messages enable row level security;
alter table nyx_content enable row level security;

drop policy if exists leagues_member_read on leagues;
create policy leagues_member_read on leagues for select using (is_league_member(id));

drop policy if exists league_members_self_read on league_members;
create policy league_members_self_read on league_members for select using (is_league_member(league_id));

drop policy if exists league_competitions_member_read on league_competitions;
create policy league_competitions_member_read on league_competitions for select using (is_league_member(league_id));

drop policy if exists matchdays_member_read on matchdays;
create policy matchdays_member_read on matchdays for select using (exists(select 1 from league_competitions lc where lc.id=matchdays.league_competition_id and is_league_member(lc.league_id)));

drop policy if exists lineups_owner_or_admin on lineups;
create policy lineups_owner_or_admin on lineups for select using (user_id=auth.uid() or is_league_member(league_id));
drop policy if exists lineups_owner_write on lineups;
create policy lineups_owner_write on lineups for insert with check (user_id=auth.uid() and is_league_member(league_id));

drop policy if exists messages_member_read on messages;
create policy messages_member_read on messages for select using (is_league_member(league_id));
drop policy if exists messages_member_insert on messages;
create policy messages_member_insert on messages for insert with check (is_league_member(league_id) and (user_id is null or user_id=auth.uid()));

drop policy if exists nyx_member_read on nyx_content;
create policy nyx_member_read on nyx_content for select using (is_league_member(league_id));

-- Global tables: app admins can modify. Authenticated users can read active data.
alter table competitions enable row level security;
alter table seasons enable row level security;
alter table real_teams enable row level security;
alter table real_players enable row level security;
alter table fixtures enable row level security;
alter table top_n enable row level security;
alter table player_votes enable row level security;

drop policy if exists competitions_read on competitions; create policy competitions_read on competitions for select using (active=true or is_app_admin());
drop policy if exists seasons_read on seasons; create policy seasons_read on seasons for select using (active=true or is_app_admin());
drop policy if exists real_teams_read on real_teams; create policy real_teams_read on real_teams for select using (active=true or is_app_admin());
drop policy if exists real_players_read on real_players; create policy real_players_read on real_players for select using (active=true or is_app_admin());
drop policy if exists fixtures_read on fixtures; create policy fixtures_read on fixtures for select using (true);
drop policy if exists top_n_read on top_n; create policy top_n_read on top_n for select using (true);
drop policy if exists player_votes_admin_all on player_votes; create policy player_votes_admin_all on player_votes for all using (is_app_admin()) with check (is_app_admin());
