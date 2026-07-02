# FantaChat Launch Readiness

Stato operativo per preparare l'app a una beta pubblica e poi a un lancio con molti utenti.

## Stato sintetico

| # | Area | Stato | Note |
|---|------|-------|------|
| 1 | Audit sicurezza Supabase | Completato | RLS verificata, RPC anon chiuse, funzioni core/superadmin hardenizzate, smoke test passato. |
| 2 | Performance database | Completato | Indici live allineati, duplicati puliti, query attuali ok, smoke test passato. |
| 3 | Test dati realistici | Completato baseline | Dataset visibile creato, verificato, ripulito. Fase carico grande rimandata. |
| 4 | Stabilita funzionale | In corso | Build ok, lint senza errori, checklist smoke test creata. |
| 5 | Privacy e documenti legali | Da fare | Privacy policy, termini, cancellazione account, contatto privacy. |
| 6 | Backup e recovery | Da fare | Procedura di ripristino voti/giornate/classifiche. |
| 7 | Beta chiusa | Da fare | 50-100 utenti reali dopo hardening. |

## Prossima azione

Completare il punto 1 sul database Supabase reale:

1. Lanciare le query di audit in `docs/supabase-security-audit.md`.
2. Confrontare risultato live con i finding locali.
3. Applicare, se confermata, la migration `supabase/migrations/013_security_hardening.sql`.
4. Ripetere le query di audit.
5. Testare login, home, rosa, live, classifica, chat, admin.

## Registro lavoro

### 2026-07-01 - Punto 1

Fatto:
- creata checklist dei 7 punti;
- creato audit tecnico Supabase;
- preparata migration di hardening `013_security_hardening.sql`;
- individuati rischi P0/P1/P2 su RLS, RPC e schema non completamente versionato.

Da fare per chiudere il punto:
- Punto completato. Prossima area: performance database.

Aggiornamento Supabase live:
- RLS attiva su tutte le tabelle `public` verificate: `app_admins`, `competition_config`, `competition_standings`, `competitions`, `fixtures`, `league_competition_members`, `league_competitions`, `league_members`, `leagues`, `lineup_players`, `lineups`, `matchdays`, `messages`, `nyx_content`, `player_stats`, `real_players`, `real_teams`, `scores`, `seasons`, `team_match_stats`, `top_teams`, `user_context`.
- Prossimo controllo: policy effettive e privilegi RPC.
- Policy live presenti solo su: `league_members`, `leagues`, `lineups`, `messages`, `nyx_content`, `scores`.
- Molte tabelle hanno RLS attiva ma nessuna policy diretta. Questo e' accettabile solo se l'app le legge/scrive tramite RPC `SECURITY DEFINER` controllate.
- Non applicata ancora la migration `013_security_hardening.sql`.
- Funzioni live esportate: quasi tutte le RPC applicative sono `SECURITY DEFINER` con `search_path=public`.
- Eccezioni viste: `compute_extra_points` e `compute_player_points` non sono `SECURITY DEFINER` e non hanno `search_path`; sembrano utility pure di calcolo, quindi non e' un problema critico.
- Divergenza importante: `create_league_competition` live ha firma con `p_participant_user_ids` e `p_players_per_role`, diversa dalla prima bozza `013`. La migration 013 resta bozza e non va applicata finche' non viene riallineata al DB live.
- Definizioni RPC sensibili verificate: `create_league_competition`, `create_nyx_content`, `send_chat_message`, `submit_lineup`, `get_admin_picked_players`, `admin_upsert_manual_scores`.
- Finding RPC:
  - `create_league_competition` controlla admin lega, ma non verifica esplicitamente che `season_id` appartenga a `competition_id` e che tutti i partecipanti siano gia' membri della lega.
  - `create_nyx_content` ignora `p_league_competition_id`, non verifica coerenza matchday/competizione/lega e non salva i nuovi campi `league_competition_id`/`title`.
  - `send_chat_message` controlla membership di lega, ma non verifica che eventuale `p_league_competition_id` e `p_matchday_id` appartengano alla stessa lega.
  - `submit_lineup` ha buoni controlli su competizione, membership, giornata aperta, giocatori esterni, squadre duplicate e top team; mancano ancora controlli backend su conteggio ruoli rispetto a `players_per_role` e ruolo reale del giocatore.
  - `get_admin_picked_players` e `admin_upsert_manual_scores` sono ancora stub/no-op nel DB live.
- Privilegi EXECUTE live verificati su tutte le funzioni esportate: `public_execute=true`, `anon_execute=true`, `authenticated_execute=true` per ogni RPC.
- Finding privilegi: il grant a `PUBLIC` rende tutte le RPC chiamabili anche da utenti anonimi. I controlli interni riducono il rischio, ma per produzione va revocato `EXECUTE` da `PUBLIC`/`anon` e concesso solo ad `authenticated` per le RPC applicative.
- Revoca EXECUTE applicata e verificata: tutte le funzioni esportate ora hanno `public_execute=false`, `anon_execute=false`, `authenticated_execute=true`.
- Sotto-punto chiuso: accesso anonimo alle RPC rimosso.
- Schema live verificato per tabelle critiche. Differenze principali rispetto alla bozza 013:
  - `matchdays` e' collegata a `season_id`, non a `league_competition_id`;
  - `competition_config` e' collegata a `competition_id`, non a `league_competition_id`;
  - `nyx_content` non ha `league_competition_id`, `title`, `created_by`, `updated_at`;
  - `league_competitions` contiene `players_per_role` e `scoring_ruleset`, ma non `updated_at`.
- Preparata nuova migration `015_live_rpc_hardening.sql`, allineata allo schema live, per rafforzare `create_league_competition`, `create_nyx_content`, `send_chat_message` e `submit_lineup`.
- Migration `015_live_rpc_hardening.sql` applicata con successo su Supabase live.
- Prossimo controllo: confermare definizioni/permessi post-migration e fare smoke test applicativo.
- Controllo post-015 completato:
  - tutte le funzioni esportate restano con `public_execute=false`, `anon_execute=false`, `authenticated_execute=true`;
  - `create_league_competition`, `create_nyx_content`, `send_chat_message`, `submit_lineup` risultano `SECURITY DEFINER` con `search_path=public`.
- Prossimo step del punto 1: smoke test funzionale su app loggata.
- Smoke test app loggata passato: Home, Rosa, Chat, submit formazione, Admin, Live e Classifica funzionano dopo `014` e `015`.
- Funzioni superadmin live esportate.
- Finding superadmin: alcune RPC `superadmin_*` di lettura e `superadmin_upsert_top_team` non avevano un controllo interno esplicito `is_app_admin()`. Dopo la revoca `anon`, restavano comunque chiamabili da qualsiasi utente autenticato.
- Preparata migration `016_live_superadmin_hardening.sql` per versionare le funzioni superadmin live e aggiungere check `is_app_admin()` uniforme.
- Migration `016_live_superadmin_hardening.sql` applicata con successo.
- Smoke test post-016 passato: app funzionante e flussi superadmin verificati.
- Punto 1 completato.

### 2026-07-01 - Punto 2

Fatto:
- creato audit performance `docs/supabase-performance-audit.md`;
- individuata divergenza tra indici storici del repo e schema live, in particolare `matchdays`;
- definite query per inventario indici, dimensioni tabelle, uso indici e query lente.
- ricevuto inventario indici live;
- individuati buchi su `matchdays`, `lineups`, `lineup_players`, `messages`, `competition_standings`, `fixtures`, `real_players`;
- preparata migration `017_live_performance_indexes.sql`.
- migration `017_live_performance_indexes.sql` applicata con successo;
- inventario post-017 verificato: indici performance presenti su `competition_config`, `competition_standings`, `fixtures`, `league_competitions`, `lineup_players`, `lineups`, `matchdays`, `messages`, `real_players`, `scores`, `top_teams`.
- dimensioni tabelle verificate: database live ancora piccolo. Tabella maggiore `real_players` con circa 1248 righe e 552 kB totali. Tabelle lega/chat/classifica ancora sotto carico minimo.
- uso indici verificato: indici nuovi ancora poco/non usati per dataset piccolo e perche' appena creati;
- trovati indici duplicati su `player_stats` da analizzare prima di eventuale cleanup.
- vincoli `player_stats` verificati: due unique constraint identici sulla chiave naturale piu indici duplicati;
- preparata migration `018_cleanup_player_stats_duplicate_indexes.sql` per tenere un solo vincolo naturale e ridurre overhead scrittura.
- cleanup `player_stats` applicato e verificato: rimasti solo `player_stats_pkey` e `player_stats_natural_uniq`.
- `pg_stat_statements` verificato: principali tempi totali dovuti a realtime/metadata/backup/auth; tra le query app emergono soprattutto funzioni legacy non centrali nel frontend attuale e `get_app_context` con media circa 32 ms.
- query lente filtrate sulle RPC attuali verificate: nessun collo di bottiglia urgente con dataset live attuale. `get_app_context` circa 25-32 ms medi, `get_lineup_form_data` circa 24 ms medi, Live/Classifica/Chat sotto soglie preoccupanti.

Da fare:
- Punto completato. Prossima area: test dati realistici/carico.

Chiusura:
- smoke test app dopo indici/cleanup passato: Home, Rosa, invio formazione, Live, Classifica e Chat funzionano.
- Punto 2 completato.

### 2026-07-01 - Punto 3

Fatto:
- creato documento `docs/supabase-realistic-data-test.md`;
- fissato vincolo: ogni lega/competizione di test deve includere `pietrparod@gmail.com`;
- chiarita distinzione tra dataset visibile nell'app e test di carico con molti utenti Auth reali.
- verificato utente `pietrparod@gmail.com`: `f9767f72-0c89-497d-90f0-6e1022bf4a91`;
- verificato schema live delle principali tabelle seed.
- verificati 20 utenti Auth disponibili;
- verificata competizione/stagione Mondiale 2026;
- verificato schema `scores`;
- preparato seed `supabase/seeds/001_load_test_dataset.sql`;
- preparato cleanup `supabase/seeds/002_cleanup_load_test_dataset.sql`.
- seed load test applicato, verificato nell'app e rimosso con cleanup.

Chiusura baseline:
- punto 3 completato come baseline;
- Fase B con utenti test Auth e carico a centinaia/migliaia rimandata a dopo il completamento dei 7 punti.

### 2026-07-02 - Punto 4

Fatto:
- creato documento `docs/functional-stability-checklist.md`;
- `npm run build` passato;
- `npm run lint` passato senza errori, restano warning non bloccanti;
- sistemati errori lint in:
  - `app/admin/podcast/page.tsx`;
  - `app/storico/[id]/page.tsx`;
  - `app/superadmin/page.tsx`.

Da fare:
- smoke test manuale player/admin/superadmin;
- decidere se ripulire anche i warning lint prima della beta.
