# FantaChat Cancellazione account - procedura operativa

Aggiornata: 2026-07-02

La pagina pubblicata nell'app è `/cancellazione-account`.

## Procedura attuale

L'utente autenticato può avviare la cancellazione direttamente dalla pagina in-app. Il pulsante chiama l'endpoint autenticato `/api/account/delete`; non è necessario inviare password o dati sensibili via email.

La richiesta dovrebbe indicare:

Per chi non riesce ad accedere resta disponibile il contatto ufficiale `fantachat.app.2026@gmail.com` per una verifica manuale.

## Cosa fare lato operativo

- L'endpoint verifica il token Supabase e opera solo sull'utente autenticato.
- I dati personali applicativi vengono eliminati; i messaggi vengono anonimizzati per preservare la storia della lega.
- Le righe dipendenti dall'utente vengono rimosse tramite le relazioni cascade di Supabase.
- In caso di errore tecnico l'utente riceve un messaggio e può contattare il canale privacy.

## Da completare prima del lancio

- Verificare in ambiente Supabase di produzione la migration `048_chat_moderation_and_message_guards.sql` e il funzionamento dell'endpoint con un account di test.
- Confermare titolare, fornitori, retention e canale privacy nella documentazione pubblica.

## Stato

Pagina pubblica, pulsante in-app ed endpoint implementati. La procedura manuale resta solo come fallback per gli utenti che non riescono ad autenticarsi.
