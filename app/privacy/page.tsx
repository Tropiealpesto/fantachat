import LegalPage, { type LegalSection } from "../components/LegalPage";

const sections: LegalSection[] = [
  {
    title: "Chi tratta i dati",
    body: [
      "FantaChat tratta i dati personali necessari a erogare il servizio fantasy/social calcistico. Il gestore del servizio determina finalita e mezzi del trattamento e agisce come titolare del trattamento.",
      "Per richieste privacy, accesso ai dati o cancellazione dell'account puoi usare il canale di contatto ufficiale indicato dal gestore dell'app o la pagina Cancellazione account.",
      "Questa informativa spiega quali dati usiamo quando crei un account, partecipi a una lega, invii formazioni, consulti classifiche o usi la chat di lega.",
    ],
  },
  {
    title: "Dati raccolti",
    body: [
      "Raccogliamo i dati necessari a far funzionare l'app: email, identificativo utente, dati di autenticazione gestiti dal provider, nome squadra, appartenenza alle leghe, formazioni, punteggi, classifiche, messaggi chat e preferenze essenziali dell'account.",
      "La password non viene salvata in chiaro da FantaChat. L'autenticazione e' gestita tramite il provider tecnico configurato per l'app.",
      "Possiamo trattare anche dati tecnici minimi, come log di accesso, errori applicativi e informazioni necessarie alla sicurezza e alla stabilita del servizio.",
    ],
  },
  {
    title: "Perche usiamo i dati",
    body: [
      "Usiamo i dati per creare e gestire l'account, permettere l'accesso alle leghe, salvare la formazione, calcolare risultati e classifiche, mostrare la chat di lega e proteggere il servizio da abusi o accessi non autorizzati.",
      "Le basi giuridiche principali sono l'esecuzione del servizio richiesto dall'utente, l'interesse legittimo alla sicurezza e al corretto funzionamento tecnico, e gli eventuali obblighi di legge applicabili.",
      "Non vendiamo i dati personali degli utenti e non usiamo la chat o le formazioni per profilazione pubblicitaria.",
    ],
  },
  {
    title: "Condivisione e fornitori",
    body: [
      "I dati possono essere trattati da fornitori tecnici che aiutano a erogare FantaChat, ad esempio servizi di autenticazione, database, hosting, log tecnici e manutenzione.",
      "I fornitori trattano i dati solo per finalita tecniche collegate al servizio. Se alcuni fornitori trattano dati fuori dallo Spazio Economico Europeo, il trasferimento deve avvenire con garanzie adeguate previste dalla normativa applicabile.",
      "I dati di lega, classifica e chat possono essere visibili agli altri partecipanti della stessa lega nei limiti necessari al funzionamento dell'app.",
    ],
  },
  {
    title: "Conservazione",
    body: [
      "Conserviamo i dati dell'account finche l'account resta attivo o finche sono necessari per gestire leghe, classifiche, sicurezza e richieste dell'utente.",
      "Messaggi, formazioni e risultati possono restare associati alla lega per mantenere la coerenza storica della competizione. Quando possibile, in caso di cancellazione account, i dati vengono eliminati, anonimizzati o dissociati dall'utente.",
      "I log tecnici e di sicurezza vengono conservati per il tempo necessario a proteggere il servizio, risolvere errori e rispettare eventuali obblighi di legge.",
    ],
  },
  {
    title: "Diritti dell'utente",
    body: [
      "Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilita e opposizione nei casi previsti dalla normativa applicabile.",
      "Puoi inoltre proporre reclamo all'autorita competente per la protezione dei dati personali. In Italia il riferimento e' il Garante per la protezione dei dati personali.",
    ],
  },
  {
    title: "Minori",
    body: [
      "FantaChat non e' pensata per bambini. Se il servizio viene usato da minorenni, l'uso deve avvenire nel rispetto delle regole applicabili e, quando richiesto, con il consenso o la supervisione di chi esercita la responsabilita genitoriale.",
    ],
  },
  {
    title: "Modifiche",
    body: [
      "Questa informativa puo essere aggiornata quando cambiano funzioni, fornitori, basi giuridiche o modalita di trattamento. La data di aggiornamento indica l'ultima revisione pubblicata.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Documento privacy"
      title="Privacy Policy"
      updated="15 luglio 2026"
      intro="Questa informativa descrive in modo semplice come FantaChat raccoglie e usa i dati personali necessari al funzionamento dell'app."
      note="Nota: il testo e' una base operativa per la beta e va verificato con i dati ufficiali del gestore prima della pubblicazione definitiva."
      sections={sections}
    />
  );
}
