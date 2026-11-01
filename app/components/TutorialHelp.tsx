"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { useApp } from "./AppContext";

type TutorialStep = {
  title: string;
  text: string;
  target?: string;
};
type TutorialContent = { title: string; steps: TutorialStep[] };
type TargetRect = { left: number; top: number; width: number; height: number };
type CoachSize = { width: number; height: number };

function contentForPath(pathname: string): TutorialContent {
  if (pathname === "/") {
    return {
      title: "Come leggere la Home",
      steps: [
        { title: "La giornata", text: "Qui trovi la giornata corrente, lo stato della competizione e il tuo prossimo slot per inviare la formazione.", target: "home-matchday" },
        { title: "La tua posizione", text: "La classifica ti mostra il tuo posto nella lega, i punti totali e il distacco dalle altre squadre.", target: "home-standing" },
        { title: "Il riepilogo", text: "Controlla i tuoi giocatori, i punteggi ottenuti e gli aggiornamenti della giornata senza cambiare sezione.", target: "home-recap" },
        { title: "Naviga nell'app", text: "Usa la barra in basso per passare a Live, Rosa, Chat e Classifica. Dal menu laterale trovi tutte le altre funzioni.", target: "main-nav" },
      ],
    };
  }

  if (pathname.startsWith("/rosa")) {
    return {
      title: "Come usare la Rosa",
      steps: [
        { title: "Scegli uno slot", text: "Tocca una posizione nel campo per scegliere il giocatore che vuoi schierare.", target: "rosa-field" },
        { title: "Completa la formazione", text: "Inserisci i giocatori richiesti dal modulo della lega e seleziona anche l'allenatore, quando previsto.", target: "rosa-rules" },
        { title: "Controlla i dettagli", text: "Ogni giocatore mostra ruolo, squadra e disponibilità. Gli slot non validi vengono segnalati prima dell'invio.", target: "rosa-context" },
        { title: "Invia la formazione", text: "Quando tutto è corretto, salva e invia la formazione. Dopo la chiusura della giornata non potrai più modificarla.", target: "rosa-submit" },
      ],
    };
  }

  if (pathname.startsWith("/live")) {
    return {
      title: "Come leggere il Live",
      steps: [
        { title: "Partite in corso", text: "Qui vedi le partite della giornata e il loro stato: programmate, in corso o concluse.", target: "live-list" },
        { title: "Punteggi provvisori", text: "I punteggi live possono cambiare mentre arrivano nuovi eventi e statistiche dalla partita.", target: "live-row" },
        { title: "La tua proiezione", text: "Controlla come le prestazioni dei tuoi giocatori stanno influenzando il risultato della tua squadra.", target: "main-nav" },
      ],
    };
  }

  if (pathname.startsWith("/chat")) {
    return {
      title: "Come usare la Chat",
      steps: [
        { title: "Parla con la lega", text: "La chat è lo spazio comune della tua lega per commentare partite, formazioni e risultati.", target: "chat-header" },
        { title: "Scrivi un messaggio", text: "Usa il campo in basso e invia il messaggio. Gli altri partecipanti lo vedranno nella chat della stessa lega.", target: "chat-input" },
        { title: "Rispetta la community", text: "Evita spam, insulti e contenuti offensivi. I messaggi possono essere segnalati e moderati dall'amministratore.", target: "main-nav" },
      ],
    };
  }

  if (pathname.startsWith("/classifica")) {
    return {
      title: "Come leggere la Classifica",
      steps: [
        { title: "La graduatoria", text: "Le squadre sono ordinate in base ai punti accumulati nella competizione.", target: "classifica-table" },
        { title: "Il dettaglio", text: "Apri una squadra per confrontare andamento, punti per ruolo e risultati delle giornate.", target: "classifica-row" },
        { title: "Cambia competizione", text: "Se la lega ha più competizioni attive, puoi cambiarla dal menu laterale.", target: "appbar-menu" },
      ],
    };
  }

  if (pathname.startsWith("/statistiche")) {
    return {
      title: "Come usare le Statistiche",
      steps: [
        { title: "Cerca un giocatore", text: "Usa la ricerca per trovare rapidamente un giocatore oppure filtra per ruolo.", target: "stats-tabs" },
        { title: "Confronta i numeri", text: "Guarda presenze, media, totale, miglior punteggio e peggior punteggio.", target: "stats-controls" },
        { title: "Apri il dettaglio", text: "Tocca un giocatore per vedere lo storico giornata per giornata e il dettaglio del punteggio.", target: "stats-player-row" },
      ],
    };
  }

  if (pathname.startsWith("/storico")) {
    return {
      title: "Come usare lo Storico",
      steps: [
        { title: "Scegli una giornata", text: "Qui trovi le giornate già concluse della tua competizione.", target: "history-list" },
        { title: "Apri il dettaglio", text: "Seleziona una giornata per vedere formazione, giocatori e punteggi ottenuti.", target: "history-card" },
        { title: "Confronta il percorso", text: "Usa lo storico per capire come è cambiata la tua squadra nel corso del campionato.", target: "main-nav" },
      ],
    };
  }

  if (pathname.startsWith("/personalizza")) {
    return {
      title: "Come personalizzare la squadra",
      steps: [
        { title: "Scegli i colori", text: "Imposta i colori principali e secondari della tua squadra.", target: "custom-colors" },
        { title: "Scegli il modello", text: "Seleziona il motivo della maglia per rendere riconoscibile il tuo stemma.", target: "custom-patterns" },
        { title: "Salva", text: "Conferma le modifiche: i nuovi colori saranno visibili nei menu e nelle classifiche.", target: "custom-save" },
      ],
    };
  }

  if (pathname.startsWith("/giocatore")) {
    return {
      title: "Come leggere il giocatore",
      steps: [
        { title: "Il rendimento", text: "Qui trovi media, totale, miglior punteggio e peggior punteggio del giocatore.", target: "player-summary" },
        { title: "Lo storico", text: "Scorri le giornate per capire quando il giocatore ha inciso di più o di meno.", target: "player-history" },
        { title: "Il dettaglio", text: "Apri le voci del punteggio per vedere quali statistiche hanno contribuito al risultato.", target: "player-breakdown" },
      ],
    };
  }

  if (pathname.startsWith("/regole")) {
    return {
      title: "Come leggere le Regole",
      steps: [
        { title: "Regole della lega", text: "Qui trovi il modulo, i ruoli disponibili e le regole scelte dall'amministratore.", target: "rules-overview" },
        { title: "Come si calcolano i punti", text: "I punti FantaChat derivano dalle statistiche dei giocatori e dai bonus previsti dalla competizione.", target: "rules-scoring" },
        { title: "Controlla prima di giocare", text: "Consulta questa pagina prima di inviare la formazione, soprattutto quando inizi una nuova competizione.", target: "main-nav" },
      ],
    };
  }

  if (pathname.startsWith("/crea-lega")) {
    return {
      title: "Come creare una lega",
      steps: [
        { title: "Dai un nome alla lega", text: "Scegli un nome riconoscibile per il tuo gruppo di gioco.", target: "create-fields" },
        { title: "Imposta la squadra", text: "Inserisci il nome della tua squadra e completa le impostazioni richieste.", target: "create-submit" },
        { title: "Invita gli amici", text: "Dopo la creazione riceverai un codice invito da condividere con gli altri partecipanti.", target: "invite-code" },
      ],
    };
  }

  if (pathname.startsWith("/seleziona-lega")) {
    return {
      title: "Come entrare in una lega",
      steps: [
        { title: "Scegli una lega", text: "Tocca una lega già disponibile per renderla attiva e aprire la Home.", target: "league-list" },
        { title: "Usa un codice invito", text: "Inserisci il codice ricevuto dall'amministratore e il nome della tua squadra.", target: "join-form" },
        { title: "Crea una lega", text: "Se non hai ancora una lega, puoi crearne una nuova e invitare il tuo gruppo.", target: "create-league" },
      ],
    };
  }

  if (pathname.startsWith("/podcast")) {
    return {
      title: "Come usare il Podcast",
      steps: [
        { title: "Scegli un contenuto", text: "Qui trovi gli aggiornamenti e i contenuti audio pubblicati per la tua competizione." },
        { title: "Ascolta l'analisi", text: "Apri una scheda per leggere il contenuto o ascoltare l'audio, quando disponibile." },
        { title: "Resta aggiornato", text: "Controlla questa sezione dopo gli aggiornamenti della giornata per non perdere le novità." },
      ],
    };
  }

  if (pathname.startsWith("/privacy") || pathname.startsWith("/termini") || pathname.startsWith("/cancellazione-account")) {
    return {
      title: "Come usare questa pagina",
      steps: [
        { title: "Leggi le informazioni", text: "Questa pagina raccoglie le informazioni importanti sul servizio e sui tuoi dati." },
        { title: "Usa i collegamenti", text: "Dal menu in alto puoi passare rapidamente tra Privacy, Termini e gestione dell'account." },
        { title: "Torna all'app", text: "Usa il logo FantaChat per tornare alla Home o continuare a usare il servizio." },
      ],
    };
  }

  if (pathname.startsWith("/admin")) {
    return {
      title: "Come usare l'area Admin",
      steps: [
        { title: "Gestisci la competizione", text: "Qui puoi controllare impostazioni, partecipanti, giornate e formazioni della tua lega.", target: "admin-grid" },
        { title: "Aggiorna i dati", text: "Inserisci o verifica i dati richiesti prima di pubblicare risultati e contenuti agli utenti.", target: "admin-grid" },
        { title: "Controlla prima di confermare", text: "Le modifiche admin possono influenzare tutta la lega: verifica sempre giornata e competizione selezionate.", target: "appbar-menu" },
      ],
    };
  }

  if (pathname.startsWith("/superadmin")) {
    return {
      title: "Come usare il Superadmin",
      steps: [
        { title: "Gestisci il catalogo", text: "Qui puoi amministrare competizioni, squadre, giocatori, calendario e statistiche globali.", target: "superadmin-main" },
        { title: "Seleziona il contesto", text: "Prima di modificare un dato controlla sempre competizione, stagione e giornata selezionate.", target: "superadmin-main" },
        { title: "Salva e verifica", text: "Dopo ogni aggiornamento controlla il messaggio di conferma e verifica il risultato nella pagina pubblica.", target: "appbar-menu" },
      ],
    };
  }

  return {
    title: "Come orientarti",
    steps: [
      { title: "Esplora la pagina", text: "Questa sezione contiene gli strumenti principali per la funzione che stai usando." },
      { title: "Usa il menu", text: "Apri il menu laterale per cambiare lega, competizione o sezione." },
      { title: "Controlla le conferme", text: "Dopo un salvataggio o un invio, verifica sempre il messaggio mostrato dall'app." },
    ],
  };
}

export default function TutorialHelp({ compact = false }: { compact?: boolean }) {
  const app = useApp();
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [coachSize, setCoachSize] = useState<CoachSize>({ width: 292, height: 270 });
  const [bottomInset, setBottomInset] = useState(0);
  const coachModalRef = useRef<HTMLElement | null>(null);
  const content = useMemo(() => contentForPath(pathname), [pathname]);
  const step = content.steps[stepIndex] ?? content.steps[0];
  const last = stepIndex === content.steps.length - 1;

  useEffect(() => {
    if (!open || !step.target) {
      queueMicrotask(() => setTargetRect(null));
      return;
    }

    let active = true;
    const selector = `[data-tutorial-target="${step.target}"]`;
    const element = document.querySelector<HTMLElement>(selector);

    if (!element) {
      queueMicrotask(() => {
        if (active) setTargetRect(null);
      });
      return () => {
        active = false;
      };
    }

    element.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });

    const measure = () => {
      if (!active) return;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        setTargetRect(null);
        return;
      }
      setTargetRect({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    };

    const frame = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure, { passive: true });
    window.addEventListener("scroll", measure, { passive: true });

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [open, step.target, stepIndex]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !targetRect) return;

    const frame = window.requestAnimationFrame(() => {
      const rect = coachModalRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      setCoachSize({ width: rect.width, height: rect.height });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open, stepIndex, targetRect]);

  useEffect(() => {
    if (!open) return;

    const measureBottomNav = () => {
      const nav = document.querySelector<HTMLElement>(".fc-bottom-nav");
      const rect = nav?.getBoundingClientRect();
      setBottomInset(rect ? Math.max(0, window.innerHeight - rect.top) : 0);
    };

    measureBottomNav();
    window.addEventListener("resize", measureBottomNav, { passive: true });
    return () => window.removeEventListener("resize", measureBottomNav);
  }, [open]);

  if (!app.ready || !app.userId) return null;

  function openTutorial() {
    setStepIndex(0);
    setTargetRect(null);
    setCoachSize({ width: 292, height: 270 });
    setBottomInset(0);
    setOpen(true);
  }

  const coachLayout = targetRect ? getCoachLayout(targetRect, coachSize, bottomInset) : null;
  const coachMode = Boolean(targetRect && coachLayout);

  return (
    <>
      <button
        type="button"
        onClick={openTutorial}
        aria-label="Apri guida della pagina"
        title="Guida della pagina"
        style={{ ...s.launcher, ...(compact ? s.compact : {}) }}
      >
        ?
      </button>

      {open && (
        <div style={coachMode ? s.coachBackdrop : s.backdrop} onClick={() => setOpen(false)} role="presentation">
          {coachMode && targetRect && coachLayout && (
            <div
              aria-hidden="true"
              style={{
                ...s.spotlight,
                left: targetRect.left - 5,
                top: targetRect.top - 5,
                width: targetRect.width + 10,
                height: targetRect.height + 10,
              }}
            />
          )}
          <section
            ref={coachModalRef}
            style={coachLayout ? { ...s.modal, ...s.coachModal, left: coachLayout.left, top: coachLayout.top, width: coachLayout.width } : s.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tutorial-title"
            onClick={(event) => event.stopPropagation()}
          >
            {coachLayout && (
              <span
                aria-hidden="true"
                style={{
                  ...s.arrow,
                  left: coachLayout.arrowLeft,
                  transform: coachLayout.below ? "rotate(45deg)" : "rotate(225deg)",
                  ...(coachLayout.below ? { top: -7 } : { bottom: -7 }),
                }}
              />
            )}
            <div style={s.modalTop}>
              <div>
                <div style={s.eyebrow}>Guida rapida</div>
                <h2 id="tutorial-title" style={s.heading}>{content.title}</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} style={s.close} aria-label="Chiudi guida">×</button>
            </div>

            <div style={s.progress} aria-label={`Passaggio ${stepIndex + 1} di ${content.steps.length}`}>
              <span>{stepIndex + 1} di {content.steps.length}</span>
              <div style={s.progressTrack}>
                <div style={{ ...s.progressValue, width: `${((stepIndex + 1) / content.steps.length) * 100}%` }} />
              </div>
            </div>

            <div style={s.stepIcon}>{stepIndex + 1}</div>
            <h3 style={s.stepTitle}>{step.title}</h3>
            <p style={s.stepText}>{step.text}</p>

            <div style={s.actions}>
              {stepIndex > 0 ? (
                <button type="button" onClick={() => setStepIndex((value) => value - 1)} style={s.secondary}>Indietro</button>
              ) : <span />}
              <button
                type="button"
                onClick={() => (last ? setOpen(false) : setStepIndex((value) => value + 1))}
                style={s.primary}
              >
                {last ? "Ho capito" : "Avanti"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function getCoachLayout(rect: TargetRect, measuredSize: CoachSize, bottomInset: number) {
  const viewportWidth = typeof window === "undefined" ? 390 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 760 : window.innerHeight;
  const width = Math.min(292, viewportWidth - 28);
  const safeBottom = Math.max(14, bottomInset + 12);
  const height = Math.min(measuredSize.height, viewportHeight - safeBottom - 14);
  const center = rect.left + rect.width / 2;
  const left = Math.max(14, Math.min(center - width / 2, viewportWidth - width - 14));
  const bottom = rect.top + rect.height;
  const belowFits = bottom + height + 18 <= viewportHeight - safeBottom;
  const aboveFits = rect.top - height - 18 >= 14;
  const below = belowFits || (!aboveFits && viewportHeight - safeBottom - bottom >= rect.top - 14);
  const top = below
    ? Math.min(viewportHeight - safeBottom - height, bottom + 18)
    : Math.max(14, rect.top - height - 18);
  const arrowLeft = Math.max(24, Math.min(center - left - 8, width - 28));

  return { left, top, width, below, arrowLeft };
}

const s: Record<string, CSSProperties> = {
  launcher: {
    width: 32,
    height: 32,
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    border: "1px solid var(--brand-orange-border)",
    borderRadius: "50%",
    background: "var(--brand-orange-soft)",
    color: "var(--brand-orange)",
    fontFamily: "inherit",
    fontSize: 17,
    fontWeight: 1000,
    lineHeight: 1,
    cursor: "pointer",
  },
  compact: { width: 34, height: 34 },
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 450,
    display: "grid",
    placeItems: "center",
    padding: 20,
    background: "rgba(15,23,42,.48)",
    backdropFilter: "blur(4px)",
  },
  coachBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 450,
    background: "transparent",
  },
  spotlight: {
    position: "fixed",
    zIndex: 451,
    border: "2px solid var(--fc-primary, #15803d)",
    borderRadius: 14,
    pointerEvents: "none",
    boxShadow: "0 0 0 9999px rgba(9, 20, 14, .64), 0 0 0 5px rgba(21, 128, 61, .18)",
  },
  modal: {
    width: "min(100%, 390px)",
    border: "1px solid var(--fc-border, #dce7df)",
    borderRadius: 14,
    padding: 14,
    background: "var(--fc-card-bg, #ffffff)",
    color: "var(--fc-text, #14251b)",
    boxShadow: "0 14px 34px rgba(15,23,42,.18)",
  },
  coachModal: {
    position: "fixed",
    zIndex: 452,
    maxWidth: 292,
    padding: 13,
    borderRadius: 14,
  },
  arrow: {
    position: "absolute",
    width: 14,
    height: 14,
    borderLeft: "1px solid var(--fc-border, #dce7df)",
    borderTop: "1px solid var(--fc-border, #dce7df)",
    background: "var(--fc-card-bg, #ffffff)",
    transform: "rotate(45deg)",
  },
  modalTop: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  eyebrow: { color: "var(--fc-primary, #15803d)", fontSize: 9, fontWeight: 1000, letterSpacing: ".08em", textTransform: "uppercase" },
  heading: { margin: "3px 0 0", fontSize: 16, lineHeight: 1.15, fontWeight: 1000 },
  close: { width: 24, height: 24, border: "1px solid var(--fc-border, #dce7df)", borderRadius: "50%", background: "transparent", color: "var(--fc-muted, #64748b)", fontSize: 16, lineHeight: 1, cursor: "pointer" },
  progress: { display: "flex", alignItems: "center", gap: 7, marginTop: 10, color: "var(--fc-muted, #64748b)", fontSize: 9, fontWeight: 900 },
  progressTrack: { height: 4, flex: 1, overflow: "hidden", borderRadius: 99, background: "var(--fc-soft, #eef7f0)" },
  progressValue: { height: "100%", borderRadius: 99, background: "var(--fc-primary, #15803d)", transition: "width .2s ease" },
  stepIcon: { width: 28, height: 28, marginTop: 12, display: "grid", placeItems: "center", borderRadius: "50%", background: "var(--fc-soft, #eef7f0)", color: "var(--fc-primary, #15803d)", fontSize: 13, fontWeight: 1000 },
  stepTitle: { margin: "7px 0 0", fontSize: 14, lineHeight: 1.2, fontWeight: 1000 },
  stepText: { minHeight: 0, margin: "5px 0 0", color: "var(--fc-muted, #64748b)", fontSize: 12, lineHeight: 1.35, fontWeight: 700 },
  actions: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12 },
  secondary: { border: "1px solid var(--fc-border, #dce7df)", borderRadius: 9, background: "transparent", color: "var(--fc-muted, #64748b)", padding: "7px 10px", fontFamily: "inherit", fontSize: 11, fontWeight: 900, cursor: "pointer" },
  primary: { marginLeft: "auto", border: 0, borderRadius: 9, background: "var(--fc-primary, #15803d)", color: "white", padding: "8px 12px", fontFamily: "inherit", fontSize: 11, fontWeight: 1000, cursor: "pointer" },
};
