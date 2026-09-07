# FantaChat - Piano Play Store

## Stato attuale

FantaChat e' una PWA Next.js gia' pubblicata su Vercel. La strada Android piu' rapida e sensata e' una Trusted Web Activity: l'app Play Store apre la web app fullscreen, mantenendo aggiornamenti e correzioni sul deploy Vercel.

Gia' presente:

- manifest PWA in `public/manifest.json`
- service worker in `public/sw.js`
- icone `192`, `512`, `1024`
- privacy policy e termini
- notifiche web push lato app

Da completare:

- pacchetto Android `.aab`
- collegamento Digital Asset Links tra app Android e dominio
- scheda Play Store
- Data Safety
- test interno su Android reale

## Decisioni consigliate

- Tipo app: Trusted Web Activity.
- Nome store: FantaChat.
- Package name consigliato: `app.fantachat`.
- Orientamento: portrait.
- Tema: bianco, verde FantaChat, arancione.
- Notifiche: abilitate nel pacchetto Android.
- Aggiornamenti futuri: si modificano normalmente web app e Supabase; per cambiamenti solo web basta deploy Vercel, per cambiamenti nativi serve nuovo `.aab`.

## Prima build Android

Azioni Codex:

1. Generare progetto Android/TWA con Bubblewrap.
2. Usare il manifest live: `https://fantachat-app.vercel.app/manifest.json`.
3. Impostare nome, icone, tema, start URL e fullscreen.
4. Abilitare notification delegation.
5. Generare upload key e salvarla in modo sicuro.
6. Produrre `app-release-bundle.aab`.

Azioni Pietro:

1. Creare app in Google Play Console.
2. Caricare il file `.aab` in Internal testing.
3. Attivare Play App Signing.
4. Recuperare il fingerprint SHA-256 da Play Console.

## Digital Asset Links

Dopo il primo caricamento su Play Console bisogna creare:

`public/.well-known/assetlinks.json`

Serve il fingerprint SHA-256 della chiave di firma app mostrata in Play Console. Senza questo collegamento l'app puo' aprirsi come browser/custom tab invece che fullscreen.

## Test interno

Da verificare su almeno un telefono Android:

- apertura fullscreen senza barra browser
- login e registrazione
- ingresso con codice lega
- home
- rosa e salvataggio formazione
- chat
- live
- classifica
- statistiche
- notifiche: richiesta permesso, notifica test, click sulla notifica

## Play Console

Materiali necessari:

- icona app 512x512
- feature graphic 1024x500
- screenshot telefono
- descrizione breve
- descrizione completa
- privacy policy URL
- termini URL
- email contatto: `fantachat.app.2026@gmail.com`

## Data Safety

Dati da dichiarare con attenzione:

- email dell'utente, per autenticazione account
- identificatore utente Supabase, per gestione account e leghe
- contenuti generati dall'utente, per messaggi chat e nomi squadra
- dati di utilizzo/app activity solo se tracciati o necessari per notifiche/log tecnici

Da indicare:

- dati trasmessi su connessione sicura
- possibilita' di cancellazione account
- privacy policy pubblica

## Cose da non bloccare

Le ultime piccole correzioni di giornata possono essere fatte prima della release pubblica, ma non bloccano la preparazione tecnica del pacchetto Android.

## Prossimo step operativo

Quando Pietro conferma, Codex puo' creare il progetto Android/TWA e generare il primo `.aab` di test.
