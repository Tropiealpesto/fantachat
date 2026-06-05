create or replace function create_league_competition(p_league_id uuid, p_competition_id uuid, p_season_id uuid, p_name text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_lc uuid; v_total int; v_i int; v_name text;
begin
  if not is_league_admin(p_league_id) then raise exception 'Solo admin lega'; end if;
  select coalesce(p_name, s.name) into v_name from seasons s where s.id=p_season_id;
  insert into league_competitions(league_id, competition_id, season_id, name)
  values(p_league_id,p_competition_id,p_season_id,coalesce(v_name,'Competizione'))
  on conflict(league_id,competition_id,season_id) do update set status='active', updated_at=now()
  returning id into v_lc;

  insert into competition_config(league_competition_id, roles, players_per_role, scoring_rules)
  values(v_lc,'[{"key":"P","label":"Portiere"},{"key":"D","label":"Difensore"},{"key":"C","label":"Centrocampista"},{"key":"A","label":"Attaccante"}]'::jsonb,'{"P":1,"D":1,"C":1,"A":1}'::jsonb,'{"goal":3,"assist":1,"yellow":-0.5,"red":-1,"clean_sheet_gk":1,"clean_sheet_def":1,"goals_conceded_gk":-1,"pen_missed":-3}'::jsonb)
  on conflict do nothing;

  select total_matchdays into v_total from seasons where id=p_season_id;
  for v_i in 1..coalesce(v_total,38) loop
    insert into matchdays(league_competition_id, number, status) values(v_lc, v_i, 'scheduled') on conflict do nothing;
  end loop;

  insert into competition_standings(league_id, league_competition_id, user_id, team_name, total_points, rank)
  select p_league_id, v_lc, lm.user_id, lm.team_name, 0, row_number() over(order by lm.team_name)
  from league_members lm where lm.league_id=p_league_id
  on conflict(league_competition_id,user_id) do nothing;

  update user_context set active_league_competition_id=v_lc, updated_at=now() where user_id=auth.uid();
  return jsonb_build_object('league_competition_id',v_lc);
end $$;

create or replace function open_competition_matchday(p_league_competition_id uuid, p_number int)
returns text language plpgsql security definer set search_path=public as $$
declare v_league uuid; v_id uuid;
begin
  select league_id into v_league from league_competitions where id=p_league_competition_id;
  if not is_league_admin(v_league) then raise exception 'Solo admin lega'; end if;
  update matchdays set status='scheduled', updated_at=now() where league_competition_id=p_league_competition_id and status='open';
  insert into matchdays(league_competition_id,number,status,updated_at) values(p_league_competition_id,p_number,'open',now()) on conflict do nothing;
  update matchdays set status='open', updated_at=now() where league_competition_id=p_league_competition_id and number=p_number returning id into v_id;
  insert into messages(league_id,league_competition_id,matchday_id,user_id,message_type,content) values(v_league,p_league_competition_id,v_id,null,'matchday','Aperta giornata '||p_number);
  return 'Giornata '||p_number||' aperta';
end $$;

create or replace function close_competition_matchday(p_league_competition_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare v_league uuid;
begin
  select league_id into v_league from league_competitions where id=p_league_competition_id;
  if not is_league_admin(v_league) then raise exception 'Solo admin lega'; end if;
  update matchdays set status='completed', updated_at=now() where league_competition_id=p_league_competition_id and status='open';
  return 'Giornata chiusa';
end $$;

create or replace function finalize_competition_matchday(p_league_competition_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare v_league uuid; v_md uuid;
begin
  select league_id into v_league from league_competitions where id=p_league_competition_id;
  if not is_league_admin(v_league) then raise exception 'Solo admin lega'; end if;
  select id into v_md from matchdays where league_competition_id=p_league_competition_id and status in ('open','completed') order by number desc limit 1;
  perform recalculate_competition_scores(p_league_competition_id, v_md);
  update matchdays set status='locked', updated_at=now() where id=v_md;
  return 'Giornata finalizzata';
end $$;

create or replace function update_competition_rules(p_league_competition_id uuid, p_scoring_rules jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare v_league uuid;
begin
  select league_id into v_league from league_competitions where id=p_league_competition_id;
  if not is_league_admin(v_league) then raise exception 'Solo admin lega'; end if;
  update competition_config set scoring_rules=p_scoring_rules, updated_at=now() where league_competition_id=p_league_competition_id;
end $$;

create or replace function create_nyx_content(p_league_id uuid, p_league_competition_id uuid, p_matchday_id uuid, p_title text, p_text text, p_audio_url text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not is_league_admin(p_league_id) then raise exception 'Solo admin lega'; end if;
  insert into nyx_content(league_id,league_competition_id,matchday_id,title,text,audio_url,created_by,updated_at) values(p_league_id,p_league_competition_id,p_matchday_id,p_title,p_text,p_audio_url,auth.uid(),now()) returning id into v_id;
  insert into messages(league_id,league_competition_id,matchday_id,user_id,message_type,content) values(p_league_id,p_league_competition_id,p_matchday_id,auth.uid(),'nyx',p_title);
  return v_id;
end $$;

-- Compatibility stubs for UI/TODO pages.
create or replace function get_admin_picked_players(p_league_competition_id uuid) returns jsonb language sql security definer set search_path=public as $$ select '[]'::jsonb $$;
create or replace function admin_upsert_manual_scores(p_league_competition_id uuid, p_items jsonb) returns void language sql security definer set search_path=public as $$ select null::void $$;
create or replace function generate_pick_schedule(p_league_competition_id uuid) returns int language sql security definer set search_path=public as $$ select 0 $$;
create or replace function get_pick_schedule_recap_text(p_league_competition_id uuid) returns text language sql security definer set search_path=public as $$ select ''::text $$;
create or replace function reset_user_lineup(p_league_competition_id uuid, p_user_id uuid, p_matchday_id uuid) returns void language sql security definer set search_path=public as $$ select null::void $$;
