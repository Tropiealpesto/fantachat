# Sportmonks automation

## Flusso deciso

- Catalogo manuale: squadre, giocatori, allenatori, foto e calendario si importano quando il superadmin apre una nuova competizione o quando serve aggiornare il mercato.
- Probabili formazioni automatiche: il cron aggiorna le prossime partite ogni 30 minuti.
- Live automatico: il cron aggiorna le partite vicine/live ogni 2 minuti.
- Post partita automatico: il cron aggiorna le partite recenti ogni 15 minuti.
- Ricalcolo FantaChat: dopo ogni sync statistiche, lo script ricalcola le leghe attive collegate alla competizione/stagione.

## Endpoint Vercel

- `/api/cron/sportmonks-expected-lineups`
- `/api/cron/sportmonks-live`
- `/api/cron/sportmonks-post-match`

Gli endpoint richiedono `CRON_SECRET` e accettano solo richieste con:

```text
Authorization: Bearer <CRON_SECRET>
```

## Variabili ambiente richieste

- `SPORTMONKS_API_TOKEN`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

## Comandi manuali

```bash
npm run sportmonks:sync -- --catalog
npm run sportmonks:sync -- --fixtures
npm run sportmonks:sync -- --expected-lineups
npm run sportmonks:sync -- --stats
```
