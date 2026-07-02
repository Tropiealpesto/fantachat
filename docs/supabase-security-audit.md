# Supabase Security Audit - Punto 1

Audit basato su migrations e codice frontend presenti nel repo.

## Esito preliminare

Stato: **non ancora chiudibile per produzione**.

La base e' buona: molte RPC usano `SECURITY DEFINER`, `set search_path=public` e controlli `is_league_member` / `is_league_admin`.
Pero' ci sono alcuni rischi da sistemare o verificare sul DB live prima del lancio.

## Finding principali

### P0 - Schema Supabase non completamente riproducibile dal repo

`supabase/migrations/011_superadmin_structure.sql` dice che parti superadmin sono state applicate manualmente.
Il frontend chiama RPC come `superadmin_get_competitions`, `superadmin_upsert_player_stats`, `superadmin_get_fixtures`, ecc., ma queste definizioni non sono nel repo.

Rischio:
- impossibile ricreare l'ambiente da zero;
- una migration vecchia puo' sovrascrivere funzioni reali;
- audit incompleto delle funzioni piu' potenti.

Azioni:
- esportare tutte le funzioni superadmin live;
- versionarle in migration;
- rimuovere/aggiornare stub non produttivi.

### P0 - Migration 007 contiene stub admin pericolosi se riapplicati

Queste funzioni sono stub:

- `get_admin_picked_players`
- `admin_upsert_manual_scores`
- `generate_pick_schedule`
- `get_pick_schedule_recap_text`
- `reset_user_lineup`

Rischio:
- se la migration viene riapplicata o usata per bootstrap, puo' sostituire funzioni reali con no-op.

Azioni:
- sostituire gli stub con implementazioni reali versionate;
- oppure spostarli in migration legacy chiaramente non applicabile a produzione.

### P1 - RLS mancante o non documentata su tabelle create dopo baseline

Da migration locali risultano create o usate tabelle non coperte chiaramente dalla baseline RLS:

- `user_context`
- `competition_config`
- `competition_real_teams`
- `competition_players`
- `league_competition_members`
- potenzialmente `app_admins` e `top_teams` sul DB live

Rischio:
- accesso diretto via PostgREST piu' largo del necessario;
- fallback frontend su `.from("user_context")` puo' funzionare solo se il tavolo e' aperto, oppure rompersi se RLS viene abilitata senza policy.

Azioni:
- abilitare RLS;
- aggiungere policy minime;
- preferire RPC robuste rispetto a fallback diretti.

### P1 - `create_nyx_content` non verifica coerenza tra lega, competizione e giornata

La funzione controlla `is_league_admin(p_league_id)`, ma riceve anche `p_league_competition_id` e `p_matchday_id`.
Va verificato che competizione e giornata appartengano davvero alla lega indicata.

Rischio:
- un admin di una lega potrebbe creare contenuti collegati a id non coerenti se conosce UUID validi.

Azioni:
- hardening in `013_security_hardening.sql`.

### P1 - `create_league_competition` non verifica che stagione e competizione siano coerenti

La funzione riceve `p_competition_id` e `p_season_id`, ma nella migration locale non verifica esplicitamente che la season appartenga alla competition.

Rischio:
- combinazioni incoerenti competition/season.

Azioni:
- hardening in `013_security_hardening.sql`.

### P1 - Privilegi EXECUTE sulle RPC da verificare

Postgres concede spesso `EXECUTE` a `PUBLIC` sulle funzioni.
Molte funzioni sono protette internamente da `auth.uid()`, membership o admin check, ma per produzione e' meglio revocare l'esecuzione pubblica sulle RPC sensibili e concederla solo a `authenticated`.

Azioni:
- eseguire query audit sotto;
- revocare/grant in modo mirato.

### P2 - Policy `lineups_owner_or_admin` permette a tutti i membri di leggere tutte le lineups

La policy si chiama `owner_or_admin`, ma usa:

```sql
user_id = auth.uid() or is_league_member(league_id)
```

Quindi ogni membro della lega puo' leggere tutte le formazioni della lega.

Questo puo' essere voluto dopo la chiusura della giornata, ma va deciso.

Azioni:
- decidere regola prodotto;
- se serve privacy pre-deadline, spostare lettura lineups in RPC che nasconde gli avversari finche' la giornata e' aperta.

### P2 - Letture globali pubbliche

Policy come `fixtures_read using (true)` e `top_n_read using (true)` rendono quei dati leggibili pubblicamente.
Puo' andare bene per dati di catalogo/calendario, ma va deciso esplicitamente.

## Query da lanciare su Supabase

### 1. Tabelle public senza RLS

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

Focus: ogni tabella con dati utenti/lega deve avere `rowsecurity = true`.

### 2. Policy attive

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

### 3. Funzioni SECURITY DEFINER

```sql
select
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  l.lanname as language,
  p.prosecdef as security_definer,
  array_to_string(p.proconfig, ', ') as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
order by p.proname, arguments;
```

Controllare:
- `security_definer = true` solo dove serve;
- `search_path` fissato a `public`;
- funzioni admin/superadmin presenti nel repo.

### 4. Funzioni con EXECUTE a PUBLIC/anon/authenticated

```sql
select
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  r.rolname as grantee,
  has_function_privilege(r.rolname, p.oid, 'EXECUTE') as can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join pg_roles r
where n.nspname = 'public'
  and r.rolname in ('public', 'anon', 'authenticated')
order by p.proname, r.rolname;
```

Se `public_execute` o `anon_execute` risultano `true` sulle RPC applicative, applicare una revoca mirata.
Nel repo e' stata preparata `supabase/migrations/014_restrict_rpc_execute.sql`.

Query compatta di verifica dopo la revoca:

```sql
select
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  has_function_privilege('public', p.oid, 'EXECUTE') as public_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname, arguments;
```

### 5. Definizione completa funzioni superadmin live

```sql
select pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname like 'superadmin_%'
order by p.proname, pg_get_function_arguments(p.oid);
```

Questa e' fondamentale per rendere il repo riproducibile.

### 6. Tabelle usate direttamente dal frontend

Verificare policy e dati esposti per:

```sql
select 'user_context' as table_name union all
select 'league_members' union all
select 'leagues' union all
select 'league_competitions' union all
select 'competitions' union all
select 'seasons' union all
select 'matchdays' union all
select 'real_teams' union all
select 'top_teams' union all
select 'top_n' union all
select 'fixtures';
```

### 7. Colonne live delle tabelle critiche

```sql
select
  table_name,
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'matchdays',
    'league_competitions',
    'competition_config',
    'competition_standings',
    'league_competition_members',
    'user_context',
    'nyx_content',
    'messages'
  )
order by table_name, ordinal_position;
```

Serve per verificare che la migration di hardening combaci con il DB reale, dato che alcune parti superadmin risultano applicate manualmente.

## Criteri per chiudere il punto 1

- Tutte le tabelle sensibili hanno RLS attiva.
- Tutte le policy sono motivate.
- Tutte le RPC chiamate dal frontend sono versionate nel repo.
- Nessuna funzione admin/superadmin e' stub in una migration produttiva.
- Le funzioni `SECURITY DEFINER` hanno `search_path` fissato.
- RPC admin/superadmin verificano ruolo e coerenza degli UUID collegati.
- Build frontend passa dopo eventuali modifiche.
- Smoke test manuale su Supabase: player non admin non puo' eseguire funzioni admin.
