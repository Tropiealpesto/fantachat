# FantaChat Beta Chiusa

Stato: pronta per esecuzione.

Obiettivo: provare FantaChat con utenti veri, su telefoni veri, in leghe reali o semi-reali, prima di aprire il prodotto a molte persone.

## Principio

La beta non serve a dimostrare che l'app e' bella. Serve a scoprire dove si rompe, dove non si capisce, dove i dati non tornano e quali passaggi fanno perdere fiducia.

## Dimensione beta

### Fase A - 10/20 utenti

Durata consigliata: 3-5 giorni.

Profilo:

- amici o utenti molto disponibili;
- almeno 2 admin lega;
- almeno 2 dispositivi iPhone;
- almeno 2 dispositivi Android;
- almeno 1 utente poco tecnico.

Obiettivo:

- validare accesso, ingresso in lega, invio formazione, chat, classifica e live;
- raccogliere problemi grossi;
- capire se l'interfaccia viene capita senza spiegazioni.

### Fase B - 50/100 utenti

Durata consigliata: 7-14 giorni.

Profilo:

- 5-10 leghe;
- 5-12 utenti per lega;
- piu admin;
- utenti non seguiti uno a uno.

Obiettivo:

- misurare stabilita;
- vedere se i flussi reggono senza assistenza costante;
- raccogliere bug di dispositivi/browser;
- testare carico reale su chat, classifiche, rosa e live.

## Requisiti prima di invitare

Gia completati baseline:

- sicurezza Supabase verificata;
- RPC anon chiuse;
- indici performance applicati;
- test dati realistici baseline fatto;
- build e lint senza errori;
- privacy/termini/cancellazione account presenti;
- snapshot recovery applicativi testati.

Da non dimenticare prima della Fase B:

- completare dati reali privacy: titolare, email privacy, fornitori, retention;
- verificare piano Supabase per backup automatici e point-in-time recovery;
- decidere canale ufficiale feedback, per esempio WhatsApp, Google Form o email;
- preparare 1 messaggio di onboarding unico da inviare a tutti.

## Setup beta

Per ogni lega beta:

1. creare lega da app;
2. salvare codice invito;
3. aggiungere almeno 4 utenti;
4. aprire o confermare giornata attiva;
5. far caricare formazione a tutti;
6. simulare o importare voti;
7. verificare classifica e live.

## Script test per utenti

Da chiedere ai tester:

1. Registrati con email e password.
2. Entra nella lega con il codice invito.
3. Personalizza nome squadra se necessario.
4. Apri Home e controlla che capisci posizione, giornata e classifica.
5. Vai in Rosa e carica la formazione.
6. Scrivi un messaggio in Chat.
7. Apri Live e Classifica.
8. Chiudi e riapri l'app dal telefono.
9. Se puoi, aggiungi FantaChat alla schermata Home.
10. Scrivi cosa non hai capito o cosa ti sembra poco affidabile.

## Messaggio onboarding tester

Ciao! Ti sto facendo provare FantaChat in beta chiusa.

Link app: [INSERIRE LINK]

Codice lega: [INSERIRE CODICE]

Cose da fare:

- registrati con email e password;
- entra nella lega con il codice;
- carica la formazione;
- scrivi un messaggio in chat;
- guarda Home, Live e Classifica;
- dimmi subito se qualcosa non e' chiaro o non funziona.

Importante: e' una beta, quindi potrebbero esserci bug. Mi interessano soprattutto problemi reali, schermate confuse, dati che non tornano e passaggi in cui ti blocchi.

## Raccolta feedback

Campi minimi:

- nome tester;
- telefono/browser;
- email account usata;
- lega;
- cosa stavi facendo;
- cosa e' successo;
- screenshot o video;
- quanto e' grave da 1 a 5;
- si ripete sempre o e' successo una volta sola.

## Severita bug

### P0 - blocca la beta

- login impossibile per molti utenti;
- impossibile entrare in lega;
- impossibile inviare formazione;
- classifiche o punteggi palesemente corrotti;
- perdita dati;
- accesso non autorizzato a dati di altre leghe.

Azioni:

- fermare nuovi inviti;
- creare snapshot se riguarda dati giornata;
- correggere subito;
- verificare con smoke test.

### P1 - molto grave

- una pagina principale non carica;
- chat inutilizzabile;
- live/classifica non coerenti;
- errore frequente su mobile specifico.

Azioni:

- correggere prima della fase successiva;
- non allargare beta finche non e' verificato.

### P2 - fastidioso

- copy poco chiaro;
- layout storto;
- stato loading brutto;
- comportamento non intuitivo ma aggirabile.

Azioni:

- segnare;
- sistemare se si ripete spesso.

### P3 - miglioramento

- preferenze estetiche;
- piccole animazioni;
- funzioni desiderate ma non necessarie.

Azioni:

- backlog post-beta.

## Metriche da guardare

### Prodotto

- percentuale utenti invitati che completano registrazione;
- percentuale utenti registrati che entrano in lega;
- percentuale utenti in lega che caricano formazione;
- numero medio messaggi chat per lega;
- quante volte gli utenti chiedono "cosa devo fare ora?";
- quanti bug bloccanti per giornata.

### Tecniche

- errori Supabase;
- query lente;
- pagine che non caricano;
- fallimenti RPC;
- utenti senza `active_league_id` o `active_league_competition_id`;
- lineup incomplete.

## Query controllo beta

### Utenti e leghe

```sql
select count(*) as league_members
from public.league_members;

select l.name, count(lm.user_id) as members
from public.leagues l
left join public.league_members lm on lm.league_id = l.id
group by l.id, l.name
order by members desc, l.name;
```

### Formazioni caricate

```sql
select
  lc.name as competition,
  md.number as matchday,
  count(distinct lcm.user_id) as members,
  count(distinct li.user_id) as submitted_lineups
from public.league_competitions lc
join public.matchdays md on md.season_id = lc.season_id
join public.league_competition_members lcm on lcm.league_competition_id = lc.id
left join public.lineups li
  on li.league_competition_id = lc.id
 and li.matchday_id = md.id
 and li.user_id = lcm.user_id
where lc.status = 'active'
group by lc.id, lc.name, md.id, md.number
order by lc.name, md.number;
```

### Utenti senza contesto attivo

```sql
select uc.user_id, uc.active_league_id, uc.active_league_competition_id
from public.user_context uc
where uc.active_league_id is null
   or uc.active_league_competition_id is null;
```

### Chat

```sql
select l.name, count(m.id) as messages
from public.leagues l
left join public.messages m on m.league_id = l.id
group by l.id, l.name
order by messages desc, l.name;
```

### Snapshot recovery disponibili

```sql
select league_competition_id, matchday_id, reason, restored_at, created_at
from public.recovery_snapshots
order by created_at desc
limit 20;
```

## Ritmo operativo

Durante beta:

- controllare feedback ogni giorno;
- classificare bug P0/P1/P2/P3;
- fare fix piccoli e verificabili;
- evitare grandi redesign durante la beta;
- segnare ogni problema ricorrente;
- chiudere ogni giornata con check classifica e lineup.

## Criteri per passare oltre

La beta puo allargarsi o chiudersi positivamente se:

- nessun P0 aperto;
- nessun P1 aperto sui flussi principali;
- almeno 90% degli utenti riesce a entrare in lega;
- almeno 85% degli utenti riesce a caricare formazione senza aiuto diretto;
- Home, Rosa, Live, Classifica e Chat vengono capite;
- recovery snapshot e backup platform sono chiari;
- privacy/termini sono completati con dati reali.

## Cose da non fare durante beta

- cambiare regole core senza avvisare;
- cancellare dati reali senza snapshot;
- invitare troppe persone se i primi tester si bloccano;
- aggiungere funzioni grandi come allenatore/regole speciali mentre si misura stabilita;
- confondere bug con richieste future.

## Esito atteso

Alla fine della beta deve esistere:

- lista bug chiusi;
- lista bug aperti;
- lista miglioramenti non bloccanti;
- decisione chiara: allargare beta, ripetere beta o preparare lancio.

