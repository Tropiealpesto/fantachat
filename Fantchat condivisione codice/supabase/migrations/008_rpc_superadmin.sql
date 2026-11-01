create or replace function upsert_fixture(p_competition_id uuid, p_season_id uuid, p_matchday_number int, p_home_team_id uuid, p_away_team_id uuid, p_starts_at timestamptz default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not is_app_admin() then raise exception 'Solo superadmin'; end if;
  insert into fixtures(competition_id,season_id,matchday_number,home_team_id,away_team_id,starts_at,updated_at) values(p_competition_id,p_season_id,p_matchday_number,p_home_team_id,p_away_team_id,p_starts_at,now()) returning id into v_id;
  return v_id;
end $$;

create or replace function upsert_top_n(p_competition_id uuid, p_season_id uuid, p_matchday_number int, p_items jsonb)
returns int language plpgsql security definer set search_path=public as $$
declare v_item jsonb; v_count int:=0;
begin
  if not is_app_admin() then raise exception 'Solo superadmin'; end if;
  delete from top_n where competition_id=p_competition_id and season_id=p_season_id and matchday_number=p_matchday_number;
  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into top_n(competition_id,season_id,matchday_number,real_team_id,rank) values(p_competition_id,p_season_id,p_matchday_number,(v_item->>'real_team_id')::uuid,(v_item->>'rank')::int);
    v_count:=v_count+1;
  end loop;
  return v_count;
end $$;

create or replace function upsert_player_vote(p_competition_id uuid, p_season_id uuid, p_matchday_number int, p_real_player_id uuid, p_vote numeric, p_events jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_total numeric;
begin
  if not is_app_admin() then raise exception 'Solo superadmin'; end if;
  v_total := coalesce(p_vote,0) + coalesce((p_events->>'goals')::int,0)*3 + coalesce((p_events->>'assists')::int,0) - coalesce((p_events->>'yellow')::int,0)*0.5 - coalesce((p_events->>'red')::int,0) - coalesce((p_events->>'pen_missed')::int,0)*3;
  insert into player_votes(competition_id,season_id,matchday_number,real_player_id,vote,goals,assists,yellow,red,clean_sheet,goals_conceded,pen_missed,total_points_base,updated_at)
  values(p_competition_id,p_season_id,p_matchday_number,p_real_player_id,p_vote,coalesce((p_events->>'goals')::int,0),coalesce((p_events->>'assists')::int,0),coalesce((p_events->>'yellow')::int,0),coalesce((p_events->>'red')::int,0),coalesce((p_events->>'clean_sheet')::boolean,false),coalesce((p_events->>'goals_conceded')::int,0),coalesce((p_events->>'pen_missed')::int,0),v_total,now())
  on conflict(competition_id,season_id,matchday_number,real_player_id) do update set vote=excluded.vote, goals=excluded.goals, assists=excluded.assists, yellow=excluded.yellow, red=excluded.red, clean_sheet=excluded.clean_sheet, goals_conceded=excluded.goals_conceded, pen_missed=excluded.pen_missed, total_points_base=excluded.total_points_base, updated_at=now()
  returning id into v_id;
  return v_id;
end $$;

create or replace function recalculate_all_leagues_for_competition_matchday(p_competition_id uuid, p_season_id uuid, p_matchday_number int)
returns int language plpgsql security definer set search_path=public as $$
declare v_lc record; v_md uuid; v_count int:=0;
begin
  if not is_app_admin() then raise exception 'Solo superadmin'; end if;
  for v_lc in select * from league_competitions where competition_id=p_competition_id and season_id=p_season_id and status='active' loop
    select id into v_md from matchdays where league_competition_id=v_lc.id and number=p_matchday_number;
    if v_md is not null then perform recalculate_competition_scores(v_lc.id, v_md); v_count:=v_count+1; end if;
  end loop;
  return v_count;
end $$;
