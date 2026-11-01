create or replace function get_app_context()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_user auth.users%rowtype;
  v_ctx record;
  v_member record;
  v_lc record;
  v_is_app_admin boolean;
begin
  select * into v_user from auth.users where id=auth.uid();
  if v_user.id is null then return null; end if;

  select * into v_ctx from user_context where user_id=v_user.id;
  if v_ctx.active_league_id is null then
    return jsonb_build_object('user_id',v_user.id,'user_email',v_user.email);
  end if;

  select lm.team_name,lm.role,l.name as league_name into v_member
  from league_members lm join leagues l on l.id=lm.league_id
  where lm.league_id=v_ctx.active_league_id and lm.user_id=v_user.id;

  select exists(select 1 from app_admins a where lower(a.email)=lower(v_user.email)) into v_is_app_admin;

  if v_ctx.active_league_competition_id is null then
    select id into v_ctx.active_league_competition_id
    from league_competitions where league_id=v_ctx.active_league_id and status='active'
    order by created_at limit 1;
    if v_ctx.active_league_competition_id is not null then
      update user_context set active_league_competition_id=v_ctx.active_league_competition_id, updated_at=now() where user_id=v_user.id;
    end if;
  end if;

  select lc.id as league_competition_id, lc.competition_id, lc.season_id, c.name as competition_name, c.type as competition_type, c.slug as competition_slug
  into v_lc
  from league_competitions lc join competitions c on c.id=lc.competition_id
  where lc.id=v_ctx.active_league_competition_id;

  return jsonb_build_object(
    'user_id',v_user.id,
    'user_email',v_user.email,
    'active_league_id',v_ctx.active_league_id,
    'active_league_competition_id',v_ctx.active_league_competition_id,
    'league_name',v_member.league_name,
    'team_name',v_member.team_name,
    'role',case when v_is_app_admin then 'super_admin' else coalesce(v_member.role,'player') end,
    'competition_id',v_lc.competition_id,
    'competition_name',v_lc.competition_name,
    'competition_type',v_lc.competition_type,
    'competition_slug',v_lc.competition_slug,
    'season_id',v_lc.season_id
  );
end $$;

create or replace function set_active_league(p_league_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_lc uuid;
begin
  if not exists(select 1 from league_members where league_id=p_league_id and user_id=auth.uid()) then raise exception 'Non sei membro di questa lega'; end if;
  select id into v_lc from league_competitions where league_id=p_league_id and status='active' order by created_at limit 1;
  insert into user_context(user_id,active_league_id,active_league_competition_id,updated_at)
  values(auth.uid(),p_league_id,v_lc,now())
  on conflict(user_id) do update set active_league_id=excluded.active_league_id, active_league_competition_id=excluded.active_league_competition_id, updated_at=now();
end $$;

create or replace function set_active_competition(p_league_competition_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_league uuid;
begin
  select league_id into v_league from league_competitions where id=p_league_competition_id and status='active';
  if v_league is null then raise exception 'Competizione non trovata'; end if;
  if not exists(select 1 from league_members where league_id=v_league and user_id=auth.uid()) then raise exception 'Non sei membro di questa lega'; end if;
  update user_context set active_league_id=v_league, active_league_competition_id=p_league_competition_id, updated_at=now() where user_id=auth.uid();
end $$;

create or replace function get_my_leagues()
returns table(league_id uuid, league_name text, team_name text, role text) language sql security definer set search_path=public as $$
  select l.id, l.name, lm.team_name, lm.role from league_members lm join leagues l on l.id=lm.league_id where lm.user_id=auth.uid() order by l.created_at desc;
$$;

create or replace function get_league_competitions(p_league_id uuid)
returns table(id uuid, name text, competition_type text, competition_slug text, season_name text, matchday_number integer, is_active boolean) language sql security definer set search_path=public as $$
  select lc.id, lc.name, c.type, c.slug, s.name,
    (select max(m.number) from matchdays m where m.league_competition_id=lc.id),
    uc.active_league_competition_id=lc.id
  from league_competitions lc
  join competitions c on c.id=lc.competition_id
  join seasons s on s.id=lc.season_id
  left join user_context uc on uc.user_id=auth.uid()
  where lc.league_id=p_league_id and lc.status='active' and is_league_member(p_league_id)
  order by lc.created_at;
$$;

create or replace function create_league_with_default_competition(p_league_name text, p_team_name text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_league uuid; v_invite text; v_comp uuid; v_season uuid; v_lc jsonb;
begin
  if auth.uid() is null then raise exception 'Login richiesto'; end if;
  v_invite := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into leagues(name, invite_code, created_by) values(p_league_name, v_invite, auth.uid()) returning id into v_league;
  insert into league_members(league_id,user_id,team_name,role) values(v_league,auth.uid(),p_team_name,'admin');
  select id into v_comp from competitions where slug='serie-a' and active=true limit 1;
  select id into v_season from seasons where competition_id=v_comp and active=true limit 1;
  if v_comp is not null and v_season is not null then
    v_lc := create_league_competition(v_league,v_comp,v_season,null);
  end if;
  insert into user_context(user_id,active_league_id,active_league_competition_id,updated_at) values(auth.uid(),v_league,(v_lc->>'league_competition_id')::uuid,now()) on conflict(user_id) do update set active_league_id=excluded.active_league_id, active_league_competition_id=excluded.active_league_competition_id, updated_at=now();
  return jsonb_build_object('league_id',v_league,'invite_code',v_invite,'league_competition_id',v_lc->>'league_competition_id');
end $$;

create or replace function join_league_with_code(p_invite_code text, p_team_name text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_league uuid; v_lc uuid;
begin
  select id into v_league from leagues where invite_code=upper(p_invite_code);
  if v_league is null then raise exception 'Codice invito non valido'; end if;
  insert into league_members(league_id,user_id,team_name,role) values(v_league,auth.uid(),p_team_name,'player') on conflict do nothing;
  select id into v_lc from league_competitions where league_id=v_league and status='active' order by created_at limit 1;
  insert into user_context(user_id,active_league_id,active_league_competition_id,updated_at) values(auth.uid(),v_league,v_lc,now()) on conflict(user_id) do update set active_league_id=excluded.active_league_id, active_league_competition_id=excluded.active_league_competition_id, updated_at=now();
  insert into competition_standings(league_id,league_competition_id,user_id,team_name,total_points,rank) select v_league,lc.id,auth.uid(),p_team_name,0,999 from league_competitions lc where lc.league_id=v_league on conflict(league_competition_id,user_id) do nothing;
  return v_league;
end $$;

create or replace function get_chat_messages(p_league_id uuid, p_limit int default 200)
returns table(id uuid, league_id uuid, league_competition_id uuid, user_id uuid, message_type text, content text, mentions_data jsonb, created_at timestamptz, competition_name text, competition_type text) language sql security definer set search_path=public as $$
  select m.id,m.league_id,m.league_competition_id,m.user_id,m.message_type,m.content,m.mentions_data,m.created_at,lc.name,c.type
  from messages m left join league_competitions lc on lc.id=m.league_competition_id left join competitions c on c.id=lc.competition_id
  where m.league_id=p_league_id and is_league_member(p_league_id)
  order by m.created_at desc limit p_limit;
$$;

create or replace function send_chat_message(p_league_id uuid, p_league_competition_id uuid, p_content text, p_message_type text default 'text', p_mentions_data jsonb default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not is_league_member(p_league_id) then raise exception 'Accesso negato'; end if;
  insert into messages(league_id,league_competition_id,user_id,message_type,content,mentions_data) values(p_league_id,p_league_competition_id,auth.uid(),p_message_type,p_content,p_mentions_data) returning id into v_id;
  return v_id;
end $$;
