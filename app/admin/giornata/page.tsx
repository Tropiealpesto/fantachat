"use client";

import { useState } from "react";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import CompetitionBadge from "../../components/CompetitionBadge";
import { useRequireLeagueAdmin } from "../../hooks/useRequireApp";
import { supabase } from "../../../lib/supabaseClient";

export default function AdminGiornata() {
  const app = useRequireLeagueAdmin();
  const [num, setNum] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function call(fn: string, label: string, args: Record<string, unknown> = {}) {
    setMsg(null);
    setErr(null);
    setBusy(label);

    const { data, error } = await supabase.rpc(fn, {
      p_league_competition_id: app.activeLeagueCompetitionId,
      ...args,
    });

    setBusy(null);
    if (error) return setErr(error.message);
    setMsg(typeof data === "string" ? data : "Operazione completata");
  }

  return (
    <>
      <AppBar
        league={app.leagueName}
        team={`${app.teamName} · ADMIN`}
        onMenuOpen={app.openDrawer}
      />

      <main style={s.container}>
        <section style={s.hero}>
          <CompetitionBadge name={app.competitionName} type={app.competitionType} />
          <h1 style={s.title}>Giornata</h1>
          <p style={s.subtitle}>Apri il turno, bloccalo e calcola la classifica.</p>
        </section>

        <section style={s.card}>
          <label style={s.label}>Numero giornata</label>
          <input
            type="number"
            min={1}
            value={num}
            onChange={(e) => setNum(Number(e.target.value) || 1)}
            style={s.input}
          />

          <div style={s.actions}>
            <button
              type="button"
              style={s.primaryBtn}
              disabled={Boolean(busy)}
              onClick={() => call("open_competition_matchday", "open", { p_number: num })}
            >
              {busy === "open" ? "Apertura..." : "Apri giornata"}
            </button>

            <button
              type="button"
              style={s.secondaryBtn}
              disabled={Boolean(busy)}
              onClick={() => call("close_competition_matchday", "close")}
            >
              {busy === "close" ? "Chiusura..." : "Chiudi provvisoria"}
            </button>

            <button
              type="button"
              style={s.secondaryBtn}
              disabled={Boolean(busy)}
              onClick={() => call("finalize_competition_matchday", "finalize")}
            >
              {busy === "finalize" ? "Calcolo..." : "Finalizza e calcola"}
            </button>
          </div>

          {msg && <div style={s.ok}>{msg}</div>}
          {err && <div style={s.err}>{err}</div>}
        </section>
      </main>

      <BottomNav />
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 520, margin: "0 auto", padding: "12px 14px calc(72px + env(safe-area-inset-bottom, 0px) + 18px)", display: "grid", gap: 10 },
  hero: { background: "white", border: "1px solid rgba(226,232,240,.92)", borderRadius: 12, padding: 14, boxShadow: "0 3px 12px rgba(15,23,42,.035)" },
  title: { margin: "12px 0 3px", color: "#0f172a", fontSize: 22, lineHeight: 1.05, fontWeight: 900, letterSpacing: "-0.025em" },
  subtitle: { margin: 0, color: "#64748b", fontSize: 12.5, lineHeight: 1.35, fontWeight: 750 },
  card: { background: "white", border: "1px solid rgba(226,232,240,.92)", borderRadius: 12, padding: 14, display: "grid", gap: 10, boxShadow: "0 3px 12px rgba(15,23,42,.035)" },
  label: { color: "#64748b", fontSize: 10.5, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".02em" },
  input: { width: "100%", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb", color: "#0f172a", fontWeight: 900, fontFamily: "inherit", outline: "none" },
  actions: { display: "grid", gap: 8 },
  primaryBtn: { padding: 12, border: 0, borderRadius: 10, background: "#16a34a", color: "white", fontWeight: 900, fontFamily: "inherit", cursor: "pointer" },
  secondaryBtn: { padding: 12, border: "1px solid #e1e7e3", borderRadius: 10, background: "#fbfdfb", color: "#15803d", fontWeight: 900, fontFamily: "inherit", cursor: "pointer" },
  ok: { background: "#f0fdf4", border: "1px solid #86efac", color: "#15803d", borderRadius: 10, padding: 10, fontWeight: 850, fontSize: 13 },
  err: { background: "#fff3e4", border: "1px solid #f4c99d", color: "#b85c0a", borderRadius: 10, padding: 10, fontWeight: 850, fontSize: 13 },
};
