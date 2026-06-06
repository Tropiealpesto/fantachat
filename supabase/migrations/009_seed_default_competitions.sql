-- Seed competizioni default FantaChat
-- Campionato, Champions, Coppe
-- Additivo e sicuro.

insert into public.competitions (
  name,
  slug,
  type,
  default_total_matchdays,
  theme_key,
  active,
  created_at
)
values
  ('Serie A', 'serie-a', 'campionato', 38, 'campionato', true, now()),
  ('Champions League', 'champions-league', 'champions', 13, 'champions', true, now()),
  ('Coppe', 'coppe', 'coppa', 7, 'coppe', true, now())
on conflict (slug)
do update set
  name = excluded.name,
  type = excluded.type,
  default_total_matchdays = excluded.default_total_matchdays,
  theme_key = excluded.theme_key,
  active = excluded.active;

-- Compatibilità: se esiste ancora una competizione mondiale globale,
-- la spostiamo nel contenitore grafico/logico Coppe senza cancellarla.
update public.competitions
set
  type = 'coppa',
  theme_key = 'coppe'
where lower(coalesce(type, '')) in ('mondiale', 'world', 'europeo')
   or lower(coalesce(slug, '')) like '%mondiale%'
   or lower(coalesce(slug, '')) like '%world%'
   or lower(coalesce(slug, '')) like '%europeo%';

-- Season default per Serie A
insert into public.seasons (
  competition_id,
  name,
  total_matchdays,
  active,
  created_at
)
select
  c.id,
  '2025/26',
  38,
  true,
  now()
from public.competitions c
where c.slug = 'serie-a'
on conflict do nothing;

-- Season default per Champions
insert into public.seasons (
  competition_id,
  name,
  total_matchdays,
  active,
  created_at
)
select
  c.id,
  '2025/26',
  13,
  true,
  now()
from public.competitions c
where c.slug = 'champions-league'
on conflict do nothing;

-- Season default per Coppe
insert into public.seasons (
  competition_id,
  name,
  total_matchdays,
  active,
  created_at
)
select
  c.id,
  'Coppe 2025/26',
  7,
  true,
  now()
from public.competitions c
where c.slug = 'coppe'
on conflict do nothing;
