import LegalPage, { type LegalSection } from "../components/LegalPage";

const sections: LegalSection[] = [
  {
    title: "Chi tratta i dati",
    body: [
      "Il titolare del progetto FantaChat è Pietro Parodi. Per richieste relative ai dati personali, accesso, rettifica o cancellazione puoi scrivere a fantachat.app.2026@gmail.com oppure usare la pagina Cancellazione account.",
      "Questa informativa spiega quali dati usiamo quando crei un account, partecipi a una lega, invii formazioni, consulti classifiche o usi la chat di lega.",
    ],
  },
  {
    title: "Dati raccolti",
    body: [
      "Raccogliamo i dati necessari a far funzionare l'app: email, identificativo utente, dati di autenticazione gestiti dal provider, nome squadra, appartenenza alle leghe, formazioni, punteggi, classifiche, messaggi chat e preferenze essenziali dell'account.",
      "Se abiliti le notifiche, salviamo anche i dati tecnici della sottoscrizione push necessari a consegnarle al dispositivo. Puoi revocare il permesso dalle impostazioni del telefono e la sottoscrizione viene rimossa quando elimini l'account.",
      "La password non viene salvata in chiaro da FantaChat. L'autenticazione è gestita tramite il provider tecnico configurato per l'app.",
      "Possiamo trattare anche dati tecnici minimi, come log di accesso, errori applicativi e informazioni necessarie alla sicurezza e alla stabilità del servizio. Non usiamo strumenti di profilazione pubblicitaria nell'app.",
    ],
  },
  {
    title: "Perché usiamo i dati",
    body: [
      "Usiamo i dati per creare e gestire l'account, permettere l'accesso alle leghe, salvare la formazione, calcolare risultati e classifiche, mostrare la chat di lega e proteggere il servizio da abusi o accessi non autorizzati.",
      "Le basi giuridiche principali sono l'esecuzione del servizio richiesto dall'utente, l'interesse legittimo alla sicurezza e al corretto funzionamento tecnico, e gli eventuali obblighi di legge applicabili.",
      "Non vendiamo i dati personali degli utenti e non usiamo la chat o le formazioni per profilazione pubblicitaria.",
    ],
  },
  {
    title: "Condivisione e fornitori",
    body: [
      "I dati possono essere trattati da fornitori tecnici che aiutano a erogare FantaChat: Supabase per autenticazione e database, Vercel per hosting e distribuzione dell'app web, e il provider dei dati sportivi per le informazioni sulle partite e sui calciatori.",
      "I fornitori trattano i dati solo per finalità tecniche collegate al servizio. Se alcuni fornitori trattano dati fuori dallo Spazio Economico Europeo, il trasferimento deve avvenire con garanzie adeguate previste dalla normativa applicabile.",
      "I dati di lega, classifica e chat possono essere visibili agli altri partecipanti della stessa lega nei limiti necessari al funzionamento dell'app.",
    ],
  },
  {
    title: "Conservazione",
    body: [
      "Conserviamo i dati dell'account finché l'account resta attivo. Dopo la richiesta di cancellazione, i dati personali vengono rimossi secondo la procedura descritta nella pagina Cancellazione account.",
      "Messaggi, formazioni e risultati possono essere anonimizzati o dissociati dall'utente quando servono a mantenere la storia della lega e i risultati della competizione.",
      "I log tecnici e di sicurezza vengono conservati solo per il tempo necessario a proteggere il servizio, risolvere errori e rispettare eventuali obblighi di legge.",
    ],
  },
  {
    title: "Diritti dell'utente",
    body: [
      "Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità e opposizione nei casi previsti dalla normativa applicabile.",
      "Puoi inoltre proporre reclamo all'autorità competente per la protezione dei dati personali. In Italia il riferimento è il Garante per la protezione dei dati personali.",
    ],
  },
  {
    title: "Minori",
    body: [
      "FantaChat non è pensata per bambini. Se il servizio viene usato da minorenni, l'uso deve avvenire nel rispetto delle regole applicabili e, quando richiesto, con il consenso o la supervisione di chi esercita la responsabilità genitoriale.",
    ],
  },
  {
    title: "Modifiche",
    body: [
      "Questa informativa può essere aggiornata quando cambiano funzioni, fornitori, basi giuridiche o modalità di trattamento. La data di aggiornamento indica l'ultima revisione pubblicata.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Documento privacy"
      title="Privacy Policy"
      updated="15 novembre 2026"
      intro="Questa informativa descrive in modo semplice come FantaChat raccoglie e usa i dati personali necessari al funzionamento dell'app."
      note="Prima della pubblicazione sugli store, il titolare deve verificare e completare i dati identificativi obbligatori, come indirizzo e eventuale partita IVA, se applicabili."
      sections={sections}
    />
  );
}
