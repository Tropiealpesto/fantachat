create or replace function recalculate_competition_scores(p_league_competition_id uuid, p_matchday_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_lc record; v_md record;
begin
  select * into v_lc from league_competitions where id=p_league_competition_id;
  select * into v_md from matchdays where id=p_matchday_id;
  if v_lc.id is null or v_md.id is null then raise exception 'Dati non validi'; end if;

  delete from scores where league_competition_id=p_league_competition_id and matchday_id=p_matchday_id;

  insert into scores(league_id, league_competition_id, matchday_id, lineup_id, lineup_player_id, real_player_id, user_id, role, points, calculated_at)
  select l.league_id, l.league_competition_id, l.matchday_id, l.id, lp.id, lp.real_player_id, l.user_id, lp.role, coalesce(pv.total_points_base, pv.vote, 0), now()
  from lineups l join lineup_players lp on lp.lineup_id=l.id
  left join player_votes pv on pv.competition_id=v_lc.competition_id and pv.season_id=v_lc.season_id and pv.matchday_number=v_md.number and pv.real_player_id=lp.real_player_id
  where l.league_competition_id=p_league_competition_id and l.matchday_id=p_matchday_id;

  delete from matchday_team_scores where league_competition_id=p_league_competition_id and matchday_id=p_matchday_id;
  insert into matchday_team_scores(league_id, league_competition_id, matchday_id, user_id, team_name, total_score, p_score, d_score, c_score, a_score, rank, calculated_at)
  select s.league_id, s.league_competition_id, s.matchday_id, s.user_id, lm.team_name,
    sum(s.points), sum(s.points) filter(where s.role='P'), sum(s.points) filter(where s.role='D'), sum(s.points) filter(where s.role='C'), sum(s.points) filter(where s.role='A'),
    rank() over(order by sum(s.points) desc), now()
  from scores s join league_members lm on lm.league_id=s.league_id and lm.user_id=s.user_id
  where s.league_competition_id=p_league_competition_id and s.matchday_id=p_matchday_id
  group by s.league_id,s.league_competition_id,s.matchday_id,s.user_id,lm.team_name;

  delete from competition_standings where league_competition_id=p_league_competition_id;
  insert into competition_standings(league_id, league_competition_id, user_id, team_name, total_points, p_total, d_total, c_total, a_total, rank, updated_at)
  select mts.league_id, mts.league_competition_id, mts.user_id, lm.team_name,
    sum(mts.total_score), sum(mts.p_score), sum(mts.d_score), sum(mts.c_score), sum(mts.a_score),
    rank() over(order by sum(mts.total_score) desc), now()
  from matchday_team_scores mts join league_members lm on lm.league_id=mts.league_id and lm.user_id=mts.user_id
  where mts.league_competition_id=p_league_competition_id
  group by mts.league_id,mts.league_competition_id,mts.user_id,lm.team_name;
end $$;

create or replace function get_home_data(p_league_id uuid, p_league_competition_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_md record; v_lineup record; v_players jsonb; v_stats record; v_hist jsonb; v_nyx record;
begin
  if not is_league_member(p_league_id) then raise exception 'Accesso negato'; end if;
  select * into v_md from matchdays where league_competition_id=p_league_competition_id and status='open' order by number desc limit 1;
  if v_md.id is not null then select * into v_lineup from lineups where league_competition_id=p_league_competition_id and matchday_id=v_md.id and user_id=auth.uid(); end if;
  select coalesce(jsonb_agg(jsonb_build_object('role',lp.role,'name',rp.name,'points',s.points) order by lp.role),'[]'::jsonb) into v_players from lineup_players lp join real_players rp on rp.id=lp.real_player_id left join scores s on s.lineup_player_id=lp.id where lp.lineup_id=v_lineup.id;
  select * into v_stats from competition_standings where league_competition_id=p_league_competition_id and user_id=auth.uid();
  select coalesce(jsonb_agg(jsonb_build_object('matchday_number',m.number,'score',mts.total_score) order by m.number),'[]'::jsonb) into v_hist from matchday_team_scores mts join matchdays m on m.id=mts.matchday_id where mts.league_competition_id=p_league_competition_id and mts.user_id=auth.uid();
  select n.*, m.number as matchday_number into v_nyx from nyx_content n left join matchdays m on m.id=n.matchday_id where n.league_id=p_league_id and n.league_competition_id=p_league_competition_id order by n.created_at desc limit 1;
  return jsonb_build_object('matchday',case when v_md.id is null then null else jsonb_build_object('id',v_md.id,'number',v_md.number,'status',v_md.status,'slot_start',v_md.slot_start,'slot_end',v_md.slot_end) end,'lineup',case when v_lineup.id is null then null else jsonb_build_object('total_points',(select coalesce(sum(points),0) from scores where lineup_id=v_lineup.id),'players',coalesce(v_players,'[]'::jsonb)) end,'stats',jsonb_build_object('rank',v_stats.rank,'total_points',v_stats.total_points,'avg_points',case when jsonb_array_length(coalesce(v_hist,'[]'::jsonb))>0 then v_stats.total_points/jsonb_array_length(v_hist) else 0 end,'history',coalesce(v_hist,'[]'::jsonb)),'nyx',case when v_nyx.id is null then null else jsonb_build_object('id',v_nyx.id,'title',v_nyx.title,'text',v_nyx.text,'audio_url',v_nyx.audio_url,'matchday_number',v_nyx.matchday_number) end);
end $$;

create or replace function get_live_data(p_league_competition_id uuid)
returns jsonb language sql security definer set search_path=public as $$
  with md as (select * from matchdays where league_competition_id=p_league_competition_id and status in ('open','completed','locked') order by case status when 'open' then 0 else 1 end, number desc limit 1)
  select jsonb_build_object('matchday',(select jsonb_build_object('id',id,'number',number,'status',status) from md),'rows',coalesce((select jsonb_agg(to_jsonb(mts) order by mts.rank) from matchday_team_scores mts join md on md.id=mts.matchday_id where mts.league_competition_id=p_league_competition_id),'[]'::jsonb));
$$;

create or replace function get_standings(p_league_competition_id uuid)
returns setof competition_standings language sql security definer set search_path=public as $$
  select * from competition_standings where league_competition_id=p_league_competition_id order by rank nulls last, total_points desc;
$$;

create or replace function get_user_history(p_league_competition_id uuid)
returns table(matchday_id uuid, matchday_number int, status text, total_score numeric, rank int) language sql security definer set search_path=public as $$
  select m.id, m.number, m.status, mts.total_score, mts.rank
  from matchday_team_scores mts join matchdays m on m.id=mts.matchday_id
  where mts.league_competition_id=p_league_competition_id and mts.user_id=auth.uid()
  order by m.number desc;
$$;

create or replace function get_matchday_detail(p_matchday_id uuid)
returns jsonb language sql security definer set search_path=public as $$
  select jsonb_build_object(
    'matchday_number', m.number,
    'rows', coalesce((select jsonb_agg(jsonb_build_object('user_id',mts.user_id,'team_name',mts.team_name,'total_score',mts.total_score,'rank',mts.rank,'players',coalesce((select jsonb_agg(jsonb_build_object('role',lp.role,'name',rp.name,'points',s.points) order by lp.role) from lineups l join lineup_players lp on lp.lineup_id=l.id join real_players rp on rp.id=lp.real_player_id left join scores s on s.lineup_player_id=lp.id where l.matchday_id=m.id and l.user_id=mts.user_id),'[]'::jsonb)) order by mts.rank) from matchday_team_scores mts where mts.matchday_id=m.id),'[]'::jsonb)
  )
  from matchdays m where m.id=p_matchday_id;
$$;

create or replace function get_player_stats(p_league_competition_id uuid)
returns table(player_id uuid, player_name text, team_name text, role text, played_count int, total_points numeric, avg_points numeric, best_points numeric, worst_points numeric) language sql security definer set search_path=public as $$
  select rp.id, rp.name, coalesce(rt.name, rp.team::text), rp.role,
    count(s.id)::int, coalesce(sum(s.points),0), coalesce(avg(s.points),0), coalesce(max(s.points),0), coalesce(min(s.points),0)
  from scores s join real_players rp on rp.id=s.real_player_id left join real_teams rt on rt.id=rp.real_team_id
  where s.league_competition_id=p_league_competition_id
  group by rp.id,rp.name,rt.name,rp.team,rp.role
  order by avg(s.points) desc nulls last;
$$;

create or replace function get_player_detail(p_real_player_id uuid, p_league_competition_id uuid)
returns jsonb language sql security definer set search_path=public as $$
  with base as (
    select rp.id, rp.name, rp.role, coalesce(rt.name,rp.team::text) as team_name from real_players rp left join real_teams rt on rt.id=rp.real_team_id where rp.id=p_real_player_id
  ), hist as (
    select m.number, sum(s.points) points from scores s join matchdays m on m.id=s.matchday_id where s.real_player_id=p_real_player_id and s.league_competition_id=p_league_competition_id group by m.number order by m.number
  )
  select jsonb_build_object('player_name',b.name,'role',b.role,'team_name',b.team_name,'avg_points',coalesce((select avg(points) from hist),0),'best_points',coalesce((select max(points) from hist),0),'worst_points',coalesce((select min(points) from hist),0),'history',coalesce((select jsonb_agg(jsonb_build_object('matchday_number',number,'points',points) order by number) from hist),'[]'::jsonb)) from base b;
$$;

create or replace function get_nyx_content(p_league_competition_id uuid, p_limit int default 20)
returns table(id uuid, title text, text text, audio_url text, matchday_number int) language sql security definer set search_path=public as $$
  select n.id, n.title, n.text, n.audio_url, m.number
  from nyx_content n left join matchdays m on m.id=n.matchday_id
  where n.league_competition_id=p_league_competition_id
  order by n.created_at desc limit p_limit;
$$;
