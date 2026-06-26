"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import LoadingScreen from "../components/LoadingScreen";
import CompetitionBadge from "../components/CompetitionBadge";
import { useRequireApp } from "../hooks/useRequireApp";
import { rpcJson, fmt } from "../../lib/rpc";

type Row = { player_id: string; player_name: string; team_name: string | null; role: string; played_count: number; avg_points: number; total_points: number; best_points: number; worst_points: number };

const ROLES = [
  { k: "ALL", label: "Tutti" },
  { k: "P", label: "Por" },
  { k: "D", label: "Dif" },
  { k: "C", label: "Cen" },
  { k: "A", label: "Att" },
];
const RANK_COLOR: Record<number, string> = { 1: "#f59e0b", 2: "#94a3b8", 3: "#b45309" };

function pLabel(r: Row) { return r.role === "P" ? (r.team_name || r.player_name) : r.player_name; }
function pSub(r: Row) { return r.role === "P" ? "Portiere" : `${r.role} · ${r.team_name ?? ""}`; }
const ROLE_META: Record<string, { bg: string; fg: string }> = {
  P: { bg: "#FEF3C7", fg: "#B45309" },
  D: { bg: "#DCFCE7", fg: "#15803D" },
  C: { bg: "#DBEAFE", fg: "#2563EB" },
  A: { bg: "#FEE2E2", fg: "#DC2626" },
};

function RoleBadge({ role }: { role: string }) {
  const c = ROLE_META[role] ?? { bg: "#f1f5f9", fg: "#475569" };
  return <span style={{ ...s.roleBadge, background: c.bg, color: c.fg }}>{role}</span>;
}

export default function Statistiche() {
  const app = useRequireApp(true);
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("ALL");
  const [sortBy, setSortBy] = useState<"avg" | "total">("avg");
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!app.ready || !app.activeLeagueCompetitionId) return;
    rpcJson<Row[]>("get_player_stats", { p_league_competition_id: app.activeLeagueCompetitionId }, [])
      .then((r) => setRows(r ?? []))
      .finally(() => setLoading(false));
  }, [app.ready, app.activeLeagueCompetitionId]);

  const ranked = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = rows
      .filter((r) => role === "ALL" || r.role === role)
      .filter((r) => !needle || (r.player_name + " " + (r.team_name ?? "")).toLowerCase().includes(needle));
    const sorted = [...base].sort((a, b) =>
      sortBy === "avg" ? Number(b.avg_points) - Number(a.avg_points) : Number(b.total_points) - Number(a.total_points)
    );
    return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [rows, role, q, sortBy]);

  const metricOf = useCallback(
    (r: Row) =>
      sortBy === "avg"
        ? Number(r.avg_points) || 0
        : Number(r.total_points) || 0,
    [sortBy]
  );
  const maxMetric = useMemo(() => Math.max(1, ...ranked.map((r) => metricOf(r))), [ranked, metricOf]);
  const visible = showAll ? ranked : ranked.slice(0, 20);

  if (!app.ready || loading) return <LoadingScreen />;
  const accent = app.competitionTheme.primary;
  const secondary = "#ea580c";

  return (
    <>
      <AppBar league={app.leagueName} team={app.teamName} onMenuOpen={app.openDrawer} />
      <main style={s.container}>
        <div style={s.head}>
          <CompetitionBadge name={app.competitionName} type={app.competitionType} />
          <h1 style={s.h1}>Statistiche</h1>
          <p style={s.hsub}>{sortBy === "avg" ? "Media punti" : "Punti totali"} per giocatore in questa competizione</p>

          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca giocatore…" style={s.search} />

          <div style={s.roles}>
            {ROLES.map((r) => {
              const active = role === r.k;
              return (
                <button key={r.k} onClick={() => { setRole(r.k); setShowAll(false); }}
                  style={{ ...s.rolePill, ...(active ? { background: accent, color: "white", borderColor: accent } : {}) }}>
                  {r.label}
                </button>
              );
            })}
          </div>

          <div style={s.sortRow}>
            <span style={s.sortLbl}>Ordina per</span>
            <div style={s.toggle}>
              <button onClick={() => setSortBy("avg")} style={{ ...s.tbtn, ...(sortBy === "avg" ? { background: accent, color: "white" } : {}) }}>Media</button>
              <button onClick={() => setSortBy("total")} style={{ ...s.tbtn, ...(sortBy === "total" ? { background: secondary, color: "white" } : {}) }}>Totale</button>
            </div>
          </div>
        </div>

        <div style={s.list}>
          {visible.map((r) => {
            const metric = metricOf(r);
            const w = Math.max(0, Math.min(100, (metric / maxMetric) * 100));
            const rc = RANK_COLOR[r.rank];
            return (
              <button key={r.player_id} style={s.srow} onClick={() => router.push(`/giocatore/${r.player_id}`)}>
                <div style={s.top}>
                  <div style={{ ...s.rank, ...(rc ? { background: rc, color: "white" } : {}) }}>{r.rank}</div>
                  <RoleBadge role={r.role} />
                  <div style={{ minWidth: 0 }}>
                    <div style={s.pn}>{pLabel(r)}</div>
                    <div style={s.pt}>{pSub(r)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ ...s.avg, color: metric >= 0 ? accent : "#dc2626" }}>{fmt(metric)}</div>
                    <div style={s.avgl}>{r.played_count} a voto · {sortBy === "avg" ? `Tot ${fmt(r.total_points)}` : `Media ${fmt(r.avg_points)}`}</div>
                  </div>
                </div>
                <div style={s.bar}><span style={{ ...s.barFill, width: `${w}%` }} /></div>
              </button>
            );
          })}
          {ranked.length === 0 && <div style={s.empty}>Nessun giocatore trovato.</div>}
        </div>

        {!showAll && ranked.length > 20 && (
          <button style={s.showall} onClick={() => setShowAll(true)}>Mostra tutti i giocatori ({ranked.length}) ›</button>
        )}
      </main>
      <BottomNav />
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 520, margin: "0 auto", padding: "12px 12px calc(76px + env(safe-area-inset-bottom, 0px) + 14px)", display: "grid", gap: 8 },
  head: { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, boxShadow: "0 3px 12px rgba(15,23,42,.04)" },
  h1: { fontSize: 19, fontWeight: 1000, color: "#0f172a", margin: "9px 0 1px" },
  hsub: { fontSize: 12, color: "#64748b", fontWeight: 700, margin: 0 },
  search: { width: "100%", marginTop: 10, padding: "9px 11px", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 12.5, fontWeight: 700, fontFamily: "inherit", outline: "none", background: "#fff" },
  roles: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 5, marginTop: 9 },
  rolePill: { border: "1px solid #e5e7eb", background: "white", color: "#475569", borderRadius: 8, padding: "7px 5px", fontWeight: 850, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" },
  sortRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 10 },
  sortLbl: { fontSize: 11, fontWeight: 1000, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".04em" },
  toggle: { marginLeft: "auto", display: "flex", background: "#f1f5f9", borderRadius: 9, padding: 3, gap: 3 },
  tbtn: { border: 0, background: "transparent", color: "#475569", borderRadius: 7, padding: "5px 12px", fontWeight: 850, fontSize: 12, cursor: "pointer", fontFamily: "inherit" },
  list: { display: "grid", gap: 6 },
  srow: { background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 9px", boxShadow: "0 2px 8px rgba(15,23,42,.035)", textAlign: "left", fontFamily: "inherit", cursor: "pointer", overflow: "hidden" },
  top: { display: "grid", gridTemplateColumns: "26px 30px 1fr auto", gap: 8, alignItems: "center" },
  rank: { width: 26, height: 26, borderRadius: 7, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 900, color: "#64748b", background: "#f1f5f9" },
  roleBadge: { width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 11.5, fontWeight: 1000, border: "1px solid rgba(255,255,255,.9)", boxShadow: "0 1px 4px rgba(15,23,42,.08)" },
  pn: { fontSize: 13, fontWeight: 950, color: "#0f172a", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  pt: { fontSize: 10.5, fontWeight: 800, color: "#64748b" },
  avg: { fontSize: 15, fontWeight: 1000, fontVariantNumeric: "tabular-nums" },
  avgl: { fontSize: 9.5, fontWeight: 900, color: "#94a3b8" },
  bar: { height: 3, borderRadius: 3, background: "#eef2f5", marginTop: 7, overflow: "hidden" },
  barFill: { display: "block", height: "100%", borderRadius: 3, background: "linear-gradient(90deg,#15803d,#ea580c)" },
  showall: { width: "100%", background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, fontWeight: 850, color: "#15803d", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" },
  empty: { background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, color: "#64748b", fontWeight: 800 },
};
