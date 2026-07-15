import LegalPage, { type LegalSection } from "../components/LegalPage";

const sections: LegalSection[] = [
  {
    title: "Oggetto del servizio",
    body: [
      "FantaChat e' una fantasy/social app calcistica che permette agli utenti di creare o partecipare a leghe, scegliere giocatori, inviare formazioni, consultare punteggi, classifiche e comunicare nella chat di lega.",
      "Il servizio e' pensato per intrattenimento, organizzazione e gestione privata delle competizioni tra utenti. Non e' una piattaforma di scommesse e non gestisce denaro o premi in denaro.",
    ],
  },
  {
    title: "Account",
    body: [
      "Per usare FantaChat devi creare un account con email e password o accedere tramite i metodi disponibili. Sei responsabile della sicurezza delle credenziali e delle attivita svolte dal tuo account.",
      "Puoi chiedere la cancellazione dell'account seguendo la procedura indicata nella pagina dedicata.",
    ],
  },
  {
    title: "Leghe e competizioni",
    body: [
      "Le regole di ogni competizione possono dipendere dalla configurazione scelta dall'amministratore di lega: ruoli, giornate, vincoli di formazione, punteggi e bonus.",
      "Gli amministratori di lega devono usare gli strumenti disponibili in modo corretto e trasparente verso gli altri partecipanti.",
      "Le competizioni create dagli utenti sono responsabilita degli utenti che le amministrano. FantaChat puo intervenire in caso di abuso tecnico, uso scorretto o violazione di questi termini.",
    ],
  },
  {
    title: "Chat e contenuti",
    body: [
      "La chat serve alla comunicazione interna della lega. Non sono ammessi contenuti offensivi, discriminatori, illegali, minacciosi, spam o contenuti che violino diritti di terzi.",
      "FantaChat puo rimuovere contenuti o limitare account in caso di uso scorretto, abuso tecnico o violazione di questi termini.",
    ],
  },
  {
    title: "Punteggi e dati sportivi",
    body: [
      "Punteggi, statistiche e risultati dipendono dalle fonti dati, dalle regole configurate e dai calcoli applicativi. Possono essere corretti in caso di errori, aggiornamenti o rettifiche della fonte.",
      "L'app puo mostrare dati provvisori durante una giornata e dati finali dopo ricalcolo o chiusura amministrativa.",
    ],
  },
  {
    title: "Disponibilita del servizio",
    body: [
      "Facciamo il possibile per mantenere FantaChat stabile e accessibile, ma il servizio puo subire interruzioni, manutenzioni, bug o limitazioni tecniche.",
      "Funzioni, grafica e regole possono evolvere nel tempo per migliorare qualita, sicurezza e prestazioni.",
    ],
  },
  {
    title: "Responsabilita",
    body: [
      "FantaChat non e' responsabile per accordi privati, premi o decisioni economiche prese dagli utenti fuori dall'app.",
      "L'app viene fornita per finalita di intrattenimento e gestione sportiva fantasy. Nei limiti consentiti dalla legge, FantaChat non risponde di danni indiretti, perdita di dati dovuta a cause esterne, interruzioni temporanee o decisioni prese dagli utenti sulla base di dati provvisori.",
      "Nulla in questi termini limita i diritti inderogabili riconosciuti agli utenti dalla normativa applicabile.",
    ],
  },
  {
    title: "Sospensione e chiusura account",
    body: [
      "FantaChat puo sospendere o limitare l'accesso in caso di violazione dei termini, abuso tecnico, tentativi di accesso non autorizzato, spam, contenuti illeciti o comportamenti che danneggiano altri utenti.",
      "L'utente puo chiedere la cancellazione dell'account seguendo la procedura indicata nella pagina dedicata.",
    ],
  },
  {
    title: "Modifiche ai termini",
    body: [
      "I termini possono essere aggiornati quando cambiano il servizio, le funzioni o le esigenze legali. L'uso dell'app dopo un aggiornamento implica accettazione dei termini aggiornati, nei limiti consentiti dalla legge.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Regole del servizio"
      title="Termini di utilizzo"
      updated="15 luglio 2026"
      intro="Questi termini definiscono le regole principali per usare FantaChat, partecipare alle leghe e interagire con gli altri utenti."
      note="FantaChat e' una fantasy/social app: non gestisce scommesse e non garantisce premi in denaro."
      sections={sections}
    />
  );
}
