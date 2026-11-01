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

  const message = raw.trim();
  const lower = message.toLowerCase();

  if (!message) return fallback;

  if (lower.includes("invalid login credentials")) {
    return "Email non registrata o password non corretta.";
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

  if (lower.includes("sessione") || lower.includes("jwt") || lower.includes("token")) {
    return "Sessione scaduta. Accedi di nuovo.";
  }

  return message;
}
