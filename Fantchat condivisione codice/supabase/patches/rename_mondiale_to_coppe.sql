-- Patch manuale: Mondiale -> Coppe
-- Eseguila in Supabase SQL Editor se hai già dati "mondiale".

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
  ('Coppe', 'coppe', 'coppa', 7, 'coppe', true, now())
on conflict (slug)
do update set
  name = excluded.name,
  type = excluded.type,
  default_total_matchdays = excluded.default_total_matchdays,
  theme_key = excluded.theme_key,
  active = true;

update public.competitions
set
  type = 'coppa',
  theme_key = 'coppe'
where lower(coalesce(type, '')) in ('mondiale', 'world', 'europeo')
   or lower(coalesce(slug, '')) like '%mondiale%'
   or lower(coalesce(slug, '')) like '%world%'
   or lower(coalesce(slug, '')) like '%europeo%';

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
