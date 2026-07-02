"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import LoadingScreen from "../components/LoadingScreen";
import CompetitionBadge from "../components/CompetitionBadge";
import { useRequireApp } from "../hooks/useRequireApp";
import { rpcJson, fmt } from "../../lib/rpc";

type Row = { matchday_id: string; matchday_number: number; status: string; total_score: number; rank: number };

function statusLabel(s: string) { return s === "open" ? "in corso" : "conclusa"; }

export default function Storico() {
  const app = useRequireApp(true);
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!app.ready || !app.activeLeagueCompetitionId) return;
    rpcJson<Row[]>("get_user_history", { p_league_competition_id: app.activeLeagueCompetitionId }, [])
      .then((r) => setRows(r ?? []))
      .finally(() => setLoading(false));
  }, [app.ready, app.activeLeagueCompetitionId]);

  if (!app.ready || loading) return <LoadingScreen />;
  const accent = app.competitionTheme.primary;

  return (
    <>
      <AppBar league={app.leagueName} team={app.teamName} onMenuOpen={app.openDrawer} />
      <main className="fc-history-page" style={s.container}>
        <div className="fc-history-hero" style={s.head}>
          <CompetitionBadge name={app.competitionName} type={app.competitionType} />
          <div style={s.heroRow}>
            <div>
              <h1 style={s.h1}>Storico</h1>
              <p style={s.hsub}>Le tue giornate in questa competizione</p>
            </div>
            <div className="fc-history-count" style={s.countBox}>
              <strong>{rows.length}</strong>
              <span>giornate</span>
            </div>
          </div>
        </div>

        <div className="fc-history-list" style={s.list}>
          {rows.map((r) => {
            const open = r.status === "open";
            return (
              <button key={r.matchday_id} className="fc-history-card" style={s.card} onClick={() => router.push(`/storico/${r.matchday_id}`)}>
                <div className="fc-history-tile" style={{ ...s.tile, background: `${accent}14`, color: accent }}>{r.matchday_number}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.title}>Giornata {r.matchday_number}</div>
                  <div style={s.meta}>
                    <span className={open ? "fc-history-pill is-open" : "fc-history-pill"} style={{ ...s.pill, background: open ? `${accent}18` : "#f1f5f9", color: open ? accent : "#64748b" }}>{statusLabel(r.status)}</span>
                    <span style={s.metaTxt}>posizione #{r.rank}</span>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={s.score}>{fmt(r.total_score)}</div>
                  <div style={s.scoreL}>punti</div>
                </div>
                <span style={s.chev}>›</span>
              </button>
            );
          })}
          {!rows.length && <div style={s.empty}>Nessuna giornata storica.</div>}
        </div>
      </main>
      <BottomNav />
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 520, margin: "0 auto", padding: "14px 14px 100px", display: "grid", gap: 10 },
  head: { background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: 14, boxShadow: "0 8px 22px rgba(15,23,42,.06)" },
  heroRow: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: 12 },
  h1: { fontSize: 22, fontWeight: 1000, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" },
  hsub: { fontSize: 12.5, color: "#64748b", fontWeight: 700, margin: 0 },
  countBox: { minWidth: 76, borderRadius: 12, padding: "8px 10px", display: "grid", justifyItems: "center", background: "#f8fafc", border: "1px solid #e5e7eb" },
  list: { display: "grid", gap: 8 },
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: "10px 11px", boxShadow: "0 3px 12px rgba(15,23,42,.04)", display: "flex", alignItems: "center", gap: 11, textAlign: "left", fontFamily: "inherit", cursor: "pointer", width: "100%" },
  tile: { width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", fontWeight: 1000, fontSize: 17, flexShrink: 0 },
  title: { fontSize: 14.5, fontWeight: 1000, color: "#0f172a" },
  meta: { display: "flex", alignItems: "center", gap: 8, marginTop: 3 },
  pill: { borderRadius: 999, padding: "2px 9px", fontSize: 10.5, fontWeight: 1000 },
  metaTxt: { fontSize: 11.5, fontWeight: 800, color: "#64748b" },
  score: { fontSize: 19, fontWeight: 1000, color: "#0f172a", lineHeight: 1 },
  scoreL: { fontSize: 9.5, fontWeight: 900, color: "#94a3b8", marginTop: 2 },
  chev: { fontSize: 22, color: "#cbd5e1", fontWeight: 1000, flexShrink: 0 },
  empty: { background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, color: "#64748b", fontWeight: 800 },
};
