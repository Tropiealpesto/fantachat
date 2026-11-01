-- Adds a saved visual pattern for circular team badges.

alter table public.league_members
  add column if not exists kit_pattern text;

update public.league_members
set kit_pattern = 'split'
where kit_pattern is null
   or kit_pattern not in ('split', 'vertical', 'horizontal', 'quarters', 'band', 'slash', 'stripes', 'rings', 'solid');

alter table public.league_members
  alter column kit_pattern set default 'split',
  alter column kit_pattern set not null;

do $$
begin
  alter table public.league_members
    add constraint league_members_kit_pattern_check
    check (kit_pattern in ('split', 'vertical', 'horizontal', 'quarters', 'band', 'slash', 'stripes', 'rings', 'solid'));
exception
  when duplicate_object then null;
end $$;

drop function if exists public.get_league_members(uuid);

create or replace function public.get_league_members(p_league_id uuid)
returns table(
  user_id uuid,
  team_name text,
  role text,
  color_primary text,
  color_secondary text,
  kit_pattern text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_league_member(p_league_id) then
    raise exception 'Accesso negato';
  end if;

  return query
  select
    lm.user_id,
    lm.team_name,
    coalesce(lm.role, 'player') as role,
    lm.color_primary,
    lm.color_secondary,
    coalesce(lm.kit_pattern, 'split') as kit_pattern
  from public.league_members lm
  where lm.league_id = p_league_id
  order by lm.joined_at nulls last, lm.team_name;
end;
$$;

create or replace function public.set_team_colors(
  p_league_id uuid,
  p_color_primary text,
  p_color_secondary text,
  p_kit_pattern text default 'split'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pattern text;
begin
  if not public.is_league_member(p_league_id) then
    raise exception 'Accesso negato';
  end if;

  v_pattern := case
    when p_kit_pattern in ('split', 'vertical', 'horizontal', 'quarters', 'band', 'slash', 'stripes', 'rings', 'solid')
      then p_kit_pattern
    else 'split'
  end;

  update public.league_members
  set
    color_primary = p_color_primary,
    color_secondary = p_color_secondary,
    kit_pattern = v_pattern
  where league_id = p_league_id
    and user_id = auth.uid();
end;
$$;

revoke execute on function public.get_league_members(uuid) from public, anon;
revoke execute on function public.set_team_colors(uuid, text, text, text) from public, anon;
grant execute on function public.get_league_members(uuid) to authenticated;
grant execute on function public.set_team_colors(uuid, text, text, text) to authenticated;
