# FantaChat Punteggi non standard

Stato: implementazione preparata.

Ruleset:

- `non_standard`

Migration:

- `supabase/migrations/020_non_standard_scoring.sql`

## Punteggi

### Eventi base

- Gol segnato: `+3`
- Assist: `+1`
- Ammonizione: `-0.5`
- Espulsione: `-1`
- Rigore sbagliato: `-3`
- Rigore parato portiere: `+3`
- Porta inviolata portiere: `+1`
- Porta inviolata difensore: `+1`
- Gol subito dal portiere: `-1` ciascuno

### Statistiche avanzate

- Passaggi riusciti: `+0.005` ciascuno
- Precisione passaggi: `+0.3` se `pass_accuracy > 85` e `passes_completed >= 20`
- Tackle: `+0.10` ciascuno
- Intercetto: `+0.10` ciascuno
- npxG: `x1`
- xA / expected assist: `x1`

### Portiere

- Bonus percentuale parate: `+0.5` se `save_pct > 80`
- Bonus parate rafforzato: `+1` se `save_pct > 80` e `saves >= 5`

Se `save_pct` non arriva dalla fonte dati, il backend prova a calcolarla come:

```txt
saves / (saves + goals_conceded) * 100
```

## Colonne aggiunte a `player_stats`

- `passes_completed`
- `pass_accuracy`
- `tackles`
- `interceptions`
- `npxg`
- `saves`
- `save_pct`

## Funzioni aggiornate

- `compute_player_points_v2`
- `set_scoring_ruleset`
- `recalc_competition_matchday`
- `get_player_stats`
- `get_player_detail`
- `superadmin_get_player_stats`
- `superadmin_upsert_player_stats`

## UI aggiornata

- Creazione competizione: aggiunto tipo punteggio `Non standard`.
- Superadmin statistiche: aggiunti campi avanzati.
- Regole: aggiunto blocco dedicato al ruleset `non_standard`.

## Test minimo dopo applicazione migration

1. Applicare `020_non_standard_scoring.sql`.
2. Creare o aggiornare una competizione con ruleset `non_standard`.
3. Inserire statistiche per almeno un giocatore.
4. Eseguire `recalc_competition_matchday`.
5. Controllare `scores`, Home, Live, Classifica, Statistiche e dettaglio giocatore.

