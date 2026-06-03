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

type LiveRow = {
  user_id: string;
  team_name: string;
  camp_total: number;    // classifica prima della giornata
  live_score: number;    // punti di questa giornata
  live_total: number;    // camp_total + live_score
  old_rank: number;      // posizione prima della giornata
  live_rank: number;     // posizione attuale (calcolata da live_total)
  gk_name: string | null;
  gk_points: number;
  def_name: string | null;
  def_points: number;
  mid_name: string | null;
  mid_points: number;
  fwd_name: string | null;
  fwd_points: number;
};

type Matchday = {
  id: string;
  number: number;
  status: string;
};

// ─── COMPONENTE PRINCIPALE ────────────────────────────────────────────────────

export default function LivePage() {
  const router = useRouter();
 const { ready, userId, activeLeagueId, leagueName, teamName, openDrawer, competitionSlug } = useApp();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LiveRow[]>([]);
  const [matchday, setMatchday] = useState<Matchday | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const theme: CompetitionTheme = THEMES[competitionSlug ?? ""] ?? DEFAULT_THEME;

  async function refresh() {
    if (!activeLeagueId) return;
    setErr(null);

    try {
      // 1) Trova la season della lega
      const { data: leagueRow } = await supabase
        .from("leagues")
        .select("season_id")
        .eq("id", activeLeagueId)
        .single();

      if (!leagueRow?.season_id) return;

      // 2) Giornata open (o ultima completata)
      const { data: openMd } = await supabase
        .from("matchdays")
        .select("id, number, status")
        .eq("season_id", leagueRow.season_id)
        .eq("status", "open")
        .order("number", { ascending: false })
        .limit(1)
        .maybeSingle();

      let activeMd: Matchday | null = null;

      if (openMd) {
        activeMd = openMd;
      } else {
        // Ultima giornata completata
        const { data: lastMd } = await supabase
          .from("matchdays")
          .select("id, number, status")
          .eq("season_id", leagueRow.season_id)
          .eq("status", "completed")
          .order("number", { ascending: false })
          .limit(1)
          .maybeSingle();

        activeMd = lastMd ?? null;
      }

      setMatchday(activeMd);

      if (!activeMd) {
        setRows([]);
        return;
      }

      // 3) Tutti i membri della lega
      const { data: members } = await supabase
        .from("league_members")
        .select("user_id, team_name")
        .eq("league_id", activeLeagueId);

      if (!members || members.length === 0) {
        setRows([]);
        return;
      }

      // 4) Classifica campionato (prima della giornata) — dalla tabella standings
      const standingsMap = new Map<string, number>();
      const { data: standings } = await supabase
        .from("standings")
        .select("user_id, total_points")
        .eq("league_id", activeLeagueId);

      for (const s of (standings ?? []) as any[]) {
        standingsMap.set(s.user_id, Number(s.total_points ?? 0));
      }

      // 5) Lineup + giocatori + score per questa giornata
      const { data: lineups } = await supabase
        .from("lineups")
        .select(`
          id, user_id,
          lineup_players(
            role,
            real_players!inner(name),
            scores!left(points)
          )
        `)
        .eq("league_id", activeLeagueId)
        .eq("matchday_id", activeMd.id);

      // 6) Costruisci le righe
      const lineupMap = new Map<string, any>();
      for (const lu of (lineups ?? []) as any[]) {
        lineupMap.set(lu.user_id, lu.lineup_players ?? []);
      }

      // Calcola camp_total: per la giornata open è il totale standings MENO i punti live
      // Per la giornata completata, camp_total = standings totale (live_score già incluso)
      // Soluzione: calcoliamo live_score dalla lineup, e camp_total = standings - live_score (se open)

      const rawRows: LiveRow[] = members.map((m: any) => {
        const players = lineupMap.get(m.user_id) ?? [];
        const byRole: Record<string, { name: string; points: number }> = {};

        for (const p of players) {
          byRole[p.role] = {
            name: p.real_players?.name ?? "—",
            points: Number(p.scores?.[0]?.points ?? 0),
          };
        }

        const gk  = byRole["P"] ?? { name: null, points: 0 };
        const def = byRole["D"] ?? { name: null, points: 0 };
        const mid = byRole["C"] ?? { name: null, points: 0 };
        const fwd = byRole["A"] ?? { name: null, points: 0 };

        const liveScore = gk.points + def.points + mid.points + fwd.points;
        const standingsTotal = standingsMap.get(m.user_id) ?? 0;

        // Camp = classifica prima della giornata
        // Se la giornata è open, standings potrebbe non includere ancora i punti live
        // Se completed, standings include tutto → camp = standings - live
        const campTotal = activeMd!.status === "completed"
          ? standingsTotal - liveScore
          : standingsTotal;

        const liveTotal = campTotal + liveScore;

        return {
          user_id: m.user_id,
          team_name: m.team_name ?? "—",
          camp_total: campTotal,
          live_score: liveScore,
          live_total: liveTotal,
          old_rank: 0,
          live_rank: 0,
          gk_name: gk.name,
          gk_points: gk.points,
          def_name: def.name,
          def_points: def.points,
          mid_name: mid.name,
          mid_points: mid.points,
          fwd_name: fwd.name,
          fwd_points: fwd.points,
        };
      });

      // Calcola old_rank (ordine per camp_total)
      const sortedByCamp = [...rawRows].sort((a, b) => b.camp_total - a.camp_total);
      sortedByCamp.forEach((r, i) => { r.old_rank = i + 1; });

      // Calcola live_rank (ordine per live_total)
      const sortedByLive = [...rawRows].sort((a, b) => b.live_total - a.live_total);
      sortedByLive.forEach((r, i) => { r.live_rank = i + 1; });

      setRows(sortedByLive);
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }

  // Caricamento iniziale
  useEffect(() => {
    async function run() {
      if (!ready) return;
      if (!userId) return router.replace("/login");
      if (!activeLeagueId || !userId) return router.replace("/seleziona-lega");

      await refresh();
      setLoading(false);
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, userId, activeLeagueId, userId]);

  // Auto-refresh ogni 15 secondi
  useEffect(() => {
    if (!ready || !activeLeagueId) return;
    const id = window.setInterval(() => { refresh(); }, 15000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, activeLeagueId]);

  const titleLabel = useMemo(() => {
    if (!matchday) return "Classifica campionato";
    return matchday.status === "open"
      ? `Classifica campionato live · Giornata ${matchday.number}`
      : `Classifica campionato · Giornata ${matchday.number}`;
  }, [matchday]);

  if (!ready || loading) return <LoadingScreen />;

  return (
    <>
      <AppBar
        league={leagueName}
        team={teamName}
        onMenuOpen={openDrawer}
        right={
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            background: `${theme.primary}1F`,
            border: `1px solid ${theme.primary}4D`,
            borderRadius: 20, padding: "4px 10px",
            fontSize: 11, fontWeight: 700, color: theme.primary,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: theme.primary, display: "inline-block",
              animation: matchday?.status === "open" ? "blink 1.2s infinite" : "none",
            }} />
            LIVE
          </div>
        }
      />

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }`}</style>

      <main style={s.container}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.pageTitle}>Live</div>
          <div style={s.subtitle}>{titleLabel}</div>
        </div>

        {err && <div style={s.errorCard}>Errore: {err}</div>}

        {rows.length === 0 ? (
          <div style={s.emptyCard}>Nessun dato disponibile.</div>
        ) : (
          <div style={s.cardList}>
            {rows.map((r) => {
              const isMe = r.user_id === userId;
              const movement = r.live_rank < r.old_rank
                ? "up"
                : r.live_rank > r.old_rank
                ? "down"
                : "same";

              const borderLeftColor =
                movement === "up" ? theme.primary
                : movement === "down" ? "#ea580c"
                : "transparent";

              return (
                <div
                  key={r.user_id}
                  style={{
                    ...s.card,
                    borderLeft: `3px solid ${borderLeftColor}`,
                    background: isMe ? `${theme.primary}0A` : "#fff",
                    border: isMe
                      ? `1px solid ${theme.primary}4D`
                      : "1px solid #e5e7eb",
                    borderLeftWidth: 3,
                    borderLeftStyle: "solid",
                    borderLeftColor: borderLeftColor,
                  }}
                >
                  {/* Riga sommario */}
                  <div style={s.summaryRow}>
                    <div style={{
                      ...s.rank,
                      color: isMe ? theme.primary : "#9ca3af",
                    }}>
                      #{r.live_rank}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: 16, fontWeight: 700,
                        color: isMe ? theme.primary : "#111827",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {r.team_name}
                        {isMe && (
                          <span style={{
                            fontSize: 10, background: theme.primary, color: "white",
                            borderRadius: 20, padding: "1px 7px",
                            verticalAlign: "middle", marginLeft: 4,
                          }}>Tu</span>
                        )}
                      </div>
                      <div style={s.metaRow}>
                        <span>Campionato {fmt(r.camp_total)}</span>
                        <span style={{
                          color: r.live_score > 0 ? "#15803d"
                            : r.live_score < 0 ? "#c2410c"
                            : "#6b7280",
                        }}>
                          Live {signedFmt(r.live_score)}
                        </span>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{
                        fontSize: 22, fontWeight: 700,
                        color: isMe ? theme.primary : "#111827",
                      }}>
                        {fmt(r.live_total)}
                      </div>
                      <div style={s.totalLabel}>totale live</div>
                    </div>

                    <div style={{ width: 22, textAlign: "center", fontSize: 18, fontWeight: 700 }}>
                      {movement === "up" ? (
                        <span style={{ color: theme.primary }}>↑</span>
                      ) : movement === "down" ? (
                        <span style={{ color: "#ea580c" }}>↓</span>
                      ) : null}
                    </div>
                  </div>

                  {/* Giocatori */}
                  <div style={{
                    ...s.playersSection,
                    borderTopColor: isMe ? `${theme.primary}33` : "#e5e7eb",
                  }}>
                    <PlayerRow role="P" name={r.gk_name}  points={r.gk_points} />
                    <PlayerRow role="D" name={r.def_name} points={r.def_points} />
                    <PlayerRow role="C" name={r.mid_name} points={r.mid_points} />
                    <PlayerRow role="A" name={r.fwd_name} points={r.fwd_points} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function PlayerRow({ role, name, points }: { role: string; name: string | null; points: number }) {
  const hasVote = points !== 0 || name;
  const color = points > 0 ? "#15803d" : points < 0 ? "#c2410c" : "#6b7280";

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "18px 1fr auto",
      gap: 8, fontSize: 13, alignItems: "center",
    }}>
      <span style={{ color: "#9ca3af", fontWeight: 700 }}>{role}</span>
      <span style={{
        color: "#6b7280", fontWeight: 500,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {name ?? "—"}
      </span>
      <span style={{ fontWeight: 700, color }}>
        {hasVote ? signedFmt(points) : "—"}
      </span>
    </div>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 10) / 10).replace(".", ",");
}

function signedFmt(n: number) {
  if (!Number.isFinite(n)) return "0";
  const v = Math.round(n * 10) / 10;
  if (v > 0) return `+${String(v).replace(".", ",")}`;
  return String(v).replace(".", ",");
}

// ─── STILI ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 520,
    margin: "0 auto",
    padding: "16px 14px calc(64px + env(safe-area-inset-bottom, 0px) + 20px)",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  header: {
    background: "#fff",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 4px 16px rgba(0,0,0,0.07)",
    border: "1px solid #e5e7eb",
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: "#111827",
  },
  subtitle: {
    marginTop: 6,
    color: "#6b7280",
    fontWeight: 600,
    fontSize: 13,
  },
  errorCard: {
    padding: 14,
    borderRadius: 14,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#991b1b",
    fontWeight: 700,
    fontSize: 14,
  },
  emptyCard: {
    background: "#fff",
    borderRadius: 18,
    padding: 16,
    border: "1px solid #e5e7eb",
    color: "#6b7280",
    fontWeight: 600,
  },
  cardList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  card: {
    borderRadius: 18,
    padding: 14,
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  summaryRow: {
    display: "grid",
    gridTemplateColumns: "44px 1fr auto 22px",
    gap: 8,
    alignItems: "center",
  },
  rank: {
    fontSize: 22,
    fontWeight: 800,
  },
  metaRow: {
    marginTop: 4,
    display: "flex",
    gap: 10,
    flexWrap: "wrap" as const,
    color: "#6b7280",
    fontWeight: 600,
    fontSize: 12,
  },
  totalLabel: {
    color: "#6b7280",
    fontWeight: 600,
    fontSize: 11,
  },
  playersSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTop: "1px solid #e5e7eb",
    display: "grid",
    gap: 6,
  },
};
