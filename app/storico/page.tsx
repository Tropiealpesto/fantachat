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
      <main style={s.container}>
        <div style={s.head}>
          <CompetitionBadge name={app.competitionName} type={app.competitionType} />
          <h1 style={s.h1}>Storico</h1>
          <p style={s.hsub}>Le tue giornate in questa competizione</p>
        </div>

        <div style={s.list}>
          {rows.map((r) => {
            const open = r.status === "open";
            return (
              <button key={r.matchday_id} style={s.card} onClick={() => router.push(`/storico/${r.matchday_id}`)}>
                <div style={{ ...s.tile, background: `${accent}14`, color: accent }}>{r.matchday_number}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.title}>Giornata {r.matchday_number}</div>
                  <div style={s.meta}>
                    <span style={{ ...s.pill, background: open ? `${accent}18` : "#f1f5f9", color: open ? accent : "#64748b" }}>{statusLabel(r.status)}</span>
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
  container: { maxWidth: 520, margin: "0 auto", padding: "16px 14px 100px", display: "grid", gap: 10 },
  head: { background: "white", border: "1px solid #dbe4dd", borderRadius: 8, padding: 16, boxShadow: "0 12px 28px rgba(19,35,26,.08)" },
  h1: { fontSize: 21, fontWeight: 1000, color: "#0f172a", margin: "10px 0 1px" },
  hsub: { fontSize: 12.5, color: "#64748b", fontWeight: 700, margin: 0 },
  list: { display: "grid", gap: 8 },
  card: { background: "white", border: "1px solid #dbe4dd", borderRadius: 8, padding: "11px 12px", boxShadow: "0 6px 16px rgba(19,35,26,.05)", display: "flex", alignItems: "center", gap: 12, textAlign: "left", fontFamily: "inherit", cursor: "pointer", width: "100%" },
  tile: { width: 42, height: 42, borderRadius: 8, display: "grid", placeItems: "center", fontWeight: 1000, fontSize: 18, flexShrink: 0 },
  title: { fontSize: 14.5, fontWeight: 1000, color: "#0f172a" },
  meta: { display: "flex", alignItems: "center", gap: 8, marginTop: 3 },
  pill: { borderRadius: 999, padding: "2px 9px", fontSize: 10.5, fontWeight: 1000 },
  metaTxt: { fontSize: 11.5, fontWeight: 800, color: "#64748b" },
  score: { fontSize: 19, fontWeight: 1000, color: "#0f172a", lineHeight: 1 },
  scoreL: { fontSize: 9.5, fontWeight: 900, color: "#94a3b8", marginTop: 2 },
  chev: { fontSize: 22, color: "#cbd5e1", fontWeight: 1000, flexShrink: 0 },
  empty: { background: "white", border: "1px solid #dbe4dd", borderRadius: 8, padding: 16, color: "#64748b", fontWeight: 800 },
};
