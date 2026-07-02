import LegalPage, { type LegalSection } from "../components/LegalPage";

const sections: LegalSection[] = [
  {
    title: "Chi tratta i dati",
    body: [
      "Il titolare del trattamento e' [DA COMPLETARE: nome o societa titolare di FantaChat]. Per richieste privacy puoi scrivere a [DA COMPLETARE: email privacy].",
      "Questa pagina descrive il trattamento dei dati degli utenti che usano FantaChat per partecipare a leghe fantasy, inviare formazioni, consultare classifiche e usare la chat di lega.",
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
      "Le basi giuridiche principali sono l'esecuzione del servizio richiesto dall'utente, l'interesse legittimo alla sicurezza e al miglioramento tecnico, e gli eventuali obblighi di legge applicabili.",
    ],
  },
  {
    title: "Condivisione e fornitori",
    body: [
      "I dati possono essere trattati da fornitori tecnici che aiutano a erogare FantaChat, ad esempio servizi di autenticazione, database, hosting, log e manutenzione.",
      "Prima del lancio pubblico vanno indicati in modo preciso i fornitori effettivi, i relativi ruoli privacy e l'eventuale trasferimento di dati fuori dallo Spazio Economico Europeo.",
    ],
  },
  {
    title: "Conservazione",
    body: [
      "Conserviamo i dati dell'account finche l'account resta attivo o finche sono necessari per gestire leghe, classifiche, sicurezza e richieste dell'utente.",
      "Alcuni dati sportivi o di classifica possono essere conservati in forma aggregata o anonimizzata per mantenere la coerenza storica delle competizioni. I tempi precisi di conservazione vanno definiti prima del lancio pubblico.",
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
      "FantaChat non e' pensata per raccogliere consapevolmente dati di bambini. Prima della distribuzione pubblica va definita una soglia di eta e una procedura coerente con il mercato di rilascio.",
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
      updated="2 luglio 2026"
      intro="Questa e' una base operativa per rendere FantaChat piu trasparente prima della beta. Deve essere completata con i dati reali del titolare, dei fornitori e dei tempi di conservazione."
      note="Nota: questo testo non sostituisce una revisione legale. Prima del lancio pubblico va validato con i dati definitivi del progetto."
      sections={sections}
    />
  );
}
