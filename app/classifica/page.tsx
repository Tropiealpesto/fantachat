"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { useApp } from "../components/AppContext";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import LoadingScreen from "../components/LoadingScreen";

type RoleView = "total" | "gk" | "def" | "mid" | "fwd";
type RangeView = "all" | "10" | "5";

type TableRow = {
  team_id: string;
  team_name: string;
  total_score: number;
  gk_total: number;
  def_total: number;
  mid_total: number;
  fwd_total: number;
};

type SeriesRoleRow = {
  team_id: string;
  team_name: string;
  matchday_number: number;
  gk_cum: number;
  def_cum: number;
  mid_cum: number;
  fwd_cum: number;
  total_cum: number;
};

export default function ClassificaPage() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamId, teamName, openDrawer } = useApp();

  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [table, setTable] = useState<TableRow[]>([]);
  const [series, setSeries] = useState<SeriesRoleRow[]>([]);
  const [roleView, setRoleView] = useState<RoleView>("total");
  const [rangeView, setRangeView] = useState<RangeView>("all");

  useEffect(() => {
    if (!ready) return;
    if (!userId) return router.replace("/login");
    if (!activeLeagueId || !teamId) return router.replace("/seleziona-lega");

    let cancelled = false;
    let timer: any = null;

    async function loadAll() {
      try {
        setLoading(true);
        const { data: tbl, error: tblErr } = await supabase.rpc("get_league_table_with_roles");
        if (!cancelled) {
          if (tblErr) throw tblErr;
          setTable(
            (tbl || []).map((r: any) => ({
              team_id: String(r.team_id),
              team_name: String(r.team_name),
              total_score: Number(r.total_score || 0),
              gk_total: Number(r.gk_total || 0),
              def_total: Number(r.def_total || 0),
              mid_total: Number(r.mid_total || 0),
              fwd_total: Number(r.fwd_total || 0),
            }))
          );
        }

        const { data: s, error: sErr } = await supabase.rpc("get_league_cumulative_series_roles");
        if (!cancelled) {
          if (sErr) throw sErr;
          setSeries((s || []) as any);
        }

        if (!cancelled) {
          setUpdatedAt(new Date().toLocaleTimeString());
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    timer = setInterval(loadAll, 20000);
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [ready, userId, activeLeagueId, teamId, router]);

  const chartData = useMemo(() => {
    if (!series.length) return [];
    const teams = Array.from(new Set(series.map((r) => r.team_name)));
    const byMatch: Record<number, Record<string, number>> = {};
    for (const r of series) {
      const md = Number(r.matchday_number);
      if (!byMatch[md]) byMatch[md] = {};
      let v = 0;
      if (roleView === "total") v = Number(r.total_cum);
      if (roleView === "gk")    v = Number(r.gk_cum);
      if (roleView === "def")   v = Number(r.def_cum);
      if (roleView === "mid")   v = Number(r.mid_cum);
      if (roleView === "fwd")   v = Number(r.fwd_cum);
      byMatch[md][r.team_name] = v;
    }
    let matchdays = Object.keys(byMatch).map(Number).sort((a, b) => a - b);
    if (rangeView !== "all") {
      const n = rangeView === "10" ? 10 : 5;
      matchdays = matchdays.slice(Math.max(0, matchdays.length - n));
    }
    const last: Record<string, number> = {};
    return matchdays.map((md) => {
      const row: any = { matchday: md };
      for (const tn of teams) {
        const v = byMatch[md]?.[tn];
        if (typeof v === "number") last[tn] = v;
        row[tn] = last[tn] ?? 0;
      }
      return row;
    });
  }, [series, roleView, rangeView]);

  const teamNames = useMemo(
    () => Array.from(new Set(series.map((r) => r.team_name))).sort(),
    [series]
  );

  const myTeamNameInTable = useMemo(
    () => table.find((x) => x.team_id === teamId)?.team_name ?? "",
    [table, teamId]
  );

  const colorFor = (name: string) => {
    const palette = ["#22c55e", "#f97316", "#3b82f6", "#a855f7", "#ef4444", "#0ea5e9", "#84cc16", "#db2777"];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  };

  if (!ready || loading) return <LoadingScreen />;
  
  const myRank = table.findIndex((r) => r.team_id === teamId) + 1;
  const myStats = table.find((r) => r.team_id === teamId);

  const rankMedal = (i: number) => {
    if (i === 0) return "🥇";
    if (i === 1) return "🥈";
    if (i === 2) return "🥉";
    return String(i + 1);
  };

  return (
    <>
      <AppBar league={leagueName} team={teamName} onMenuOpen={openDrawer} />

      <main style={s.container}>

        {/* ── PAGE HEADER ── */}
        <div style={s.pageHeader}>
          <div style={s.pageTitle}>Classifica</div>
          {updatedAt && (
            <div style={s.updatedBadge}>
              <div style={s.liveDot} />
              {updatedAt}
            </div>
          )}
        </div>

        {/* ── CHART CARD ── */}
        <div style={s.card}>
          <div style={s.chartTop}>
            <div>
              <div style={s.chartTitle}>Storico stagione</div>
              <div style={s.chartSub}>Punteggio cumulativo</div>
            </div>
            {/* range filters */}
            <div style={s.filterGroup}>
              <FilterPill active={rangeView === "all"} onClick={() => setRangeView("all")}>Tutte</FilterPill>
              <FilterPill active={rangeView === "10"} onClick={() => setRangeView("10")}>Ult. 10</FilterPill>
              <FilterPill active={rangeView === "5"} onClick={() => setRangeView("5")}>Ult. 5</FilterPill>
            </div>
          </div>

          {/* role filters */}
          <div style={s.roleFilters}>
            {(["total","gk","def","mid","fwd"] as RoleView[]).map((r) => (
              <RolePill key={r} active={roleView === r} onClick={() => setRoleView(r)}>
                {r === "total" ? "Tot" : r === "gk" ? "P" : r === "def" ? "D" : r === "mid" ? "C" : "A"}
              </RolePill>
            ))}
          </div>

          {/* chart */}
          {chartData.length === 0 ? (
            <div style={{ color: "#6b7280", fontWeight: 600, marginTop: 12, fontSize: 14 }}>
              Nessun dato ancora.
            </div>
          ) : (
            <div style={{ marginTop: 14, width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <XAxis
                    dataKey="matchday"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 10,
                      fontSize: 12,
                      color: "#fff",
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.5)", marginBottom: 4 }}
                    labelFormatter={(l) => `Giornata ${l}`}
                    formatter={(v: any) => fmt(Number(v))}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    formatter={(value) => (
                      <span style={{ color: value === myTeamNameInTable ? "#15803d" : "#6b7280", fontWeight: value === myTeamNameInTable ? 700 : 500 }}>
                        {value}
                      </span>
                    )}
                  />
                  {teamNames.map((tn) => (
                    <Line
                      key={tn}
                      type="monotone"
                      dataKey={tn}
                      dot={false}
                      strokeWidth={tn === myTeamNameInTable ? 3 : 1.5}
                      stroke={colorFor(tn)}
                      opacity={tn === myTeamNameInTable ? 1 : 0.55}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ── TABLE CARD ── */}
        <div style={{ ...s.card, padding: 0, overflow: "hidden" }}>
          <div style={s.tableHeader}>
            <div style={s.tableTitle}>FantaChat Campionato</div>
          </div>

          {/* col headers */}
          <div style={s.colHeader}>
            <div style={{ ...s.colCell, textAlign: "center" }}>#</div>
            <div style={{ ...s.colCell, textAlign: "left", flex: 1 }}>Squadra</div>
            <div style={s.colCell}>Tot</div>
            <div style={s.colCell}>P</div>
            <div style={s.colCell}>D</div>
            <div style={s.colCell}>C</div>
            <div style={s.colCell}>A</div>
          </div>

          {table.length === 0 && (
            <div style={{ padding: 16, color: "#6b7280", fontSize: 14 }}>Nessun dato.</div>
          )}

          {table.map((r, idx) => {
            const isMine = r.team_id === teamId;
            const isBottom = idx >= table.length - 2;
            return (
              <div
                key={r.team_id}
                style={{
                  ...s.tableRow,
                  ...(isMine ? s.rowMe : isBottom ? s.rowDanger : {}),
                  borderLeft: isMine ? "3px solid #16a34a" : isBottom ? "3px solid #ea580c" : "3px solid transparent",
                }}
              >
                <div style={{ ...s.rankCell, color: isMine ? "#15803d" : isBottom ? "#ea580c" : "#9ca3af" }}>
                  {rankMedal(idx)}
                </div>
                <div style={{ ...s.teamCell, flex: 1, color: isMine ? "#15803d" : isBottom ? "#ea580c" : "#111827", fontWeight: isMine ? 700 : 600 }}>
                  {r.team_name}{isMine ? " ✦" : ""}
                </div>
                <div style={{ ...s.totCell, color: isMine ? "#15803d" : isBottom ? "#ea580c" : "#111827" }}>
                  {fmt(r.total_score)}
                </div>
                <div style={subStyle(r.gk_total)}>{fmt(r.gk_total)}</div>
                <div style={subStyle(r.def_total)}>{fmt(r.def_total)}</div>
                <div style={subStyle(r.mid_total)}>{fmt(r.mid_total)}</div>
                <div style={subStyle(r.fwd_total)}>{fmt(r.fwd_total)}</div>
              </div>
            );
          })}
        </div>

      </main>

      <BottomNav />
    </>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      background: active ? "#16a34a" : "#f1f5f1",
      border: active ? "1.5px solid #16a34a" : "1.5px solid #e5e7eb",
      color: active ? "white" : "#6b7280",
      borderRadius: 50,
      padding: "5px 11px",
      fontSize: 11,
      fontWeight: 700,
      cursor: "pointer",
      transition: "all 0.15s",
    }}>
      {children}
    </button>
  );
}

function RolePill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      background: active ? "#dcfce7" : "#f9fafb",
      border: active ? "1.5px solid #16a34a" : "1.5px solid #e5e7eb",
      color: active ? "#15803d" : "#6b7280",
      borderRadius: 8,
      padding: "5px 14px",
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
      transition: "all 0.15s",
    }}>
      {children}
    </button>
  );
}

// ─── HELPERS ──────────────────────────────────────────────

function fmt(n: number) {
  const s = Math.round((Number(n) || 0) * 10) / 10;
  return String(s).replace(".", ",");
}

function subStyle(v: number): React.CSSProperties {
  return {
    fontSize: 12,
    fontWeight: 600,
    textAlign: "right" as const,
    color: v > 0 ? "#15803d" : v < 0 ? "#ea580c" : "#9ca3af",
    minWidth: 32,
    paddingRight: 4,
  };
}

// ─── STYLES ───────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 520,
    margin: "0 auto",
    padding: "16px 14px calc(64px + env(safe-area-inset-bottom, 0px) + 20px)",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  /* page header */
  pageHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 2px" },
  pageTitle: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 26,
    fontWeight: 800,
    color: "#111827",
    letterSpacing: -0.5,
    borderLeft: "4px solid #ea580c",
    paddingLeft: 12,
  },
  updatedBadge: {
    display: "flex", alignItems: "center", gap: 5,
    background: "#dcfce7", border: "1px solid #86efac",
    borderRadius: 50, padding: "5px 12px",
    fontSize: 11, fontWeight: 700, color: "#15803d",
  },
  liveDot: {
    width: 7, height: 7, background: "#16a34a", borderRadius: "50%",
    animation: "blink 1.5s infinite",
  },

  /* card */
  card: {
    background: "#ffffff",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 4px 16px rgba(0,0,0,0.07)",
    border: "1px solid #e5e7eb",
  },

  /* chart */
  chartTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  chartTitle: { fontSize: 15, fontWeight: 700, color: "#111827" },
  chartSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  filterGroup: { display: "flex", gap: 5, flexShrink: 0 },
  roleFilters: { display: "flex", gap: 6, paddingTop: 12, borderTop: "1px solid #e5e7eb" },

  /* table */
  tableHeader: { padding: "16px 16px 14px", borderBottom: "1px solid #e5e7eb" },
  tableTitle: { fontSize: 15, fontWeight: 700, color: "#111827" },

  colHeader: {
    display: "grid",
    gridTemplateColumns: "36px 1fr 46px 32px 32px 32px 32px",
    padding: "8px 14px",
    background: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
  },
  colCell: {
    fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const,
    letterSpacing: "0.8px", color: "#6b7280", textAlign: "right" as const,
  },

  tableRow: {
    display: "grid",
    gridTemplateColumns: "36px 1fr 46px 32px 32px 32px 32px",
    padding: "12px 14px",
    alignItems: "center",
    borderBottom: "1px solid #f3f4f6",
  },

  rowMe: { background: "linear-gradient(90deg, rgba(22,163,74,0.07) 0%, transparent 80%)" },
  rowDanger: { background: "linear-gradient(90deg, rgba(234,88,12,0.05) 0%, transparent 80%)" },

  rankCell: { fontSize: 14, fontWeight: 700, textAlign: "center" as const },
  teamCell: { fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  totCell: { fontSize: 14, fontWeight: 700, textAlign: "right" as const },
};
