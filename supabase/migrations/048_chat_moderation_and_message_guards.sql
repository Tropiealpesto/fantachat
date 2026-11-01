-- FantaChat - minimum moderation layer for league chat
--
-- Messages remain plain text in the UI. Reports, blocks and hidden status are
-- enforced server-side so they cannot be bypassed by a modified client.

alter table public.messages
  add column if not exists kind text,
  add column if not exists message_type text,
  add column if not exists meta jsonb,
  add column if not exists mentions_data jsonb,
  add column if not exists matchday_id uuid,
  add column if not exists moderation_status text not null default 'visible';

update public.messages
set kind = coalesce(kind, message_type, 'text'),
    meta = coalesce(meta, mentions_data)
where kind is null or meta is null;

create table if not exists public.chat_user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default 'Altro',
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  unique (message_id, reporter_id)
);

create index if not exists chat_reports_status_created_idx
  on public.chat_reports(status, created_at desc);

create index if not exists chat_user_blocks_blocker_idx
  on public.chat_user_blocks(blocker_id);

alter table public.chat_user_blocks enable row level security;
alter table public.chat_reports enable row level security;

drop policy if exists chat_user_blocks_owner on public.chat_user_blocks;
create policy chat_user_blocks_owner
  on public.chat_user_blocks for all
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid());

drop policy if exists chat_reports_reporter_insert on public.chat_reports;
create policy chat_reports_reporter_insert
  on public.chat_reports for insert
  with check (reporter_id = auth.uid());

drop function if exists public.get_chat_messages(uuid, integer);

create or replace function public.get_chat_messages(
  p_league_id uuid,
  p_limit integer default 200
)
returns table(
  id uuid,
  league_id uuid,
  league_competition_id uuid,
  user_id uuid,
  kind text,
  content text,
  meta jsonb,
  matchday_id uuid,
  matchday_number integer,
  created_at timestamptz,
  team_name text
)
language sql
security definer
set search_path to 'public'
as $function$
  select
    m.id,
    m.league_id,
    m.league_competition_id,
    m.user_id,
    coalesce(m.kind, m.message_type, 'text') as kind,
    m.content,
    coalesce(m.meta, m.mentions_data) as meta,
    m.matchday_id,
    md.number as matchday_number,
    m.created_at,
    coalesce(lcm.team_name, lm.team_name, 'Squadra') as team_name
  from public.messages m
  left join public.matchdays md on md.id = m.matchday_id
  left join public.league_competition_members lcm
    on lcm.league_competition_id = m.league_competition_id
   and lcm.user_id = m.user_id
  left join public.league_members lm
    on lm.league_id = m.league_id
   and lm.user_id = m.user_id
  where m.league_id = p_league_id
    and public.is_league_member(p_league_id)
    and coalesce(m.moderation_status, 'visible') = 'visible'
    and not exists (
      select 1
      from public.chat_user_blocks b
      where b.blocker_id = auth.uid()
        and b.blocked_id = m.user_id
    )
  order by m.created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 500));
$function$;

create or replace function public.send_chat_message(
  p_league_id uuid,
  p_league_competition_id uuid,
  p_matchday_id uuid,
  p_content text,
  p_kind text default 'text',
  p_meta jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_kind text := coalesce(nullif(btrim(p_kind), ''), 'text');
  v_content text := btrim(coalesce(p_content, ''));
begin
  if not public.is_league_member(p_league_id) then
    raise exception 'Accesso negato';
  end if;

  if v_kind not in ('text', 'lineup', 'matchday', 'nyx') then
    raise exception 'Tipo di messaggio non valido';
  end if;

  if v_kind = 'text' and v_content = '' then
    raise exception 'Messaggio vuoto';
  end if;

  if length(v_content) > 1000 then
    raise exception 'Messaggio troppo lungo: massimo 1000 caratteri';
  end if;

  if p_league_competition_id is not null and not exists (
    select 1
    from public.league_competitions lc
    where lc.id = p_league_competition_id
      and lc.league_id = p_league_id
      and lc.status = 'active'
  ) then
    raise exception 'Competizione non valida';
  end if;

  if p_matchday_id is not null and not exists (
    select 1
    from public.matchdays m
    join public.league_competitions lc on lc.season_id = m.season_id
    where m.id = p_matchday_id
      and lc.league_id = p_league_id
      and (p_league_competition_id is null or lc.id = p_league_competition_id)
  ) then
    raise exception 'Giornata non valida';
  end if;

  insert into public.messages(
    league_id,
    user_id,
    content,
    kind,
    message_type,
    meta,
    mentions_data,
    matchday_id,
    league_competition_id,
    moderation_status
  )
  values(
    p_league_id,
    auth.uid(),
    v_content,
    v_kind,
    v_kind,
    p_meta,
    p_meta,
    p_matchday_id,
    p_league_competition_id,
    'visible'
  )
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.report_chat_message(
  p_message_id uuid,
  p_reason text default 'Altro'
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_league_id uuid;
begin
  select league_id into v_league_id
  from public.messages
  where id = p_message_id;

  if v_league_id is null or not public.is_league_member(v_league_id) then
    raise exception 'Messaggio non disponibile';
  end if;

  insert into public.chat_reports(message_id, reporter_id, reason)
  values(
    p_message_id,
    auth.uid(),
    left(coalesce(nullif(btrim(p_reason), ''), 'Altro'), 200)
  )
  on conflict (message_id, reporter_id) do update
    set reason = excluded.reason,
        status = 'open',
        reviewed_at = null,
        reviewed_by = null
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.block_chat_user(
  p_league_id uuid,
  p_blocked_user_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.is_league_member(p_league_id) then
    raise exception 'Accesso negato';
  end if;

  if p_blocked_user_id = auth.uid() then
    raise exception 'Non puoi bloccare te stesso';
  end if;

  if not exists (
    select 1
    from public.league_members lm
    where lm.league_id = p_league_id
      and lm.user_id = p_blocked_user_id
  ) then
    raise exception 'Utente non appartenente alla lega';
  end if;

  insert into public.chat_user_blocks(blocker_id, blocked_id)
  values(auth.uid(), p_blocked_user_id)
  on conflict do nothing;
end;
$function$;

create or replace function public.resolve_chat_report(
  p_report_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_league_id uuid;
begin
  if p_status not in ('reviewed', 'dismissed') then
    raise exception 'Stato report non valido';
  end if;

  select m.league_id into v_league_id
  from public.chat_reports r
  join public.messages m on m.id = r.message_id
  where r.id = p_report_id;

  if v_league_id is null or not public.is_league_admin(v_league_id) then
    raise exception 'Solo admin lega';
  end if;

  update public.chat_reports
  set status = p_status,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_report_id;

  if p_status = 'reviewed' then
    update public.messages m
    set moderation_status = 'hidden'
    where m.id = (select r.message_id from public.chat_reports r where r.id = p_report_id);
  end if;
end;
$function$;

create or replace function public.get_chat_reports(p_league_id uuid)
returns table(
  id uuid,
  message_id uuid,
  reporter_team_name text,
  author_team_name text,
  content text,
  reason text,
  status text,
  created_at timestamptz
)
language sql
security definer
set search_path to 'public'
as $function$
  select
    r.id,
    r.message_id,
    coalesce(reporter_lm.team_name, 'Utente') as reporter_team_name,
    coalesce(author_lm.team_name, 'Utente') as author_team_name,
    m.content,
    r.reason,
    r.status,
    r.created_at
  from public.chat_reports r
  join public.messages m on m.id = r.message_id
  left join public.league_members reporter_lm
    on reporter_lm.league_id = m.league_id
   and reporter_lm.user_id = r.reporter_id
  left join public.league_members author_lm
    on author_lm.league_id = m.league_id
   and author_lm.user_id = m.user_id
  where m.league_id = p_league_id
    and public.is_league_admin(p_league_id)
  order by r.created_at desc;
$function$;

revoke execute on function public.get_chat_messages(uuid, integer) from public, anon;
revoke execute on function public.send_chat_message(uuid, uuid, uuid, text, text, jsonb) from public, anon;
grant execute on function public.get_chat_messages(uuid, integer) to authenticated;
grant execute on function public.send_chat_message(uuid, uuid, uuid, text, text, jsonb) to authenticated;
grant execute on function public.report_chat_message(uuid, text) to authenticated;
grant execute on function public.block_chat_user(uuid, uuid) to authenticated;
grant execute on function public.resolve_chat_report(uuid, text) to authenticated;
grant execute on function public.get_chat_reports(uuid) to authenticated;
