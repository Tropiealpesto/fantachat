"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { useApp } from "../components/AppContext";
import { THEMES, DEFAULT_THEME } from "../page";
import type { CompetitionTheme } from "../page";
import LoadingScreen from "../components/LoadingScreen";

// ─── TIPI ─────────────────────────────────────────────────────────────────────

type StatRow = {
  player_id: string;
  player_name: string;
  role: string;
  team_name: string;
  played_count: number;
  total_points: number;
  avg_points: number;
  best_points: number;
  worst_points: number;
};

// ─── COMPONENTE PRINCIPALE ────────────────────────────────────────────────────

export default function StatistichePage() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamName, openDrawer, competitionSlug } = useApp();

  const theme: CompetitionTheme = THEMES[competitionSlug ?? ""] ?? DEFAULT_THEME;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<StatRow[]>([]);

  useEffect(() => {
    async function run() {
      if (!ready) return;
      if (!userId) return router.replace("/login");
      if (!activeLeagueId) return router.replace("/seleziona-lega");

      setLoading(true);
      setErr(null);

      try {
        // 1) Season + competition dalla lega
        const { data: leagueRow } = await supabase
          .from("leagues")
          .select("season_id, seasons!inner(competition_id)")
          .eq("id", activeLeagueId)
          .single();

        const seasonId = leagueRow?.season_id;
        const competitionId = (leagueRow as any)?.seasons?.competition_id;
        if (!seasonId || !competitionId) { setLoading(false); return; }

        // 2) Giornate completate
        const { data: matchdays } = await supabase
          .from("matchdays")
          .select("id")
          .eq("season_id", seasonId)
          .in("status", ["completed", "locked"]);

        const mdIds = (matchdays ?? []).map((m: any) => m.id);
        if (mdIds.length === 0) { setRows([]); setLoading(false); return; }

        // 3) Tutti i scores per questa lega
        const { data: allScores } = await supabase
          .from("scores")
          .select(`
            points, role, real_player_id,
            lineup_players!inner(
              real_player_id,
              real_players!inner(name, team, role),
              lineups!inner(matchday_id, league_id)
            )
          `)
          .eq("lineup_players.lineups.league_id", activeLeagueId);

        // 4) Aggrega per giocatore
        const playerStats = new Map<string, {
          name: string; role: string; team: string;
          points: number[]; total: number;
        }>();

        for (const score of (allScores ?? []) as any[]) {
          const mdId = score.lineup_players?.lineups?.matchday_id;
          if (!mdIds.includes(mdId)) continue;

          const pid = score.lineup_players?.real_player_id ?? score.real_player_id;
          const pts = Number(score.points ?? 0);
          const pInfo = score.lineup_players?.real_players;

          if (!pid || !pInfo) continue;

          if (!playerStats.has(pid)) {
            playerStats.set(pid, {
              name: pInfo.name ?? "—",
              role: pInfo.role ?? "",
              team: pInfo.team ?? "",
              points: [],
              total: 0,
            });
          }

          const ps = playerStats.get(pid)!;
          ps.points.push(pts);
          ps.total += pts;
        }

        // 5) Costruisci le righe
        const statRows: StatRow[] = Array.from(playerStats.entries()).map(([pid, ps]) => {
          const played = ps.points.length;
          const avg = played > 0 ? ps.total / played : 0;
          const best = played > 0 ? Math.max(...ps.points) : 0;
          const worst = played > 0 ? Math.min(...ps.points) : 0;

          return {
            player_id: pid,
            player_name: ps.name,
            role: ps.role,
            team_name: ps.team,
            played_count: played,
            total_points: ps.total,
            avg_points: avg,
            best_points: best,
            worst_points: worst,
          };
        });

        setRows(statRows);
        setLoading(false);
      } catch (e: any) {
        setErr(e?.message || String(e));
        setLoading(false);
      }
    }

    run();
  }, [ready, userId, activeLeagueId, router]);

  // ─── FILTRI E CLASSIFICHE ───────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      r.player_name.toLowerCase().includes(q) ||
      r.team_name.toLowerCase().includes(q)
    );
  }, [rows, query]);

  const topAvg = useMemo(
    () => [...rows].sort((a, b) => b.avg_points - a.avg_points).slice(0, 10),
    [rows]
  );

  const topBest = useMemo(
    () => [...rows].sort((a, b) => b.best_points - a.best_points).slice(0, 10),
    [rows]
  );

  const topWorst = useMemo(
    () => [...rows].sort((a, b) => a.worst_points - b.worst_points).slice(0, 10),
    [rows]
  );

  if (!ready || loading) return <LoadingScreen />;

  return (
    <>
      <AppBar league={leagueName} team={teamName} onMenuOpen={openDrawer} />

      <main style={s.container}>
        {/* Header + Search */}
        <div style={s.headerCard}>
          <div style={s.pageTitle}>Statistiche</div>
          <div style={s.pageSubtitle}>
            Cerca un giocatore o consulta le classifiche della lega
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca giocatore o squadra..."
            style={s.searchInput}
          />
        </div>

        {err && <div style={s.errorMsg}>{err}</div>}

        {/* Risultati ricerca */}
        {query.trim() !== "" && (
          <StatsBlock
            title="Risultati ricerca"
            subtitle={`${filtered.length} giocatori trovati`}
            rows={filtered.slice(0, 20)}
            statLabel="Pt medio"
            getValue={(r) => fmt(r.avg_points)}
            theme={theme}
            onRowClick={(id) => router.push(`/giocatore/${id}`)}
          />
        )}

        {/* Top Pt medio */}
        <StatsBlock
          title="Top Pt medio"
          subtitle="I giocatori più affidabili della lega"
          rows={topAvg}
          statLabel="Pt medio"
          getValue={(r) => fmt(r.avg_points)}
          theme={theme}
          highlightFirst
          onRowClick={(id) => router.push(`/giocatore/${id}`)}
        />

        {/* Miglior picco */}
        <StatsBlock
          title="Miglior picco"
          subtitle="I migliori punteggi singoli"
          rows={topBest}
          statLabel="Best"
          getValue={(r) => signedFmt(r.best_points)}
          theme={theme}
          highlightFirst
          onRowClick={(id) => router.push(`/giocatore/${id}`)}
        />

        {/* Flop */}
        <StatsBlock
          title="Flop"
          subtitle="I peggiori punteggi singoli"
          rows={topWorst}
          statLabel="Worst"
          getValue={(r) => signedFmt(r.worst_points)}
          theme={theme}
          isNegative
          onRowClick={(id) => router.push(`/giocatore/${id}`)}
        />
      </main>

      <BottomNav />
    </>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function StatsBlock({ title, subtitle, rows, statLabel, getValue, theme, highlightFirst, isNegative, onRowClick }: {
  title: string;
  subtitle: string;
  rows: StatRow[];
  statLabel: string;
  getValue: (r: StatRow) => string;
  theme: CompetitionTheme;
  highlightFirst?: boolean;
  isNegative?: boolean;
  onRowClick: (playerId: string) => void;
}) {
  return (
    <div style={s.card}>
      <div style={s.cardTitle}>{title}</div>
      <div style={s.cardSubtitle}>{subtitle}</div>

      <div style={{ display: "grid", gap: 8 }}>
        {rows.length === 0 ? (
          <div style={{ color: "#6b7280", fontWeight: 600 }}>Nessun dato.</div>
        ) : (
          rows.map((r, idx) => {
            const isFirst = idx === 0 && highlightFirst;
            const statColor = isNegative
              ? "#c2410c"
              : isFirst
              ? theme.primary
              : "#111827";

            return (
              <button
                key={`${title}-${r.player_id}`}
                type="button"
                onClick={() => onRowClick(r.player_id)}
                style={s.rowBtn}
              >
                <div style={{ fontWeight: 700, color: "#9ca3af", minWidth: 28 }}>
                  #{idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 700, color: "#111827",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {r.player_name}
                  </div>
                  <div style={{ marginTop: 2, color: "#6b7280", fontWeight: 600, fontSize: 12 }}>
                    {roleLabel(r.role)}
                    {r.team_name ? ` · ${r.team_name}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ color: "#6b7280", fontWeight: 700, fontSize: 11 }}>
                    {statLabel}
                  </div>
                  <div style={{ marginTop: 2, fontWeight: 800, fontSize: 18, color: statColor }}>
                    {getValue(r)}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n: number | null) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return String(Math.round(n * 10) / 10).replace(".", ",");
}

function signedFmt(n: number | null) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const v = Math.round(n * 10) / 10;
  if (v > 0) return `+${String(v).replace(".", ",")}`;
  return String(v).replace(".", ",");
}

function roleLabel(role: string) {
  if (role === "P") return "Portiere";
  if (role === "D") return "Difensore";
  if (role === "C") return "Centrocampista";
  if (role === "A") return "Attaccante";
  return role || "—";
}

// ─── STILI ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 520, margin: "0 auto",
    padding: "16px 14px calc(64px + env(safe-area-inset-bottom, 0px) + 20px)",
    display: "flex", flexDirection: "column", gap: 14,
  },
  headerCard: {
    background: "#fff", borderRadius: 18, padding: 16,
    boxShadow: "0 4px 16px rgba(0,0,0,0.07)",
    border: "1px solid #e5e7eb",
  },
  pageTitle: { fontSize: 22, fontWeight: 800, color: "#111827" },
  pageSubtitle: { marginTop: 4, color: "#6b7280", fontWeight: 600, fontSize: 13 },
  searchInput: {
    width: "100%", marginTop: 14, padding: 14,
    borderRadius: 14, border: "1px solid #e5e7eb",
    fontWeight: 700, background: "#f9fafb",
    fontSize: 14, fontFamily: "inherit",
    boxSizing: "border-box" as const,
  },
  errorMsg: {
    padding: 14, borderRadius: 14, border: "1px solid #fecaca",
    background: "#fff1f2", color: "#991b1b", fontWeight: 700, fontSize: 14,
  },
  card: {
    background: "#fff", borderRadius: 18, padding: 16,
    boxShadow: "0 4px 16px rgba(0,0,0,0.07)",
    border: "1px solid #e5e7eb",
  },
  cardTitle: { fontSize: 18, fontWeight: 800, color: "#111827" },
  cardSubtitle: { marginTop: 4, color: "#6b7280", fontWeight: 600, fontSize: 13, marginBottom: 12 },
  rowBtn: {
    display: "grid", gridTemplateColumns: "28px 1fr auto",
    gap: 10, alignItems: "center",
    padding: 12, borderRadius: 12,
    border: "1px solid #e5e7eb", background: "white",
    cursor: "pointer", width: "100%", textAlign: "left",
    fontFamily: "inherit",
  },
};
