"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { useApp } from "../components/AppContext";
import { THEMES, DEFAULT_THEME } from "../page";
import type { CompetitionTheme } from "../page";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import LoadingScreen from "../components/LoadingScreen";

type RoleView = "total" | "P" | "D" | "C" | "A";
type RangeView = "all" | "10" | "5";

type TableRow = {
  user_id: string;
  team_name: string;
  total_score: number;
  p_total: number;
  d_total: number;
  c_total: number;
  a_total: number;
};

type SeriesRow = {
  user_id: string;
  team_name: string;
  matchday_number: number;
  p_cum: number;
  d_cum: number;
  c_cum: number;
  a_cum: number;
  total_cum: number;
};

export default function ClassificaPage() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamName, openDrawer, competitionSlug } = useApp();

  const theme: CompetitionTheme = THEMES[competitionSlug ?? ""] ?? DEFAULT_THEME;

  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState("");
  const [table, setTable] = useState<TableRow[]>([]);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [roleView, setRoleView] = useState<RoleView>("total");
  const [rangeView, setRangeView] = useState<RangeView>("all");

  useEffect(() => {
    if (!ready) return;
    if (!userId) return router.replace("/login");
    if (!activeLeagueId) return router.replace("/seleziona-lega");

    let cancelled = false;
    let timer: any = null;

    async function loadAll() {
      try {
        setLoading(true);

        // 1) Season dalla lega
        const { data: leagueRow } = await supabase
          .from("leagues")
          .select("season_id")
          .eq("id", activeLeagueId)
          .single();

        const seasonId = leagueRow?.season_id;
        if (!seasonId) { if (!cancelled) setLoading(false); return; }

        // 2) Tutti i membri della lega
        const { data: members } = await supabase
          .from("league_members")
          .select("user_id, team_name")
          .eq("league_id", activeLeagueId);

        if (!members || cancelled) { if (!cancelled) setLoading(false); return; }

        // 3) Tutte le giornate completate
        const { data: matchdays } = await supabase
          .from("matchdays")
          .select("id, number")
          .eq("season_id", seasonId)
          .in("status", ["completed", "locked"])
          .order("number", { ascending: true });

        const mdMap = new Map<string, number>();
        for (const md of (matchdays ?? []) as any[]) {
          mdMap.set(md.id, md.number);
        }

        // 4) Tutti i punteggi
        const { data: allScores } = await supabase
          .from("scores")
          .select(`
            points, role,
            lineup_players!inner(
              lineups!inner(user_id, matchday_id, league_id)
            )
          `)
          .eq("lineup_players.lineups.league_id", activeLeagueId);

        // 5) Aggrega per utente
        const userTotals = new Map<string, { total: number; P: number; D: number; C: number; A: number }>();
        // Per il grafico: utente → giornata → { total, P, D, C, A }
        const userMatchday = new Map<string, Map<number, { total: number; P: number; D: number; C: number; A: number }>>();

        for (const score of (allScores ?? []) as any[]) {
          const uid = score.lineup_players?.lineups?.user_id;
          const mdId = score.lineup_players?.lineups?.matchday_id;
          const role = score.role as string;
          const pts = Number(score.points ?? 0);
          const mdNum = mdMap.get(mdId);

          if (!uid || !mdNum) continue;

          // Totali
          if (!userTotals.has(uid)) userTotals.set(uid, { total: 0, P: 0, D: 0, C: 0, A: 0 });
          const ut = userTotals.get(uid)!;
          ut.total += pts;
          if (role in ut) (ut as any)[role] += pts;

          // Per giornata
          if (!userMatchday.has(uid)) userMatchday.set(uid, new Map());
          const mdMap2 = userMatchday.get(uid)!;
          if (!mdMap2.has(mdNum)) mdMap2.set(mdNum, { total: 0, P: 0, D: 0, C: 0, A: 0 });
          const md2 = mdMap2.get(mdNum)!;
          md2.total += pts;
          if (role in md2) (md2 as any)[role] += pts;
        }

        // 6) Costruisci tabella
        const memberMap = new Map<string, string>();
        for (const m of members as any[]) memberMap.set(m.user_id, m.team_name);

        const tableRows: TableRow[] = Array.from(memberMap.entries()).map(([uid, name]) => {
          const t = userTotals.get(uid) ?? { total: 0, P: 0, D: 0, C: 0, A: 0 };
          return {
            user_id: uid,
            team_name: name,
            total_score: t.total,
            p_total: t.P,
            d_total: t.D,
            c_total: t.C,
            a_total: t.A,
          };
        }).sort((a, b) => b.total_score - a.total_score);

        if (!cancelled) setTable(tableRows);

        // 7) Costruisci serie cumulativa per il grafico
        const allMatchdayNums = Array.from(new Set(
          Array.from(userMatchday.values()).flatMap(m => Array.from(m.keys()))
        )).sort((a, b) => a - b);

        const seriesRows: SeriesRow[] = [];
        for (const [uid, mdScores] of userMatchday.entries()) {
          let cumT = 0, cumP = 0, cumD = 0, cumC = 0, cumA = 0;
          for (const mdNum of allMatchdayNums) {
            const s = mdScores.get(mdNum);
            if (s) {
              cumT += s.total; cumP += s.P; cumD += s.D; cumC += s.C; cumA += s.A;
            }
            seriesRows.push({
              user_id: uid,
              team_name: memberMap.get(uid) ?? "—",
              matchday_number: mdNum,
              total_cum: cumT, p_cum: cumP, d_cum: cumD, c_cum: cumC, a_cum: cumA,
            });
          }
        }

        if (!cancelled) {
          setSeries(seriesRows);
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
  }, [ready, userId, activeLeagueId, router]);

  // ─── CHART DATA ─────────────────────────────────────────────────────────────

  const chartData = useMemo(() => {
    if (!series.length) return [];
    const teams = Array.from(new Set(series.map(r => r.team_name)));
    const byMatch: Record<number, Record<string, number>> = {};

    for (const r of series) {
      const md = r.matchday_number;
      if (!byMatch[md]) byMatch[md] = {};
      let v = r.total_cum;
      if (roleView === "P") v = r.p_cum;
      if (roleView === "D") v = r.d_cum;
      if (roleView === "C") v = r.c_cum;
      if (roleView === "A") v = r.a_cum;
      byMatch[md][r.team_name] = v;
    }

    let matchdays = Object.keys(byMatch).map(Number).sort((a, b) => a - b);
    if (rangeView !== "all") {
      const n = rangeView === "10" ? 10 : 5;
      matchdays = matchdays.slice(Math.max(0, matchdays.length - n));
    }

    const last: Record<string, number> = {};
    return matchdays.map(md => {
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
    () => Array.from(new Set(series.map(r => r.team_name))).sort(),
    [series]
  );

  const myTeamName = useMemo(
    () => table.find(x => x.user_id === userId)?.team_name ?? "",
    [table, userId]
  );

  const colorFor = (name: string) => {
    const palette = ["#22c55e", "#f97316", "#3b82f6", "#a855f7", "#ef4444", "#0ea5e9", "#84cc16", "#db2777"];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  };

  if (!ready || loading) return <LoadingScreen />;

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
        {/* Header */}
        <div style={s.pageHeader}>
          <div style={s.pageTitle}>Classifica</div>
          {updatedAt && (
            <div style={s.updatedBadge}>
              <div style={s.liveDot} />
              {updatedAt}
            </div>
          )}
        </div>

        {/* Chart */}
        <div style={s.card}>
          <div style={s.chartTop}>
            <div>
              <div style={s.chartTitle}>Storico stagione</div>
              <div style={s.chartSub}>Punteggio cumulativo</div>
            </div>
            <div style={s.filterGroup}>
              <FilterPill active={rangeView === "all"} onClick={() => setRangeView("all")} theme={theme}>Tutte</FilterPill>
              <FilterPill active={rangeView === "10"} onClick={() => setRangeView("10")} theme={theme}>Ult. 10</FilterPill>
              <FilterPill active={rangeView === "5"} onClick={() => setRangeView("5")} theme={theme}>Ult. 5</FilterPill>
            </div>
          </div>

          <div style={s.roleFilters}>
            {(["total", "P", "D", "C", "A"] as RoleView[]).map(r => (
              <RolePill key={r} active={roleView === r} onClick={() => setRoleView(r)} theme={theme}>
                {r === "total" ? "Tot" : r}
              </RolePill>
            ))}
          </div>

          {chartData.length === 0 ? (
            <div style={{ color: "#6b7280", fontWeight: 600, marginTop: 12, fontSize: 14 }}>
              Nessun dato ancora.
            </div>
          ) : (
            <div style={{ marginTop: 14, width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <XAxis dataKey="matchday" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a", border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 10, fontSize: 12, color: "#fff",
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.5)", marginBottom: 4 }}
                    labelFormatter={l => `Giornata ${l}`}
                    formatter={(v: any) => fmt(Number(v))}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                    formatter={value => (
                      <span style={{
                        color: value === myTeamName ? theme.primary : "#6b7280",
                        fontWeight: value === myTeamName ? 700 : 500,
                      }}>
                        {value}
                      </span>
                    )}
                  />
                  {teamNames.map(tn => (
                    <Line
                      key={tn} type="monotone" dataKey={tn} dot={false}
                      strokeWidth={tn === myTeamName ? 3 : 1.5}
                      stroke={colorFor(tn)}
                      opacity={tn === myTeamName ? 1 : 0.55}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Tabella */}
        <div style={{ ...s.card, padding: 0, overflow: "hidden" }}>
          <div style={s.tableHeader}>
            <div style={s.tableTitle}>FantaChat Campionato</div>
          </div>

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
            const isMine = r.user_id === userId;
            const isBottom = idx >= table.length - 2;
            const accentColor = isMine ? theme.primary : isBottom ? "#ea580c" : "transparent";

            return (
              <div
                key={r.user_id}
                style={{
                  ...s.tableRow,
                  background: isMine
                    ? `linear-gradient(90deg, ${theme.primary}12 0%, transparent 80%)`
                    : isBottom
                    ? "linear-gradient(90deg, rgba(234,88,12,0.05) 0%, transparent 80%)"
                    : "transparent",
                  borderLeft: `3px solid ${accentColor}`,
                }}
              >
                <div style={{ ...s.rankCell, color: isMine ? theme.primary : isBottom ? "#ea580c" : "#9ca3af" }}>
                  {rankMedal(idx)}
                </div>
                <div style={{
                  ...s.teamCell, flex: 1,
                  color: isMine ? theme.primary : isBottom ? "#ea580c" : "#111827",
                  fontWeight: isMine ? 700 : 600,
                }}>
                  {r.team_name}{isMine ? " ✦" : ""}
                </div>
                <div style={{
                  ...s.totCell,
                  color: isMine ? theme.primary : isBottom ? "#ea580c" : "#111827",
                }}>
                  {fmt(r.total_score)}
                </div>
                <div style={subStyle(r.p_total)}>{fmt(r.p_total)}</div>
                <div style={subStyle(r.d_total)}>{fmt(r.d_total)}</div>
                <div style={subStyle(r.c_total)}>{fmt(r.c_total)}</div>
                <div style={subStyle(r.a_total)}>{fmt(r.a_total)}</div>
              </div>
            );
          })}
        </div>
      </main>

      <BottomNav />
    </>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function FilterPill({ active, onClick, children, theme }: {
  active: boolean; onClick: () => void; children: React.ReactNode; theme: CompetitionTheme;
}) {
  return (
    <button onClick={onClick} style={{
      background: active ? theme.primary : "#f1f5f1",
      border: active ? `1.5px solid ${theme.primary}` : "1.5px solid #e5e7eb",
      color: active ? "white" : "#6b7280",
      borderRadius: 50, padding: "5px 11px",
      fontSize: 11, fontWeight: 700, cursor: "pointer",
    }}>
      {children}
    </button>
  );
}

function RolePill({ active, onClick, children, theme }: {
  active: boolean; onClick: () => void; children: React.ReactNode; theme: CompetitionTheme;
}) {
  return (
    <button onClick={onClick} style={{
      background: active ? `${theme.primary}1A` : "#f9fafb",
      border: active ? `1.5px solid ${theme.primary}` : "1.5px solid #e5e7eb",
      color: active ? theme.primary : "#6b7280",
      borderRadius: 8, padding: "5px 14px",
      fontSize: 12, fontWeight: 700, cursor: "pointer",
    }}>
      {children}
    </button>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  const s = Math.round((Number(n) || 0) * 10) / 10;
  return String(s).replace(".", ",");
}

function subStyle(v: number): React.CSSProperties {
  return {
    fontSize: 12, fontWeight: 600, textAlign: "right",
    color: v > 0 ? "#15803d" : v < 0 ? "#ea580c" : "#9ca3af",
    minWidth: 32, paddingRight: 4,
  };
}

// ─── STILI ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 520, margin: "0 auto",
    padding: "16px 14px calc(64px + env(safe-area-inset-bottom, 0px) + 20px)",
    display: "flex", flexDirection: "column", gap: 14,
  },
  pageHeader: {
    display: "flex", justifyContent: "space-between",
    alignItems: "center", padding: "4px 2px",
  },
  pageTitle: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 26, fontWeight: 800, color: "#111827",
    letterSpacing: -0.5,
    borderLeft: "4px solid #ea580c", paddingLeft: 12,
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
  card: {
    background: "#ffffff", borderRadius: 18, padding: 18,
    boxShadow: "0 4px 16px rgba(0,0,0,0.07)",
    border: "1px solid #e5e7eb",
  },
  chartTop: {
    display: "flex", justifyContent: "space-between",
    alignItems: "flex-start", gap: 10, marginBottom: 12,
  },
  chartTitle: { fontSize: 15, fontWeight: 700, color: "#111827" },
  chartSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  filterGroup: { display: "flex", gap: 5, flexShrink: 0 },
  roleFilters: {
    display: "flex", gap: 6, paddingTop: 12,
    borderTop: "1px solid #e5e7eb",
  },
  tableHeader: { padding: "16px 16px 14px", borderBottom: "1px solid #e5e7eb" },
  tableTitle: { fontSize: 15, fontWeight: 700, color: "#111827" },
  colHeader: {
    display: "grid",
    gridTemplateColumns: "36px 1fr 46px 32px 32px 32px 32px",
    padding: "8px 14px",
    background: "#f9fafb", borderBottom: "1px solid #e5e7eb",
  },
  colCell: {
    fontSize: 10, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.8px", color: "#6b7280", textAlign: "right",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "36px 1fr 46px 32px 32px 32px 32px",
    padding: "12px 14px", alignItems: "center",
    borderBottom: "1px solid #f3f4f6",
  },
  rankCell: { fontSize: 14, fontWeight: 700, textAlign: "center" },
  teamCell: {
    fontSize: 13, overflow: "hidden",
    textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  totCell: { fontSize: 14, fontWeight: 700, textAlign: "right" },
};
