const FALLBACK = "Qualcosa non ha funzionato. Riprova tra poco.";

export function humanError(error: unknown, fallback = FALLBACK) {
  const raw =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof (error as { message?: unknown } | null)?.message === "string"
          ? String((error as { message: string }).message)
          : "";
  const code = typeof (error as { code?: unknown } | null)?.code === "string"
    ? String((error as { code: string }).code)
    : "";

  const message = `${raw} ${code}`.trim();
  const lower = message.toLowerCase();

  if (!message) return fallback;

  if (lower.includes("invalid login credentials")) {
    return "Email non registrata o password non corretta.";
  }

  if (lower.includes("email not confirmed") || lower.includes("email_not_confirmed")) {
    return "Conferma prima l'email ricevuta, poi accedi con la tua password.";
  }

  if (lower.includes("rate limit") || lower.includes("too many") || lower.includes("over_email_send_rate_limit") || lower.includes("429")) {
    return fallback === FALLBACK
      ? "L'email per il recupero della password è già stata mandata. Se non la trovi, controlla la cartella spam."
      : fallback;
  }

  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "Email già registrata.";
  }

  if (lower.includes("permission denied") || lower.includes("accesso negato")) {
    return "Non hai i permessi per completare questa operazione.";
  }

  if (lower.includes("solo superadmin")) {
    return "Questa azione è riservata al superadmin.";
  }

  if (lower.includes("solo admin")) {
    return "Questa azione è riservata all'admin della lega.";
  }

  if (lower.includes("violates row-level security") || lower.includes("row-level security")) {
    return "Non hai accesso a questi dati.";
  }

  if (lower.includes("record ") && lower.includes(" is not assigned yet")) {
    return "Dati della giornata non ancora pronti. Riprova tra poco.";
  }

  if (lower.includes("schema cache") || lower.includes("could not find") || lower.includes("does not exist")) {
    return "Aggiornamento tecnico non ancora applicato. Controlla le migrazioni Supabase.";
  }

  if (lower.includes("invalid input syntax")) {
    return "Un dato ricevuto non è nel formato corretto. Serve un controllo tecnico.";
  }

  if (lower.includes("messaggio vuoto")) {
    return "Scrivi un messaggio prima di inviarlo.";
  }

  if (lower.includes("messaggio troppo lungo")) {
    return "Il messaggio è troppo lungo. Riducilo e riprova.";
  }

  if (lower.includes("messaggio non disponibile")) {
    return "Questo messaggio non è più disponibile.";
  }

  if (lower.includes("competizione non valida") || lower.includes("giornata non valida")) {
    return "La competizione o la giornata selezionata non è più disponibile.";
  }

  if (lower.includes("slot formazione non disponibile")) {
    return "Lo slot formazione non è più disponibile.";
  }

  if (lower.includes("utente non appartenente")) {
    return "L'utente non appartiene a questa lega.";
  }

  if (lower.includes("sessione") || lower.includes("jwt") || lower.includes("token")) {
    return "Sessione scaduta. Accedi di nuovo.";
  }

  // Technical database and provider messages must never reach the interface.
  return fallback;
}

export function isEmailConfirmationError(error: unknown) {
  const raw = typeof error === "string"
    ? error
    : error instanceof Error
      ? error.message
      : typeof (error as { message?: unknown } | null)?.message === "string"
        ? String((error as { message: string }).message)
        : "";
  const code = typeof (error as { code?: unknown } | null)?.code === "string"
    ? String((error as { code: string }).code)
    : "";
  const value = `${raw} ${code}`.toLowerCase();
  return value.includes("email not confirmed") || value.includes("email_not_confirmed");
}
