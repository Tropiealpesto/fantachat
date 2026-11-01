insert into competitions(name, slug, type, default_total_matchdays, theme_key, active)
values
('Serie A','serie-a','campionato',38,'campionato',true),
('Champions League','champions-league','champions',17,'champions',true),
('Mondiale 2026','mondiale-2026','mondiale',7,'mondiale',true)
on conflict do nothing;

insert into seasons(competition_id, name, total_matchdays, active)
select id, case slug when 'serie-a' then 'Serie A 2025/26' when 'champions-league' then 'Champions 2025/26' else 'Mondiale 2026' end, default_total_matchdays, true
from competitions c
where not exists(select 1 from seasons s where s.competition_id=c.id and s.active=true);
