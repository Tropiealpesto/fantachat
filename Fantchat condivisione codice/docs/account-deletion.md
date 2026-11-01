# FantaChat Cancellazione account - bozza operativa

Aggiornata: 2026-07-02

Questa bozza e' la base pubblicata nell'app in `/cancellazione-account`.

## Procedura attuale

L'utente invia una richiesta dall'email associata all'account a `[DA COMPLETARE: email privacy]`.

La richiesta dovrebbe indicare:

- volonta di cancellare l'account;
- email dell'account;
- eventuale nome squadra o lega collegata.

Non deve contenere password o dati sensibili non necessari.

## Cosa fare lato operativo

- Verificare che la richiesta arrivi dall'email dell'account.
- Eliminare o anonimizzare dati identificativi dove tecnicamente possibile.
- Valutare quali dati di lega/classifica conservare in forma aggregata o anonimizzata per non rompere lo storico della competizione.
- Confermare all'utente la chiusura della richiesta.

## Da completare prima del lancio

- Email privacy ufficiale.
- SLA operativo, ad esempio gestione entro 30 giorni salvo eccezioni.
- Procedura tecnica interna per cancellazione/anonymizzazione.
- Eventuale pulsante in-app per richiesta guidata.
- Log interno delle richieste evase, nel rispetto del principio di minimizzazione.

## Stato

Implementata pagina pubblica e link da login/menu laterale. Procedura ancora manuale e da formalizzare.
