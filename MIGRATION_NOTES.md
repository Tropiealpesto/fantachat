# FantaChat — Migration notes

## Modello sostituito

Vecchio modello:

```txt
competition → season → league
```

Nuovo modello:

```txt
league → league_competitions → competition / season
```

La lega è una community. Una lega può contenere più competizioni interne.

## File eliminati

Sono stati rimossi dal progetto:

```txt
app/giornale/page.tsx
app/giornale/GiornaleClient.tsx
app/admin/giornale/page.tsx
lib/chat.ts
lib/chatHelpers.ts
```

Motivo:

- il Giornale è stato eliminato come concetto prodotto;
- `matchday_articles` non è più usata;
- la chat legacy basata su `chat_messages` è stata sostituita da `messages`.

## File principali modificati

```txt
app/components/AppContext.tsx
app/components/SideDrawer.tsx
app/components/SideDrawerWrapper.tsx
app/page.tsx
app/rosa/page.tsx
app/live/page.tsx
app/classifica/page.tsx
app/chat/page.tsx
app/components/ChatPage.tsx
app/podcast/page.tsx
app/admin/*
app/superadmin/*
```

Nuovi helper:

```txt
lib/competitionThemes.ts
lib/rpc.ts
app/hooks/useRequireApp.ts
app/components/CompetitionBadge.tsx
```

## Tabelle aggiunte o normalizzate

Nuove tabelle centrali:

```txt
league_competitions
competition_real_teams
competition_players
matchday_team_scores
competition_standings
```

Tabelle normalizzate/additive:

```txt
leagues
league_members
competitions
seasons
competition_config
matchdays
real_teams
real_players
fixtures
top_n
player_votes
lineups
scores
messages
nyx_content
user_context
```

## Logiche sostituite

- Creazione nuova competizione: non crea più una nuova `league`; crea `league_competitions`.
- Home: lavora su `active_league_id` + `active_league_competition_id`.
- Rosa: salva `lineups` con `league_competition_id`.
- Live: legge dati aggregati da RPC/tabelle aggregate.
- Classifica: legge `competition_standings`.
- Chat: unica per `league_id`, con badge competizione opzionale.
- Nyx: usa solo `nyx_content`.

## Rischi / punti da verificare

1. Lo schema reale potrebbe contenere colonne legacy diverse da quelle inferite. Le migration sono additive, ma alcune tabelle vecchie potrebbero richiedere data migration manuale.
2. Le RPC includono versioni base funzionanti. In produzione conviene raffinare calcolo punteggi in base alle regole complete per competizione.
3. Le pagine superadmin sono scaffold puliti con TODO UI, mentre le RPC e lo schema sono predisposti.
4. Se esistono dati in `matchday_articles`, vanno migrati manualmente in `nyx_content` prima di eventuale drop.
5. Prima di fare drop reali, verificare che nessun file importi più vecchie logiche.

## Check eseguiti

- `tsc --noEmit` eseguito con successo dopo rimozione della vecchia `.next` generata.
- `next build` non è stato completabile nell'ambiente sandbox perché Next ha tentato di scaricare il pacchetto SWC e npm ha bloccato l'accesso alla registry.
