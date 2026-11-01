# FantaChat - Audit totale app

Data: 2026-09-07

## Esito rapido

L'app compila correttamente e la struttura principale e' coerente: login, scelta lega, home, rosa, live, chat, classifica, statistiche, storico, regole e pannelli admin/superadmin.

Non emergono blocchi tecnici da build. I rischi principali prima di Play Store sono di esperienza utente, coerenza visiva e operativita' dati.

Verifiche eseguite:

- `npm run lint`: ok
- `npm run build`: ok

## Interventi applicati dopo audit

- Bottom nav di Chat e Live portato su una variante a filo schermo.
- Errori principali lato utente normalizzati con messaggi piu' comprensibili.
- Residui Nyx/podcast rimossi dall'esperienza applicativa; i vecchi URL restano solo redirect verso Home/Admin.
- Notifiche rese piu' robuste: se il permesso e' gia' concesso, l'app registra comunque la sottoscrizione su Supabase.
- Test notifiche reso piu' severo: se non invia nulla, restituisce errore.
- Home e Live preparate a usare id stabili per agganciare le foto giocatore.
- Aggiunta migration `045_core_rpc_player_image_ids.sql`.

## Filo logico utente

Percorso atteso:

1. L'utente accede o crea un account.
2. Sceglie una lega o entra con codice invito.
3. Entra in home e vede competizione attiva, classifica, slot, recap, rosa, statistiche e regole.
4. Va in Rosa per preparare o inviare la formazione.
5. Segue Live, Chat e Classifica durante la giornata.
6. A giornata chiusa consulta Storico e Statistiche.

Il filo e' buono. La home e' diventata il centro corretto dell'app: mostra stato giornata, classifica, recap e accessi rapidi. La Rosa e' corretta come pagina operativa. Le Statistiche hanno senso come area di approfondimento collegata dalla Rosa.

## Punti forti

- Identita' visiva riconoscibile: verde, arancione, bianco, logo e tono sportivo.
- Home molto piu' utile rispetto alle prime versioni: slot, classifica, recap e schieramento stanno insieme.
- Rosa ormai segue bene la logica reale del gioco: vincoli, top squadre, partite, bozza e invio bloccato.
- Chat ha una buona idea prodotto: messaggi, citazioni giocatori e card formazione con accesso al live.
- Statistiche e dettaglio giocatore sono diventati una parte forte dell'app, soprattutto con breakdown giornata.
- Admin/superadmin sono separati in modo piu' sano: l'admin gestisce la lega, il superadmin gestisce calendario, dati e giornate globali.
- Notifiche web push presenti e integrate.

## Problemi principali da sistemare

### 1. Bottom nav su Chat e Live

Chat e Live usano `BottomNav` con `withSpacer={false}` e calcolano lo spazio a mano. Questo e' diverso dalle altre pagine e spiega perche' il menu sembra troppo alto solo li.

Priorita': alta.

Soluzione consigliata: uniformare il layout delle pagine a schermo intero con una classe unica per pagine fixed, usando sempre gli stessi valori `--nav-h`, `--nav-safe-bottom` e `--safe-bottom`.

### 2. Cron Vercel non pianificati

Gli endpoint cron esistono:

- `/api/cron/sportmonks-live`
- `/api/cron/sportmonks-expected-lineups`
- `/api/cron/sportmonks-post-match`

Pero' `vercel.json` non contiene ancora la sezione `crons`, quindi Vercel non li mostra come job schedulati.

Priorita': media-alta.

Nota operativa: con piano Hobby Vercel permette cron solo una volta al giorno. Per sync frequenti servono Pro, un altro scheduler, oppure uso manuale del bottone superadmin.

### 3. Errori tecnici mostrati agli utenti

In diverse pagine viene mostrato direttamente `error.message` da Supabase o dalle API. Esempi di rischio:

- `permission denied for function ...`
- `record ... is not assigned yet`
- messaggi tecnici Sportmonks

Priorita': alta per app pubblica.

Soluzione consigliata: creare una funzione unica `humanError()` che traduce gli errori tecnici in messaggi chiari, mantenendo il dettaglio tecnico solo in console o pannello superadmin.

### 4. Residui Nyx/podcast

La home ha ancora testi nascosti riferiti a Nyx e alla puntata. Non sono visibili, ma sono residui da pulire.

Priorita': bassa, ma da fare prima dello store per ordine.

### 5. Statistiche collegate a Rosa ma non nel bottom nav

La pagina Statistiche evidenzia `Rosa` nel bottom nav. Come scelta di prodotto puo' andare bene, perche' Statistiche e' una sotto-area della Rosa, ma bisogna renderlo chiaro con un rimando molto bello e stabile nella Rosa.

Priorita': media.

Decisione consigliata: non aggiungere una sesta voce nel bottom nav. Tenere Statistiche dentro Rosa.

### 6. Immagini giocatori

Il codice prova a usare `image_url` dei giocatori e, se manca, il logo della squadra. Se in app non compaiono ancora le foto, il problema piu' probabile e' uno di questi:

- `image_url` non popolato nel database per quei giocatori.
- URL Sportmonks non raggiungibile o non valido.
- RLS/policy Supabase impedisce la lettura diretta delle colonne immagine in alcune query.
- alcune RPC restituiscono dati senza `image_url`, poi il fallback lato client non riesce a completare.

Priorita': media-alta, perche' le foto aumentano molto la qualita' percepita.

### 7. Encoding/testi

Ci sono alcuni testi senza accenti o con caratteri sporchi in vecchie parti del codice/documentazione. Non bloccano, ma vanno ripuliti per una app pubblica.

Priorita': media.

## Coerenza visiva

Coerenti:

- Home
- Rosa
- Statistiche
- Storico
- Regole
- Admin home

Da uniformare:

- Chat e Live per layout bottom nav.
- Crea lega e selezione lega, che sono funzionali ma un po' meno allineate alle ultime schermate piu' raffinate.
- Superadmin va bene come strumento interno, quindi non serve renderlo perfetto.

## Coerenza prodotto

Il modello e' chiaro:

- FantaChat non e' solo fantasy calcio, ma fantasy con scelta strategica, chat e statistiche.
- L'admin non deve seguire ogni partita: imposta la lega e controlla gli errori.
- Il superadmin governa calendario, giornate, dati Sportmonks e calcolo globale.

Questa e' una buona direzione per utenti non tecnici.

## Bug/rischi da controllare con test reale

1. Utente nuovo crea account, riceve mail, entra.
2. Utente invitato entra con codice.
3. Admin crea lega e aggiunge competizione.
4. Admin vede tutti i membri nel wizard competizione.
5. Superadmin apre giornata e gli slot sono corretti.
6. Utente prima del suo slot salva bozza.
7. Utente durante il suo slot invia formazione.
8. Utente dopo invio non puo' piu' modificarla.
9. Giocatori gia' presi spariscono dalle scelte successive.
10. Chat riceve messaggi e mostra pallino rosso fuori dalla chat.
11. Notifiche su Android Samsung compaiono per utenti non superadmin.
12. Storico giornata chiusa mostra righe e dettaglio.
13. Scheda giocatore mostra storico giornate e breakdown punti.
14. Bottone superadmin "Aggiorna dati live" aggiorna senza errori visibili inutili.

## Ordine consigliato prima Play Store

1. Sistemare definitivamente bottom nav di Chat e Live.
2. Aggiungere normalizzazione messaggi errore.
3. Pulire residui Nyx/podcast nascosti.
4. Verificare immagini giocatori con query dati reali.
5. Decidere strategia sync: Pro Vercel, scheduler esterno o solo bottone superadmin.
6. Fare smoke test con almeno due telefoni Android non admin.
7. Creare pacchetto Android TWA e test interno Play Console.

## Giudizio finale

FantaChat e' tecnicamente pronta per una fase pubblica controllata e per iniziare la preparazione Android. Non la considererei ancora "store-ready" al 100% finche' Chat/Live non hanno il bottom nav definitivo, gli errori tecnici non sono tradotti e le immagini giocatori non sono verificate su dati reali.
