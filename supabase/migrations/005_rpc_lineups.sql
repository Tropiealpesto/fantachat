create or replace function get_lineup_form_data(p_league_competition_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_lc record; v_md record; v_lineup record; v_players jsonb; v_existing jsonb;
begin
  select * into v_lc from league_competitions where id=p_league_competition_id;
  if v_lc.id is null or not is_league_member(v_lc.league_id) then raise exception 'Accesso negato'; end if;
  select id, number, status into v_md from matchdays where league_competition_id=p_league_competition_id and status='open' order by number desc limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('id',rp.id,'name',rp.name,'role',rp.role,'team_name',coalesce(rt.name, rp.team::text)) order by rp.role,rp.name),'[]'::jsonb) into v_players
  from competition_players cp join real_players rp on rp.id=cp.real_player_id left join real_teams rt on rt.id=rp.real_team_id
  where cp.competition_id=v_lc.competition_id and cp.active=true and rp.active=true;
  if v_md.id is not null then
    select * into v_lineup from lineups where league_competition_id=p_league_competition_id and matchday_id=v_md.id and user_id=auth.uid();
    select coalesce(jsonb_agg(jsonb_build_object('id',rp.id,'name',rp.name,'role',lp.role,'team_name',coalesce(rt.name,rp.team::text))),'[]'::jsonb) into v_existing
    from lineup_players lp join real_players rp on rp.id=lp.real_player_id left join real_teams rt on rt.id=rp.real_team_id where lp.lineup_id=v_lineup.id;
  end if;
  return jsonb_build_object('matchday',case when v_md.id is null then null else jsonb_build_object('id',v_md.id,'number',v_md.number,'status',v_md.status) end,'players',v_players,'existing_lineup',case when v_lineup.id is null then null else jsonb_build_object('players',coalesce(v_existing,'[]'::jsonb)) end);
end $$;

create or replace function submit_lineup(p_league_id uuid, p_league_competition_id uuid, p_matchday_id uuid, p_players jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_lineup uuid; v_item jsonb; v_team text;
begin
  if not exists(select 1 from league_members where league_id=p_league_id and user_id=auth.uid()) then raise exception 'Accesso negato'; end if;
  if not exists(select 1 from league_competitions where id=p_league_competition_id and league_id=p_league_id and status='active') then raise exception 'Competizione non valida'; end if;
  if not exists(select 1 from matchdays where id=p_matchday_id and league_competition_id=p_league_competition_id and status='open') then raise exception 'Giornata non aperta'; end if;

  insert into lineups(league_id, league_competition_id, matchday_id, user_id, submitted_at, submitted_status, updated_at)
  values(p_league_id,p_league_competition_id,p_matchday_id,auth.uid(),now(),'within',now())
  on conflict(league_competition_id, matchday_id, user_id) do update set submitted_at=now(), submitted_status='within', updated_at=now()
  returning id into v_lineup;

  delete from lineup_players where lineup_id=v_lineup;
  for v_item in select * from jsonb_array_elements(p_players) loop
    insert into lineup_players(lineup_id, real_player_id, role) values(v_lineup, (v_item->>'real_player_id')::uuid, v_item->>'role');
  end loop;

  select team_name into v_team from league_members where league_id=p_league_id and user_id=auth.uid();
  insert into messages(league_id, league_competition_id, matchday_id, user_id, message_type, content)
  values(p_league_id,p_league_competition_id,p_matchday_id,auth.uid(),'lineup_notification',coalesce(v_team,'Squadra') || ' ha caricato la formazione');
  return v_lineup;
end $$;
