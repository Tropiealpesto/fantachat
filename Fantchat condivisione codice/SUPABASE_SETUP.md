# FantaChat — Supabase setup

Questo refactoring porta FantaChat al modello:

```txt
league → league_competitions → competition / season
```

La lega resta la community. Le competizioni sono interne alla lega e non generano più nuove leghe.

## Ordine migration

Esegui in Supabase SQL editor, nell'ordine:

1. `supabase/migrations/001_schema_league_competitions.sql`
2. `supabase/migrations/002_indexes.sql`
3. `supabase/migrations/003_rls_policies.sql`
4. `supabase/migrations/004_rpc_context.sql`
5. `supabase/migrations/005_rpc_lineups.sql`
6. `supabase/migrations/006_rpc_scores.sql`
7. `supabase/migrations/007_rpc_admin.sql`
8. `supabase/migrations/008_rpc_superadmin.sql`
9. `supabase/migrations/009_seed_default_competitions.sql`

Le migration sono additive: non fanno drop distruttivi delle vecchie tabelle. `matchday_articles`, eventuali `chat_messages` o vecchie colonne possono essere rimosse solo dopo verifica manuale.

## Env richieste

Nel progetto servono:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

La service role è usata solo nel server client esistente. Non esporla mai nel frontend.

## Dati seed minimi

La migration `009` crea:

- Serie A
- Champions League
- Mondiale 2026
- una season attiva per ogni competizione

Poi il superadmin deve caricare:

- `real_teams`
- `competition_real_teams`
- `real_players`
- `competition_players`
- `fixtures`
- `top_n`
- `player_votes`

## Test funzionali

1. **Login**
   - accedi o crea un account.

2. **Creazione lega**
   - vai su `/crea-lega`.
   - crea una lega.
   - verifica `user_context.active_league_id` e `active_league_competition_id`.

3. **Aggiunta competizione**
   - entra come admin.
   - vai su `/admin/competizione/nuova`.
   - aggiungi Champions o Mondiale.
   - verifica che venga creata una riga in `league_competitions`, non una nuova `league`.

4. **Cambio competizione**
   - apri il drawer.
   - cambia competizione.
   - verifica che cambi `active_league_competition_id`, senza cambiare `active_league_id`.

5. **Invio rosa**
   - assicurati che esista una giornata `open` per quella `league_competition`.
   - invia la rosa.
   - verifica `lineups`, `lineup_players` e messaggio `lineup_notification` in `messages`.

6. **Inserimento voti superadmin**
   - usa RPC `upsert_player_vote`.
   - poi `recalculate_all_leagues_for_competition_matchday`.

7. **Classifiche**
   - verifica `scores`, `matchday_team_scores`, `competition_standings`.
   - `/live` e `/classifica` devono leggere dati aggregati.

8. **Chat unificata**
   - verifica che `/chat` legga `messages` per `league_id`.
   - i messaggi con `league_competition_id` mostrano badge/colore.

9. **Nyx**
   - da `/admin/podcast` salva una puntata.
   - verifica `nyx_content` e messaggio `nyx` in chat.
   - `/podcast` legge solo `nyx_content`.

## Note importanti

- Il Giornale è stato rimosso dal frontend.
- `matchday_articles` non è più usata.
- `chat_messages` non è più usata.
- Le pagine superadmin base sono presenti, con TODO UI per inserimento avanzato dati globali.
- Il calcolo punteggi è spostato in RPC Supabase.
