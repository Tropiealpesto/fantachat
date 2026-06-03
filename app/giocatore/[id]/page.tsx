"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import { useApp } from "../../components/AppContext";
import { THEMES, DEFAULT_THEME } from "../../page";
import type { CompetitionTheme } from "../../page";

// ─── TIPI ─────────────────────────────────────────────────────────────────────

type HistoryRow = {
  matchday_id: string;
  matchday_number: number;
  points: number;
};

type PlayerCard = {
  player_id: string;
  player_name: string;
  role: string;
  team_name: string;
  avg_points: number;
  best_points: number;
  worst_points: number;
  played_count: number;
  history: HistoryRow[];
};

// ─── COMPONENTE ───────────────────────────────────────────────────────────────

export default function GiocatorePage() {
  const router = useRouter();
  const params = useParams();
  const { ready, userId, activeLeagueId, leagueName, teamName, openDrawer, competitionSlug } = useApp();

  const theme: CompetitionTheme = THEMES[competitionSlug ?? ""] ?? DEFAULT_THEME;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [card, setCard] = useState<PlayerCard | null>(null);

  const playerId = params?.id as string;

  useEffect(() => {
    async function run() {
      if (!ready || !userId || !activeLeagueId || !playerId) return;

      setLoading(true);
      setErr(null);

      try {
        // 1) Info giocatore
        const { data: playerRow } = await supabase
          .from("real_players")
          .select("id, name, role, team")
          .eq("id", playerId)
          .single();

        if (!playerRow) { setCard(null); setLoading(false); return; }

        // 2) Season dalla lega
        const { data: leagueRow } = await supabase
          .from("leagues")
          .select("season_id")
          .eq("id", activeLeagueId)
          .single();

        const seasonId = leagueRow?.season_id;

        // 3) Giornate completate
        const { data: matchdays } = await supabase
          .from("matchdays")
          .select("id, number")
          .eq("season_id", seasonId)
          .in("status", ["completed", "locked"])
          .order("number", { ascending: true });

        const mdMap = new Map<string, number>();
        for (const md of (matchdays ?? []) as any[]) mdMap.set(md.id, md.number);

        // 4) Scores di questo giocatore in questa lega
        const { data: scores } = await supabase
          .from("scores")
          .select(`
            points,
            lineup_players!inner(
              lineups!inner(matchday_id, league_id)
            )
          `)
          .eq("real_player_id", playerId)
          .eq("lineup_players.lineups.league_id", activeLeagueId);

        const history: HistoryRow[] = [];
        const allPoints: number[] = [];

        for (const s of (scores ?? []) as any[]) {
          const mdId = s.lineup_players?.lineups?.matchday_id;
          const mdNum = mdMap.get(mdId);
          if (!mdNum) continue;

          const pts = Number(s.points ?? 0);
          allPoints.push(pts);
          history.push({ matchday_id: mdId, matchday_number: mdNum, points: pts });
        }

        history.sort((a, b) => b.matchday_number - a.matchday_number);

        const played = allPoints.length;
        const total = allPoints.reduce((s, p) => s + p, 0);
        const avg = played > 0 ? total / played : 0;
        const best = played > 0 ? Math.max(...allPoints) : 0;
        const worst = played > 0 ? Math.min(...allPoints) : 0;

        setCard({
          player_id: playerRow.id,
          player_name: playerRow.name,
          role: playerRow.role,
          team_name: playerRow.team ?? "",
          avg_points: avg,
          best_points: best,
          worst_points: worst,
          played_count: played,
          history,
        });

        setLoading(false);
      } catch (e: any) {
        setErr(e?.message || String(e));
        setLoading(false);
      }
    }

    run();
  }, [ready, userId, activeLeagueId, playerId, router]);

  if (!ready || loading) return <main style={{ padding: 20 }}>Caricamento...</main>;

  return (
    <>
      <AppBar league={leagueName} team={teamName} onMenuOpen={openDrawer} />

      <main style={s.container}>
        {err && <div style={s.errorMsg}>{err}</div>}

        {!card ? (
          <div style={s.card}>Giocatore non trovato.</div>
        ) : (
          <>
            {/* Info giocatore */}
            <div style={s.card}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#111827" }}>{card.player_name}</div>
              <div style={{ marginTop: 6, color: "#6b7280", fontWeight: 700 }}>
                {roleLabel(card.role)}{card.team_name ? ` · ${card.team_name}` : ""}
              </div>
            </div>

            {/* KPI */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              <KpiCard label="Pt medio" value={fmt(card.avg_points)} theme={theme} />
              <KpiCard label="Migliore" value={signedFmt(card.best_points)} positive />
              <KpiCard label="Peggiore" value={signedFmt(card.worst_points)} negative />
            </div>

            {/* Storico */}
            <div style={s.card}>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#111827" }}>Storico</div>
              <div style={{ marginTop: 6, color: "#6b7280", fontWeight: 700, marginBottom: 12 }}>
                {card.played_count} giornate giocate
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {card.history.length === 0 ? (
                  <div style={{ color: "#6b7280", fontWeight: 700 }}>Nessun dato disponibile.</div>
                ) : (
                  card.history.map((h) => (
                    <button
                      key={h.matchday_id}
                      type="button"
                      onClick={() => router.push(`/storico/${h.matchday_id}`)}
                      style={s.historyRow}
                    >
                      <div style={{ fontWeight: 700, color: "#111827" }}>Giornata {h.matchday_number}</div>
                      <div style={{
                        fontWeight: 800,
                        color: h.points > 0 ? "#15803d" : h.points < 0 ? "#c2410c" : "#6b7280",
                      }}>
                        {signedFmt(h.points)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function KpiCard({ label, value, theme, positive, negative }: {
  label: string; value: string; theme?: CompetitionTheme; positive?: boolean; negative?: boolean;
}) {
  let color = "#111827";
  if (theme) color = theme.primary;
  if (positive) color = "#15803d";
  if (negative) color = "#c2410c";

  return (
    <div style={{
      background: "#fff", borderRadius: 14, padding: 14,
      border: "1px solid #e5e7eb",
    }}>
      <div style={{ color: "#6b7280", fontWeight: 700, fontSize: 12 }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 20, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (!Number.isFinite(n)) return "—";
  return String(Math.round(n * 10) / 10).replace(".", ",");
}

function signedFmt(n: number) {
  if (!Number.isFinite(n)) return "—";
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
    display: "flex", flexDirection: "column", gap: 12,
  },
  card: {
    background: "#fff", borderRadius: 18, padding: 16,
    border: "1px solid #e5e7eb",
  },
  errorMsg: {
    padding: 14, borderRadius: 14, border: "1px solid #fecaca",
    background: "#fff1f2", color: "#991b1b", fontWeight: 700,
  },
  historyRow: {
    display: "grid", gridTemplateColumns: "1fr auto",
    gap: 10, alignItems: "center",
    padding: 12, borderRadius: 12,
    border: "1px solid #e5e7eb", background: "white",
    cursor: "pointer", width: "100%", textAlign: "left",
    fontFamily: "inherit",
  },
};