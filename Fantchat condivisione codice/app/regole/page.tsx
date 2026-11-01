"use client";

import { useEffect, useState } from "react";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { useApp } from "../components/AppContext";
import { supabase } from "../../lib/supabaseClient";

export default function RegolePage() {
  const app = useApp();
  const [ruleset, setRuleset] = useState<string | null>(null);
  const [coachEnabled, setCoachEnabled] = useState(false);

  useEffect(() => {
    if (!app.activeLeagueCompetitionId) return;
    let off = false;
    supabase
      .rpc("get_league_competition_rules", {
        p_league_competition_id: app.activeLeagueCompetitionId,
      })
      .then(({ data, error }) => {
        if (!off) {
          if (error) return;
          setRuleset((data as any)?.scoring_ruleset ?? null);
          setCoachEnabled(Boolean((data as any)?.coach_enabled));
        }
      });
    return () => { off = true; };
  }, [app.activeLeagueCompetitionId]);

  const isPro = ruleset === "pro";
  const isNonStandard = ruleset === "non_standard";

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
            {isNonStandard && <span style={s.proPill}>STATISTICO</span>}
            {coachEnabled && <span style={s.proPill}>ALLENATORE</span>}
          </h1>
          <p style={s.subtitle}>
            Regole principali per formazione, capitani, Top squadre e punteggi.
          </p>
        </section>

        <RuleCard title="Come funziona">
          <p>
            Ogni giornata ha una finestra di scelta ordinata. Il primo a scegliere
            è l’ultimo in classifica, poi si risale fino al primo.
          </p>

          <p>
            Se chi sceglie prima di te invia la formazione in anticipo, il tuo
            turno parte subito. Se invece perdi il tuo slot, puoi comunque
            inviare la formazione più tardi: perdi solo la priorità di scelta.
          </p>

          <p>
            Una volta inviata, la formazione resta bloccata. Per modificarla serve
            il reset dell’admin della lega.
          </p>
        </RuleCard>

        <RuleCard title="Scelta giocatori">
          <p>
            In ogni giornata puoi schierare solo giocatori disponibili nella
            competizione attiva.
          </p>

          <ul style={s.list}>
            <li>Non puoi scegliere un giocatore già preso da un altro partecipante.</li>
            <li>Puoi schierare al massimo un giocatore per squadra reale.</li>
            <li>Puoi schierare giocatori Top 6 fino al 25% della rosa, arrotondato per eccesso.</li>
            <li>Il portiere rappresenta la squadra, non il singolo portiere.</li>
          </ul>

          <p>
            L’admin può scegliere tra tre moduli ufficiali: Classico 1-1-1-1,
            Bilanciato 1-2-2-2 e Serie A 1-3-5-2.
          </p>
        </RuleCard>

        <RuleCard title="Top squadre">
          <p>
            Le Top squadre sono le squadre considerate più forti o meglio piazzate
            per quella giornata. Servono a rendere la scelta più strategica.
          </p>

          <p>
            In Serie A coincidono con le prime 6 squadre della classifica alla
            giornata precedente. Alla prima giornata vengono usati i riferimenti
            stabiliti dal superadmin.
          </p>

          <p>
            Il limite Top 6 riguarda solo i giocatori ed è calcolato sul modulo
            scelto. L’allenatore, quando previsto, è uno slot separato.
          </p>
        </RuleCard>

        <RuleCard title="Campionati e coppe">
          <p>
            FantaChat può gestire campionati, coppe e tornei con regole diverse.
            Le informazioni globali della competizione sono uguali per tutte le
            leghe che la utilizzano.
          </p>

          <p>
            Numero di giornate, calendario e Top squadre sono definiti a livello
            globale dal superadmin.
          </p>

          <p>
            Quando l’admin aggiunge la competizione alla propria lega sceglie
            partecipanti, composizione della formazione e modalità di punteggio.
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

        {isNonStandard && (
          <section style={{ ...s.card, borderTop: "3px solid #e07b1a" }}>
            <h2 style={s.cardTitle}>
              Punteggi non standard <span style={s.proPillSmall}>NON STANDARD</span>
            </h2>
            <div style={s.text}>
              <p>
                Questa modalita aggiunge moltiplicatori statistici ai bonus e
                malus comuni.
              </p>

              <h3 style={s.subTitle}>Eventi principali</h3>
              <ul style={s.list}>
                <li>Gol segnato: +3</li>
                <li>Assist: +1</li>
                <li>Ammonizione: -0,5</li>
                <li>Espulsione: -1</li>
                <li>Rigore sbagliato: -3</li>
              </ul>

              <h3 style={s.subTitle}>Statistiche avanzate</h3>
              <ul style={s.list}>
                <li>Passaggi riusciti: +0,005 ciascuno</li>
                <li>Precisione passaggi: +0,3 se oltre 85% e almeno 20 passaggi riusciti</li>
                <li>Tackle: +0,10 ciascuno</li>
                <li>Intercetto: +0,10 ciascuno</li>
                <li>npxG: valore pieno x1</li>
                <li>xA / expected assist: valore pieno x1</li>
              </ul>

              <h3 style={s.subTitle}>Portieri e clean sheet</h3>
              <ul style={s.list}>
                <li>Porta inviolata portiere: +1</li>
                <li>Porta inviolata difensore: +1</li>
                <li>Gol subito dal portiere: -1 ciascuno</li>
                <li>Percentuale parate portiere: +0,5 se oltre 80%</li>
                <li>Bonus parate rafforzato: +1 se oltre 80% e almeno 5 parate</li>
                <li>Rigore parato portiere: +3</li>
              </ul>
            </div>
          </section>
        )}

        {coachEnabled && (
          <RuleCard title="Allenatore">
            <p>
              L'allenatore è obbligatorio nelle modalità che lo includono. È uno
              slot separato: non rientra nel limite delle Top squadre e può
              appartenere alla stessa squadra di un giocatore già scelto.
            </p>

            <ul style={s.list}>
              <li>Vittoria: +1</li>
              <li>Pareggio: 0</li>
              <li>Sconfitta: -1</li>
              <li>npxG squadra: ×1</li>
              <li>Possesso palla almeno 60%: +0,5</li>
              <li>Tetto massimo positivo: +3</li>
              <li>Tetto minimo: -1</li>
            </ul>
          </RuleCard>
        )}

        <RuleCard id="ruolo-admin" title="Ruolo dell'admin">
          <p>
            L’admin gestisce la propria lega, non l’intera competizione.
          </p>

          <ul style={s.list}>
            <li>Aggiunge una competizione disponibile alla lega.</li>
            <li>Sceglie quali partecipanti prendono parte alla competizione.</li>
            <li>Sceglie la modalità: classico, classico con allenatore, statistico o statistico con allenatore.</li>
            <li>Imposta la durata unica dello slot di scelta per tutti i partecipanti.</li>
            <li>Controlla le formazioni inviate e può resettarle se serve.</li>
          </ul>

          <p>
            L’admin non inserisce statistiche reali, non apre giornate e non
            chiude i punteggi.
          </p>
        </RuleCard>

        <RuleCard title="Ruolo del superadmin">
          <p>
            Il superadmin coordina la competizione globale, così tutte le leghe
            possono andare avanti anche senza interventi continui dei singoli
            admin.
          </p>

          <ul style={s.list}>
            <li>Apre e chiude le giornate della competizione.</li>
            <li>Genera gli slot di scelta per tutte le leghe attive.</li>
            <li>Importa o aggiorna squadre, giocatori, allenatori, calendario e statistiche.</li>
            <li>Definisce le Top squadre della giornata.</li>
            <li>Ricalcola classifiche, punteggi live e risultati finali.</li>
          </ul>
        </RuleCard>
      </main>

      <BottomNav />
    </>
  );
}

function RuleCard(props: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={props.id} style={s.card}>
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
