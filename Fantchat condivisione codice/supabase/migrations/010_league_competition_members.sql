-- ============================================================
-- FantaChat - FASE 1
-- Partecipanti per singola competizione interna alla lega
-- ============================================================

create table if not exists public.league_competition_members (
  id uuid primary key default gen_random_uuid(),
  league_competition_id uuid not null references public.league_competitions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_name text not null,
  created_at timestamptz default now(),
  unique (league_competition_id, user_id)
);

create index if not exists idx_lc_members_lc
on public.league_competition_members(league_competition_id);

create index if not exists idx_lc_members_user
on public.league_competition_members(user_id);

create index if not exists idx_lc_members_lc_user
on public.league_competition_members(league_competition_id, user_id);
