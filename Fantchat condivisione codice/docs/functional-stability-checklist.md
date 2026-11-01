# Functional Stability Checklist - Punto 4

Obiettivo: verificare che i flussi principali funzionino dopo hardening sicurezza, indici e dataset baseline.

## Stato tecnico

- `npm run build`: passato.
- `npm run lint`: passato senza errori.
- Warning lint residui: non bloccanti, da pulire prima della beta se resta tempo.

## Fix applicati

- `app/admin/podcast/page.tsx`: rimosso setState sincrono dentro effect.
- `app/storico/[id]/page.tsx`: apertura default della propria squadra derivata dal render, senza setState in effect.
- `app/superadmin/page.tsx`: sistemato ordine dichiarazione/caricamento competizioni.

## Smoke Test Player

- Login.
- Home carica.
- Classifica carica.
- Rosa carica giocatori e formazione.
- Invio formazione.
- Chat invia messaggio.
- Live carica.
- Storico carica lista e dettaglio giornata.
- Regole carica.
- Personalizza colori squadra.

## Smoke Test Admin Lega

- Admin carica.
- Aggiungi competizione apre catalogo.
- Giornata apre/chiude/finalizza solo se testabile senza rovinare dati reali.
- Podcast/Nyx carica giornata e genera prompt.
- Voti admin non deve causare crash anche se resta pagina secondaria.

## Smoke Test Superadmin

- Pagina `/superadmin` accessibile solo al superadmin.
- Lista competizioni carica.
- Voti giocatori: ricerca player e salvataggio statistiche.
- Top team: ricerca team e salvataggio.
- Partite: ricerca squadre e salvataggio fixture.

## Criteri di chiusura

- Build passato.
- Lint senza errori.
- Smoke test manuale player/admin/superadmin passato.
- Nessun crash o schermata bloccata.
- Warning residui tracciati come debito non bloccante.

## Esito

- Smoke test manuale passato.
- Punto 4 completato.

