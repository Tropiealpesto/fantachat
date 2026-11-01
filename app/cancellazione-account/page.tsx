"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LegalPage, { type LegalSection } from "../components/LegalPage";
import { supabase } from "../../lib/supabaseClient";
import { humanError } from "../../lib/humanError";

const sections: LegalSection[] = [
  {
    title: "Come richiederla",
    body: [
      "Se hai effettuato l'accesso, usa il pulsante in-app qui sopra. Se non riesci ad accedere, contatta fantachat.app.2026@gmail.com dall'indirizzo associato al tuo account.",
      "Non inviare password o dati sensibili non necessari.",
    ],
  },
  {
    title: "Verifica identità",
    body: [
      "La richiesta in-app è autorizzata dalla sessione autenticata. Per una richiesta manuale, il messaggio deve arrivare dalla stessa email usata per registrarsi; eventuali verifiche aggiuntive richiederanno solo il minimo necessario.",
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
      "La cancellazione in-app viene elaborata subito dopo la conferma. Le richieste manuali vengono prese in carico il prima possibile e normalmente entro 30 giorni, salvo necessità tecniche o obblighi di legge.",
    ],
  },
  {
    title: "Cosa succede dopo",
    body: [
      "Dopo la cancellazione potresti non poter più accedere alle leghe, alle chat, alle formazioni e allo storico personale. Alcuni dati aggregati della competizione possono restare visibili senza riferimento diretto all'account cancellato.",
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
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAccessToken(data.session?.access_token ?? null));
  }, []);

  async function deleteAccount() {
    if (!accessToken || busy) return;
    const confirmed = window.confirm("Vuoi eliminare definitivamente il tuo account e i dati personali collegati? L'operazione non può essere annullata.");
    if (!confirmed) return;

    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Non è stato possibile eliminare l'account.");
      await supabase.auth.signOut();
      router.replace("/login?deleted=1");
    } catch (error) {
      setFeedback(humanError(error, "Non è stato possibile eliminare l'account."));
      setBusy(false);
    }
  }

  return (
    <LegalPage
      eyebrow="Gestione account"
      title="Cancellazione account"
      updated="15 luglio 2026"
      intro="Questa pagina spiega come richiedere la cancellazione dell'account FantaChat e cosa aspettarsi durante la procedura."
      actions={
        <section className="legal-card" aria-labelledby="account-delete-action-title">
          <h2 id="account-delete-action-title">Elimina dall'app</h2>
          <p>
            Se hai effettuato l'accesso, puoi avviare qui la cancellazione. I dati personali collegati verranno rimossi e i contenuti di competizione potranno essere anonimizzati per non alterare la storia della lega.
          </p>
          {accessToken ? (
            <button type="button" onClick={deleteAccount} disabled={busy} className="legal-action-button">
              {busy ? "Eliminazione in corso..." : "Elimina il mio account"}
            </button>
          ) : (
            <a href="/login?next=/cancellazione-account" className="legal-action-button legal-action-link">
              Accedi per eliminare l'account
            </a>
          )}
          {feedback && <p className="legal-error" role="alert">{feedback}</p>}
        </section>
      }
      sections={sections}
    />
  );
}
