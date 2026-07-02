# Supabase Performance Audit - Punto 2

Audit operativo per rendere FantaChat pronta a molte leghe e molti utenti.

## Obiettivo

Ottimizzare le aree piu usate:

- Home;
- Rosa;
- Live;
- Classifica;
- Chat;
- Superadmin voti/calendario/top team.

## Stato iniziale

Il repo contiene `supabase/migrations/002_indexes.sql`, ma lo schema live e' diverso da alcune migration storiche.
Esempio: nel DB live `matchdays` usa `season_id`, mentre la migration storica indicizza `matchdays(league_competition_id, number, status)`.

Per questo il punto 2 deve partire dal database live, non dalle migration vecchie.

## Query da lanciare su Supabase

### 1. Indici live

```sql
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;
```

### 2. Dimensione e stima righe tabelle

```sql
select
  relname as table_name,
  n_live_tup as estimated_rows,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size,
  pg_size_pretty(pg_relation_size(relid)) as table_size,
  pg_size_pretty(pg_indexes_size(relid)) as indexes_size
from pg_stat_user_tables
where schemaname = 'public'
order by pg_total_relation_size(relid) desc;
```

### 3. Uso degli indici

```sql
select
  relname as table_name,
  indexrelname as index_name,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
from pg_stat_user_indexes
where schemaname = 'public'
order by idx_scan asc, relname, indexrelname;
```

### 4. Query lente, se `pg_stat_statements` e' disponibile

```sql
select
  calls,
  round(total_exec_time::numeric, 2) as total_ms,
  round(mean_exec_time::numeric, 2) as mean_ms,
  rows,
  left(query, 500) as query
from pg_stat_statements
where dbid = (select oid from pg_database where datname = current_database())
order by total_exec_time desc
limit 30;
```

Se questa query fallisce per estensione non disponibile, non e' bloccante.

## Indici candidati da verificare

Inventario live ricevuto.

Indici gia presenti e utili:

- `league_members(league_id, user_id)`;
- `league_members(user_id)`;
- `messages(league_id, created_at)`;
- `scores(lineup_id)`;
- `real_players(competition_id, role)`;
- `top_teams(competition_id, season_id, matchday_number, real_team_id)`;
- `player_stats(competition_id, season_id, matchday_number, real_player_id)`.

Buchi principali trovati:

- `matchdays` non ha indici su `season_id/status/number`;
- `lineups` non ha indici su `league_competition_id`;
- `lineup_players` non ha indice su `lineup_id`;
- `messages` non ha indice su `league_competition_id`;
- `competition_standings` non ha indice su `league_competition_id/rank`;
- `fixtures` non ha indice lookup competizione/stagione/giornata;
- `real_players` non ha indici completi per ricerca giocatori attivi;
- `competition_config` non ha indice su `competition_id`;
- `player_stats` ha piu indici unici duplicati sulla stessa chiave naturale. Da non rimuovere ora senza verificare dipendenze/migration history.

Migration preparata:

- `supabase/migrations/017_live_performance_indexes.sql`

Stato:

- applicata su Supabase live;
- inventario post-migration verificato;
- tutti gli indici della migration risultano presenti.
- dimensioni tabelle verificate: database live ancora molto piccolo, quindi non basta per validare carico reale.
- tabella maggiore: `real_players`, circa 1248 righe e 552 kB totali.
- aree ancora non testate sotto carico: `messages`, `scores`, `lineups`, `competition_standings`, `player_stats`.
- uso indici verificato dopo `017`.
- molti indici nuovi hanno `idx_scan=0` perche' sono stati appena creati e il dataset live e' ancora piccolo.
- indici gia caldi:
  - `real_players_competition_id_role_idx`;
  - `scores_lineup_id_idx`;
  - `league_members_league_id_user_id_key`;
  - `league_competitions_pkey`;
  - `competitions_pkey`;
  - `real_teams_id_comp_uniq`.
- attenzione: `player_stats` ha piu indici duplicati sulla stessa chiave naturale `(competition_id, season_id, matchday_number, real_player_id)`. Prima di dropparli va verificato quali sono constraint e quali solo indici.
- constraint `player_stats` verificati: esistono due unique constraint identici sulla chiave naturale piu un unique index extra e un lookup index ridondante.
- migration preparata: `supabase/migrations/018_cleanup_player_stats_duplicate_indexes.sql`.
- la migration mantiene `player_stats_natural_uniq` e rimuove i duplicati per ridurre overhead in scrittura durante import/aggiornamento voti.
- cleanup `player_stats` applicato e verificato:
  - rimasti `player_stats_pkey` e `player_stats_natural_uniq`;
  - rimossi unique constraint/index duplicati.
- `pg_stat_statements` disponibile e verificato.
- Le query piu pesanti per tempo totale sono soprattutto rumore/piattaforma:
  - `realtime.list_changes`;
  - query catalogo/metadata Supabase;
  - backup;
  - auth `refresh_tokens`.
- Query applicative emerse nel campione:
  - `get_app_context`: circa 466 chiamate, media circa 32 ms;
  - varie RPC legacy come `get_my_season_stats`, `get_league_scores`, `get_live_table_for_active_league`, `get_my_matchday_lineup`, `save_picks`, `get_home_nyx_message`, `get_fixtures_for_active_league_open_matchday`.
- Le RPC legacy emerse non risultano tra i percorsi principali del frontend attuale e vanno trattate come debito storico prima di ottimizzarle.
- query lenta focalizzata sulle RPC attuali verificata:
  - `get_app_context`: circa 25-32 ms medi;
  - `get_lineup_form_data`: circa 24 ms medi, con pochi campioni intorno a 55 ms;
  - `get_live_data`: circa 13-15 ms medi;
  - `get_standings`: circa 5-13 ms medi;
  - `get_home_top_players`: circa 7 ms medi;
  - `get_chat_messages`: circa 4-6 ms medi;
  - `get_league_members`: sotto 2 ms medi;
  - `chat_search_players`: circa 6 ms medi;
  - `submit_lineup`: campioni bassi, circa 20-52 ms.
- nessuna RPC attuale richiede ottimizzazione urgente con il dataset live corrente.
- il limite dell'analisi e' il dataset piccolo: serve punto 3 con dati realistici per validare migliaia di utenti.

Indici inclusi:

- `matchdays(season_id, status, number desc)`;
- `league_competitions(league_id, status)`;
- `league_competitions(competition_id, season_id, status)`;
- `league_competition_members(league_competition_id, user_id)`;
- `competition_standings(league_competition_id, rank)`;
- `lineups(league_competition_id, matchday_id, user_id)`;
- `lineup_players(lineup_id)`;
- `scores(lineup_id)`;
- `scores(real_player_id)`;
- `messages(league_id, created_at desc)`;
- `messages(league_competition_id, created_at desc)`;
- `real_players(competition_id, active, role, name)`;
- `real_players(competition_id, active, team)`;
- `real_players(real_team_id)`;
- `top_teams(competition_id, season_id, matchday_number)`;
- `fixtures(competition_id, season_id, matchday_number)`;
- `player_stats(competition_id, season_id, matchday_number, real_player_id)`.

## Criteri per chiudere il punto 2

- Indici live coerenti con schema reale.
- Nessuna tabella calda senza indice sui filtri principali.
- Chat e classifiche non degradano con molte righe.
- Funzioni Home/Rosa/Live/Classifica rispondono con tempi ragionevoli su dati realistici.
- Smoke test app dopo applicazione indici.
