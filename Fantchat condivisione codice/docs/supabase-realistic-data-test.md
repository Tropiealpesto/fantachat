# Supabase Realistic Data Test - Punto 3

Obiettivo: validare FantaChat con dati simili a un uso reale, includendo sempre l'utente `pietrparod@gmail.com` nelle leghe/competizioni di test.

## Principio

Non creare membri finti aggirando `auth.users`.

Molte tabelle chiave hanno foreign key verso `auth.users`, quindi per testare molte squadre servono utenti Auth reali:

- utenti gia esistenti;
- oppure utenti test creati con Supabase Admin API / service role.

## Fasi

### Fase A - Dataset visibile nell'app

Scopo:
- creare o usare una lega di test;
- includere `pietrparod@gmail.com`;
- popolare una competizione con giornate, formazioni, scores, messaggi e classifica;
- verificare Home, Rosa, Live, Classifica, Chat.

Limite:
- se nel progetto ci sono pochi utenti Auth, non simula ancora migliaia di utenti.

Seed preparato:

- `supabase/seeds/001_load_test_dataset.sql`

Crea:

- lega `LOAD TEST - Mondiale 2026`;
- invite code `LOAD26P3`;
- 20 squadre basate sugli utenti Auth attualmente esistenti;
- `pietrparod@gmail.com` come admin della lega test;
- competizione Mondiale 2026 collegata alla lega;
- lineup per la giornata aperta;
- punteggi in `scores`;
- classifica;
- 200 messaggi chat;
- `user_context` di `pietrparod@gmail.com` puntato alla lega test.

Attenzione:

- la lega test sara' visibile anche agli altri 19 utenti Auth perche' vengono inseriti in `league_members`.
- se il dataset non serve piu, usare `supabase/seeds/002_cleanup_load_test_dataset.sql`.

Stato:

- seed applicato su Supabase;
- dataset verificato nell'app;
- cleanup applicato;
- dati test rimossi.

Esito:

- Fase A completata.
- Il test ha validato un dataset visibile con utenti Auth reali esistenti.
- Non sostituisce ancora un test di carico con centinaia/migliaia di utenti test.
- Punto 3 chiuso come baseline.
- Fase B rimandata a dopo il completamento dei 7 punti.

### Fase B - Dataset di carico realistico

Scopo:
- creare molti utenti test Auth;
- creare una lega/competizione con centinaia o migliaia di partecipanti;
- generare lineup, scores, standings, messaggi e player stats;
- misurare le RPC principali con `pg_stat_statements`.

Richiede:
- `NEXT_PUBLIC_SUPABASE_URL`;
- `SUPABASE_SERVICE_ROLE_KEY`;
- script Node o SQL controllato eseguito come service role.

## Query iniziali da lanciare

### 1. Verifica utente proprietario test

```sql
select id, email, created_at
from auth.users
where lower(email) = lower('pietrparod@gmail.com');
```

Risultato live:

- `pietrparod@gmail.com`
- user id: `f9767f72-0c89-497d-90f0-6e1022bf4a91`

### 2. Schema live delle tabelle che il seed tocchera'

```sql
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'leagues',
    'league_members',
    'league_competitions',
    'league_competition_members',
    'competitions',
    'seasons',
    'matchdays',
    'lineups',
    'lineup_players',
    'scores',
    'competition_standings',
    'messages',
    'real_players',
    'player_stats'
  )
order by table_name, ordinal_position;
```

Risultato live verificato.

Note operative:

- `league_members.user_id`, `lineups.user_id`, `competition_standings.user_id`, `messages.user_id` devono riferirsi a utenti Auth reali.
- `matchdays` e' collegata a `season_id`.
- `league_competitions` contiene `players_per_role` e `scoring_ruleset`.
- `competition_config` usa `competition_id`.
- `lineup_players.lineup_id` e `lineup_players.real_player_id` sono nullable nello schema, ma il seed deve comunque valorizzarli correttamente.
- La query inviata non includeva le colonne di `scores`; serve una verifica dedicata prima di generare punteggi diretti.

### 3. Competizioni e stagioni disponibili

```sql
select
  c.id as competition_id,
  c.name as competition_name,
  c.slug,
  c.type,
  c.active,
  s.id as season_id,
  s.name as season_name,
  s.active as season_active
from public.competitions c
join public.seasons s on s.competition_id = c.id
order by c.name, s.created_at desc;
```

### 4. Utenti Auth disponibili

```sql
select id, email, created_at
from auth.users
order by created_at desc;
```

## Criteri di chiusura del punto 3

- Dataset test creato con `pietrparod@gmail.com` incluso.
- App funzionante con dati piu densi.
- `pg_stat_statements` ricontrollato dopo dataset.
- Nessuna RPC principale degrada in modo evidente.
- Limiti dichiarati se il test non usa ancora molti utenti Auth reali.
