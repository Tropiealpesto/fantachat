import LegalPage, { type LegalSection } from "../components/LegalPage";

const sections: LegalSection[] = [
  {
    title: "Come richiederla",
    body: [
      "Per chiedere la cancellazione dell'account usa il canale di contatto ufficiale indicato dal gestore dell'app o invia una richiesta dall'indirizzo email associato al tuo account FantaChat.",
      "Nella richiesta indica che vuoi cancellare l'account e, se possibile, il nome della lega o della squadra collegata. Non inviare password o dati sensibili non necessari.",
    ],
  },
  {
    title: "Verifica identita",
    body: [
      "Per proteggere l'account, la richiesta deve arrivare dalla stessa email usata per registrarsi. Se servono verifiche aggiuntive, ti verra chiesto solo il minimo necessario.",
    ],
  },
  {
    title: "Cosa viene cancellato",
    body: [
      "La cancellazione riguarda account, dati identificativi collegati, preferenze personali e contenuti associati quando tecnicamente possibile e nei limiti previsti dalla legge.",
      "Messaggi, classifiche, formazioni o dati di competizione potrebbero essere anonimizzati o conservati in forma non direttamente identificativa se servono a mantenere integra la storia della lega.",
    ],
  },
  {
    title: "Tempi",
    body: [
      "La richiesta viene presa in carico il prima possibile e normalmente entro 30 giorni, salvo necessita tecniche, richieste particolarmente complesse o obblighi di legge.",
    ],
  },
  {
    title: "Cosa succede dopo",
    body: [
      "Dopo la cancellazione potresti non poter piu accedere alle leghe, alle chat, alle formazioni e allo storico personale. Alcuni dati aggregati della competizione possono restare visibili senza riferimento diretto all'account cancellato.",
    ],
  },
  {
    title: "Richieste alternative",
    body: [
      "Se non vuoi cancellare tutto, puoi chiedere rettifica, accesso o limitazione del trattamento scrivendo allo stesso contatto privacy.",
    ],
  },
];

export default function AccountDeletionPage() {
  return (
    <LegalPage
      eyebrow="Gestione account"
      title="Cancellazione account"
      updated="15 luglio 2026"
      intro="Questa pagina spiega come richiedere la cancellazione dell'account FantaChat e cosa aspettarsi durante la procedura."
      note="La procedura manuale e' adatta alla beta. Per un lancio pubblico e' consigliabile aggiungere anche un flusso in-app guidato."
      sections={sections}
    />
  );
}
