# FantaChat Backup e Recovery

Stato: completato baseline.

Obiettivo: evitare che un errore su voti, ricalcoli o finalizzazione giornata rovini classifiche e formazioni senza una via rapida di ritorno.

## Livelli di protezione

### 1. Backup piattaforma

Serve per disastri grossi:

- cancellazione accidentale di molte tabelle;
- migration sbagliata;
- bug distruttivo;
- compromissione dati;
- errore non recuperabile con snapshot applicativi.

Da verificare su Supabase prima della beta:

- piano Supabase con backup automatici adeguati;
- possibilita di restore point-in-time per il database di produzione;
- chi ha accesso al restore;
- tempo massimo realistico di ripristino.

### 2. Snapshot applicativo

Serve per errori tipici di FantaChat:

- voti importati male;
- ricalcolo classifica sbagliato;
- finalizzazione giornata fatta troppo presto;
- scores o standings corrotti da una procedura.

Migration preparata:

- `supabase/migrations/019_recovery_snapshots.sql`

Crea:

- tabella `recovery_snapshots`;
- funzione `superadmin_create_matchday_recovery_snapshot`;
- funzione `superadmin_list_recovery_snapshots`;
- funzione `superadmin_restore_matchday_recovery_snapshot`.

## Regola operativa

Prima di ogni operazione rischiosa:

1. creare snapshot della giornata;
2. importare voti o lanciare ricalcolo;
3. controllare classifiche e scores;
4. solo dopo considerare l'operazione chiusa.

Operazioni rischiose:

- import massivo `player_stats`;
- modifica Top squadre;
- ricalcolo giornata;
- finalizzazione giornata;
- migration che tocca `scores`, `lineups`, `lineup_players`, `competition_standings`, `matchdays`.

## Query di controllo dopo applicazione migration

```sql
select to_regclass('public.recovery_snapshots') as recovery_snapshots;

select
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'superadmin_create_matchday_recovery_snapshot',
    'superadmin_list_recovery_snapshots',
    'superadmin_restore_matchday_recovery_snapshot'
  )
order by routine_name;
```

## Creare uno snapshot

Da chiamare come superadmin autenticato:

```sql
select public.superadmin_create_matchday_recovery_snapshot(
  'LEAGUE_COMPETITION_ID'::uuid,
  'MATCHDAY_ID'::uuid,
  'Prima import voti giornata 1'
);
```

La funzione congela:

- `matchdays`;
- `lineups`;
- `lineup_players`;
- `scores`;
- `competition_standings`.

Non congela `player_stats`, perche sono dati globali di competizione. Per errori su `player_stats`, la procedura primaria e' reimportare i dati corretti e ricalcolare.

## Lista snapshot

```sql
select *
from public.superadmin_list_recovery_snapshots('LEAGUE_COMPETITION_ID'::uuid);
```

## Restore snapshot

Da usare solo quando hai verificato che la giornata e' davvero corrotta:

```sql
select public.superadmin_restore_matchday_recovery_snapshot(
  'SNAPSHOT_ID'::uuid
);
```

Il restore cancella e reinserisce lo stato salvato per:

- lineup della competizione/giornata;
- giocatori schierati;
- scores collegati;
- standings della competizione;
- stato della giornata.

## Controlli post-restore

```sql
select team_name, total_points, rank
from public.competition_standings
where league_competition_id = 'LEAGUE_COMPETITION_ID'::uuid
order by rank nulls last, team_name;

select li.user_id, lm.team_name, count(lp.id) as players_count
from public.lineups li
join public.league_competition_members lm
  on lm.league_competition_id = li.league_competition_id
 and lm.user_id = li.user_id
left join public.lineup_players lp on lp.lineup_id = li.id
where li.league_competition_id = 'LEAGUE_COMPETITION_ID'::uuid
  and li.matchday_id = 'MATCHDAY_ID'::uuid
group by li.user_id, lm.team_name
order by lm.team_name;

select lm.team_name, rp.name, s.role, s.points
from public.scores s
join public.lineups li on li.id = s.lineup_id
join public.league_competition_members lm
  on lm.league_competition_id = li.league_competition_id
 and lm.user_id = li.user_id
join public.real_players rp on rp.id = s.real_player_id
where li.league_competition_id = 'LEAGUE_COMPETITION_ID'::uuid
  and li.matchday_id = 'MATCHDAY_ID'::uuid
order by lm.team_name, s.role;
```

## Recovery per scenari

### Voti importati male

1. Non fare subito restore.
2. Reimportare `player_stats` corretti.
3. Eseguire `recalc_competition_matchday`.
4. Controllare standings e scores.
5. Se lo stato rimane corrotto, ripristinare lo snapshot.

### Ricalcolo sbagliato

1. Bloccare ulteriori modifiche admin.
2. Ripristinare snapshot.
3. Capire la causa del ricalcolo.
4. Correggere funzione o dati.
5. Creare nuovo snapshot.
6. Rilanciare ricalcolo.

### Migration sbagliata

1. Non tentare fix casuali.
2. Valutare rollback applicativo se il problema e' frontend.
3. Se il database e' danneggiato, usare backup piattaforma o point-in-time recovery.
4. Eseguire smoke test completo.

### Utente o lega cancellata per errore

Lo snapshot applicativo non basta se sono state cancellate entita principali. In questo caso serve restore piattaforma o script mirato costruito dal backup.

## Criteri di chiusura punto 6

- Migration `019_recovery_snapshots.sql` applicata su Supabase.
- Query di controllo passate.
- Creato snapshot su lega finta.
- Restore snapshot testato su lega finta.
- Classifica post-restore verificata.

## Test eseguito

Data: 2026-07-02

Snapshot:

- `62d293cf-99b3-4091-b59d-a4ffce686977`

Competizione:

- `af16621c-68d2-45b9-b988-34d6a8fef4ad`

Giornata:

- `73acae65-484d-4ffa-b63e-57bb3a92163e`

Esito:

- snapshot creato;
- lista snapshot verificata;
- restore eseguito con risposta `Snapshot ripristinato`;
- classifica ripristinata correttamente:
  - La mia squadra: 10 pt, rank 1;
  - Pietro11: 7 pt, rank 2;
  - Steak Hatsie: 2.5 pt, rank 3.

Nota residua:

- prima del lancio pubblico verificare anche il piano Supabase per backup automatici e point-in-time recovery.
