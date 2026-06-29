"use client";

import { useEffect, useState } from "react";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { useApp } from "../components/AppContext";
import { supabase } from "../../lib/supabaseClient";

export default function RegolePage() {
  const app = useApp();
  const [ruleset, setRuleset] = useState<string | null>(null);

  useEffect(() => {
    if (!app.activeLeagueCompetitionId) return;
    let off = false;
    supabase
      .from("league_competitions")
      .select("scoring_ruleset")
      .eq("id", app.activeLeagueCompetitionId)
      .maybeSingle()
      .then(({ data }) => { if (!off) setRuleset((data as any)?.scoring_ruleset ?? null); });
    return () => { off = true; };
  }, [app.activeLeagueCompetitionId]);

  const isPro = ruleset === "pro";

  return (
    <>
      <AppBar
        league={app.leagueName || "FantaChat"}
        team={app.teamName || "Regole"}
        onMenuOpen={app.openDrawer}
      />

      <main style={s.container}>
        <section style={s.hero}>
          <div style={s.eyebrow}>FantaChat</div>
          <h1 style={s.title}>
            Regole competizioni
            {isPro && <span style={s.proPill}>PRO</span>}
          </h1>
          <p style={s.subtitle}>
            Regole principali per formazione, capitani, Top squadre e punteggi.
          </p>
        </section>

        <RuleCard title="Regole generali">
          <p>
            La formazione deve essere inserita per ogni giornata aperta.
          </p>

          <p>
            L’ordine di scelta segue la classifica della competizione: sceglie
            per primo l’ultimo in classifica, poi il penultimo, fino ad arrivare
            al primo.
          </p>

          <p>
            Durante la scelta non è possibile inserire un giocatore già selezionato
            da un altro partecipante nella stessa giornata.
          </p>

          <p>
            Il giocatore appartenente a una Top squadra della giornata è
            considerato capitano.
          </p>

          <p>
            Ogni formazione può avere al massimo un capitano, salvo diversa
            indicazione della competizione.
          </p>

          <p>
            Le giornate vengono aperte e chiuse dall’admin della lega. Il
            superadmin gestisce invece squadre, giocatori, partite, Top squadre
            e statistiche reali.
          </p>
        </RuleCard>

        <RuleCard title="Serie A">
          <p>
            La Serie A è la competizione principale.
          </p>

          <h3 style={s.subTitle}>Formazione</h3>

          <ul style={s.list}>
            <li>1 Portiere</li>
            <li>1 Difensore</li>
            <li>1 Centrocampista</li>
            <li>1 Attaccante</li>
          </ul>

          <p>
            Totale: <strong>4 giocatori</strong>.
          </p>

          <h3 style={s.subTitle}>Top squadre</h3>

          <p>
            Le Top squadre sono le prime 6 squadre del campionato alla giornata
            precedente.
          </p>

          <p>
            Alla prima giornata di mercato vengono considerate le Top 6
            dell’ultima giornata del campionato precedente.
          </p>
        </RuleCard>

        <RuleCard title="Mondiale 2026">
          <p>
            Il Mondiale 2026 è una competizione basata sulle nazionali
            partecipanti al torneo.
          </p>

          <h3 style={s.subTitle}>Formazione</h3>

          <p>
            Configurazione consigliata:
          </p>

          <ul style={s.list}>
            <li>1 Portiere</li>
            <li>2 Difensori</li>
            <li>2 Centrocampisti</li>
            <li>2 Attaccanti</li>
          </ul>

          <p>
            Totale: <strong>7 giocatori</strong>.
          </p>

          <p>
            L’admin della lega può modificare il numero di giocatori per ruolo
            quando crea la competizione.
          </p>

          <h3 style={s.subTitle}>Top squadre</h3>

          <ul style={s.list}>
            <li>Fase a gironi: le 12 teste di serie dei gironi</li>
            <li>Sedicesimi: le 12 squadre classificate prime nel proprio girone</li>
            <li>Ottavi: le 8 squadre con le vittorie più schiaccianti</li>
            <li>Quarti: le 4 squadre con le vittorie più schiaccianti</li>
            <li>Semifinali: la squadra con la vittoria più schiacciante</li>
            <li>Finale e finalina: la squadra con la vittoria più schiacciante</li>
          </ul>
        </RuleCard>

        <RuleCard title="Coppe">
          <p>
            Le coppe possono avere formati diversi in base alla competizione.
          </p>

          <p>
            La formazione, il numero di giornate e il numero di Top squadre
            possono variare.
          </p>

          <p>
            Le regole specifiche vengono definite al momento della creazione
            della competizione.
          </p>
        </RuleCard>

        <RuleCard title="Champions">
          <p>
            La modalità Champions è in fase di sviluppo.
          </p>

          <p>
            Quando sarà attiva, avrà una struttura dedicata.
          </p>
        </RuleCard>

        <RuleCard title="Punteggi comuni">
          <h3 style={s.subTitle}>Bonus</h3>

          <ul style={s.list}>
            <li>Gol: +3</li>
            <li>Assist: +1</li>
            <li>Rigore parato: +3</li>
            <li>Clean sheet portiere: +1</li>
            <li>Clean sheet difensore: +1</li>
          </ul>

          <h3 style={s.subTitle}>Malus</h3>

          <ul style={s.list}>
            <li>Ammonizione: -0,5</li>
            <li>Espulsione: -1</li>
            <li>Rigore sbagliato: -3</li>
            <li>Gol subito dal portiere: -1</li>
          </ul>

          <h3 style={s.subTitle}>Note</h3>

          <p>
            Il clean sheet vale solo per portieri e difensori.
          </p>

          <p>
            Il gol subito vale solo per il portiere.
          </p>

          <p>
            Il rigore parato vale solo per il portiere.
          </p>

          <p>
            Il capitano è un giocatore appartenente a una Top squadra della
            giornata. Ogni formazione può avere al massimo un capitano, salvo
            diversa indicazione della competizione.
          </p>
        </RuleCard>

        {isPro && (
          <section style={{ ...s.card, borderTop: "3px solid #e07b1a" }}>
            <h2 style={s.cardTitle}>
              In più nel Pro <span style={s.proPillSmall}>PRO</span>
            </h2>
            <div style={s.text}>
              <p>
                Le competizioni Pro aggiungono bonus dalle statistiche avanzate,
                oltre a <strong>tutti</strong> i punteggi del Classico.
              </p>

              <h3 style={s.subTitle}>Bonus avanzati</h3>

              <ul style={s.list}>
                <li>Expected Goals (xG): +0,5 per ogni xG</li>
                <li>Expected Assists (xA): +1 per ogni xA</li>
              </ul>

              <h3 style={s.subTitle}>Note</h3>

              <p>
                xG e xA misurano la qualità delle occasioni create e degli assist
                attesi: premiano la prestazione anche quando il gol o l’assist non
                arriva.
              </p>

              <p>
                I valori arrivano dai dati ufficiali della competizione e si
                sommano ai punteggi del Classico.
              </p>
            </div>
          </section>
        )}
      </main>

      <BottomNav />
    </>
  );
}

function RuleCard(props: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={s.card}>
      <h2 style={s.cardTitle}>{props.title}</h2>
      <div style={s.text}>{props.children}</div>
    </section>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 520,
    margin: "0 auto",
    padding: "16px 14px calc(70px + env(safe-area-inset-bottom, 0px) + 20px)",
    display: "grid",
    gap: 14,
  },
  hero: {
    background: "linear-gradient(160deg,#14532d,#16a34a)",
    color: "white",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 14px 32px rgba(15,23,42,0.14)",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
    opacity: 0.8,
  },
  title: {
    margin: "6px 0 8px",
    fontSize: 28,
    lineHeight: 1.08,
    fontWeight: 1000,
  },
  proPill: {
    fontSize: 13,
    fontWeight: 1000,
    color: "white",
    background: "#e07b1a",
    borderRadius: 6,
    padding: "2px 9px",
    marginLeft: 10,
    verticalAlign: "middle",
  },
  proPillSmall: {
    fontSize: 11,
    fontWeight: 1000,
    color: "white",
    background: "#e07b1a",
    borderRadius: 6,
    padding: "2px 7px",
    marginLeft: 6,
    verticalAlign: "middle",
  },
  subtitle: {
    margin: 0,
    color: "rgba(255,255,255,0.78)",
    fontWeight: 750,
    lineHeight: 1.45,
  },
  card: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    padding: 16,
    boxShadow: "0 8px 22px rgba(15,23,42,.07)",
  },
  cardTitle: {
    margin: "0 0 10px",
    fontSize: 21,
    fontWeight: 1000,
    color: "#111827",
  },
  subTitle: {
    margin: "16px 0 8px",
    fontSize: 15,
    fontWeight: 1000,
    color: "#14532d",
  },
  text: {
    display: "grid",
    gap: 9,
    color: "#374151",
    fontSize: 14,
    fontWeight: 650,
    lineHeight: 1.5,
  },
  list: {
    margin: 0,
    paddingLeft: 20,
    display: "grid",
    gap: 6,
  },
};
