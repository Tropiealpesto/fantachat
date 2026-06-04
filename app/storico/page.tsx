"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { useApp } from "../components/AppContext";
import { THEMES, DEFAULT_THEME } from "../page";
import type { CompetitionTheme } from "../page";
import LoadingScreen from "../components/LoadingScreen";

// ─── TIPI ─────────────────────────────────────────────────────────────────────

type StoricoCard = {
  matchday_id: string;
  matchday_number: number;
  status: string;
  total_score: number;
  gk_name: string;
  gk_points: number | null;
  def_name: string;
  def_points: number | null;
  mid_name: string;
  mid_points: number | null;
  fwd_name: string;
  fwd_points: number | null;
};

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  P: { bg: "#fefce8", color: "#a16207" },
  D: { bg: "#e8f5ee", color: "#1a5c33" },
  C: { bg: "#e6f1fb", color: "#0c447c" },
  A: { bg: "#fcebeb", color: "#a32d2d" },
};

// ─── COMPONENTE PRINCIPALE ────────────────────────────────────────────────────

export default function StoricoPage() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamName, openDrawer, competitionSlug } = useApp();

  const theme: CompetitionTheme = THEMES[competitionSlug ?? ""] ?? DEFAULT_THEME;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<StoricoCard[]>([]);

  const lastCardRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    async function run() {
      if (!ready) return;
      if (!userId) { router.replace("/login"); return; }
      if (!activeLeagueId) { router.replace("/seleziona-lega"); return; }

      setLoading(true);
      setErr(null);

      try {
        // 1) Season dalla lega
        const { data: leagueRow } = await supabase
          .from("leagues")
          .select("season_id")
          .eq("id", activeLeagueId)
          .single();

        const seasonId = leagueRow?.season_id;
        if (!seasonId) { setRows([]); setLoading(false); return; }

        // 2) Tutte le giornate della stagione
        const { data: matchdays } = await supabase
          .from("matchdays")
          .select("id, number, status")
          .eq("season_id", seasonId)
          .order("number", { ascending: true });

        if (!matchdays || matchdays.length === 0) {
          setRows([]);
          setLoading(false);
          return;
        }

        // 3) Tutte le lineup dell'utente per questa lega
        const { data: lineups } = await supabase
          .from("lineups")
          .select(`
            id, matchday_id,
            lineup_players(
              role,
              real_players!inner(name),
              scores!left(points)
            )
          `)
          .eq("league_id", activeLeagueId)
          .eq("user_id", userId);

        // 4) Mappa matchday_id → lineup data
        const lineupMap = new Map<string, any[]>();
        for (const lu of (lineups ?? []) as any[]) {
          lineupMap.set(lu.matchday_id, lu.lineup_players ?? []);
        }

        // 5) Costruisci le card
        const cards: StoricoCard[] = [];

        for (const md of matchdays as any[]) {
          const players = lineupMap.get(md.id);
          if (!players) continue; // nessuna lineup per questa giornata

          const byRole: Record<string, { name: string; points: number | null }> = {};
          for (const p of players) {
            byRole[p.role] = {
              name: p.real_players?.name ?? "—",
              points: p.scores?.[0]?.points != null ? Number(p.scores[0].points) : null,
            };
          }

          const gk  = byRole["P"] ?? { name: "—", points: null };
          const def = byRole["D"] ?? { name: "—", points: null };
          const mid = byRole["C"] ?? { name: "—", points: null };
          const fwd = byRole["A"] ?? { name: "—", points: null };

          const total = [gk, def, mid, fwd].reduce(
            (sum, p) => sum + (p.points ?? 0), 0
          );

          cards.push({
            matchday_id: md.id,
            matchday_number: md.number,
            status: md.status,
            total_score: total,
            gk_name: gk.name,   gk_points: gk.points,
            def_name: def.name,  def_points: def.points,
            mid_name: mid.name,  mid_points: mid.points,
            fwd_name: fwd.name,  fwd_points: fwd.points,
          });
        }

        setRows(cards);
        setLoading(false);
      } catch (e: any) {
        setErr(e?.message || String(e));
        setLoading(false);
      }
    }

    run();
  }, [ready, userId, activeLeagueId, router]);

  // Scroll all'ultima giornata
  useEffect(() => {
    if (!loading && rows.length > 0 && lastCardRef.current) {
      lastCardRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading, rows]);

  const subtitle = useMemo(() => {
    if (rows.length === 0) return "Nessuna giornata disponibile";
    return `Le tue giornate · ${rows.length} presenti`;
  }, [rows]);

  if (!ready || loading) return <LoadingScreen />;

  return (
    <>
      <AppBar league={leagueName} team={teamName} onMenuOpen={openDrawer} />

      <main style={s.container}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.headerTitle}>Storico</div>
          <div style={s.headerSub}>{subtitle}</div>
        </div>

        {err && <div style={s.errorMsg}>{err}</div>}

        {rows.length === 0 ? (
          <div style={s.emptyCard}>Nessuna formazione storica disponibile.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((r, idx) => {
              const isLast = idx === rows.length - 1;
              const isFinal = r.status === "completed" || r.status === "locked";

              return (
                <button
                  key={r.matchday_id}
                  ref={isLast ? lastCardRef : null}
                  type="button"
                  onClick={() => router.push(`/storico/${r.matchday_id}`)}
                  style={{
                    ...s.card,
                    border: isFinal
                      ? `1.5px solid ${theme.primary}33`
                      : "1.5px solid #e5e7eb",
                  }}
                >
                  {/* Giornata + punteggio */}
                  <div style={s.cardTop}>
                    <div>
                      <div style={s.cardTitle}>Giornata {r.matchday_number}</div>
                      <div style={s.cardStatus}>{statusLabel(r.status)}</div>
                    </div>
                    <div style={{
                      ...s.scoreBadge,
                      background: isFinal ? `${theme.primary}14` : "#f3f4f6",
                      color: isFinal ? theme.primary : "#6b7280",
                    }}>
                      {fmt(r.total_score)}
                    </div>
                  </div>

                  {/* Giocatori */}
                  <div style={s.players}>
                    <HistoricRow role="P" name={r.gk_name}  points={r.gk_points} />
                    <HistoricRow role="D" name={r.def_name} points={r.def_points} />
                    <HistoricRow role="C" name={r.mid_name} points={r.mid_points} />
                    <HistoricRow role="A" name={r.fwd_name} points={r.fwd_points} />
                  </div>
                </button>
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

function HistoricRow({ role, name, points }: { role: string; name: string; points: number | null }) {
  const colors = ROLE_COLORS[role] ?? { bg: "#f3f4f6", color: "#888" };
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "28px 1fr auto",
      gap: 8, alignItems: "center",
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: colors.bg, color: colors.color,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 900, flexShrink: 0,
      }}>
        {role}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 700, color: "#1a3d2a",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {name}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 900, minWidth: 32, textAlign: "right",
        color: points !== null && points > 0 ? "#1a7a3e"
          : points !== null && points < 0 ? "#a32d2d"
          : "#888",
      }}>
        {signedFmt(points)}
      </div>
    </div>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (!Number.isFinite(n)) return "0";
  return String(Math.round(n * 10) / 10).replace(".", ",");
}

function signedFmt(n: number | null) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const v = Math.round(n * 10) / 10;
  if (v > 0) return `+${String(v).replace(".", ",")}`;
  return String(v).replace(".", ",");
}

function statusLabel(status: string) {
  if (status === "open") return "aperta";
  if (status === "locked") return "chiusa";
  if (status === "completed") return "completata";
  return status || "—";
}

// ─── STILI ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 520, margin: "0 auto",
    padding: "16px 14px calc(64px + env(safe-area-inset-bottom, 0px) + 20px)",
    display: "flex", flexDirection: "column", gap: 12,
  },
  header: {
    background: "white", border: "1.5px solid #c8e6d4",
    borderRadius: 16, padding: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: 900, color: "#1a3d2a" },
  headerSub: { marginTop: 4, color: "#5a8a6e", fontWeight: 700, fontSize: 13 },
  errorMsg: {
    background: "#fff4ea", border: "1px solid #f5c990",
    borderRadius: 12, padding: "12px 14px",
    color: "#b85c0a", fontWeight: 800, fontSize: 13,
  },
  emptyCard: {
    background: "white", border: "1.5px solid #e5e7eb",
    borderRadius: 16, padding: 16,
    color: "#5a8a6e", fontWeight: 700, fontSize: 14,
  },
  card: {
    background: "white", borderRadius: 16, padding: 16,
    textAlign: "left", cursor: "pointer", width: "100%",
    fontFamily: "inherit",
  },
  cardTop: {
    display: "flex", alignItems: "center",
    justifyContent: "space-between", marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: 900, color: "#1a3d2a" },
  cardStatus: { fontSize: 12, fontWeight: 700, color: "#5a8a6e", marginTop: 2 },
  scoreBadge: {
    borderRadius: 12, padding: "6px 14px",
    fontSize: 18, fontWeight: 900,
  },
  players: { display: "grid", gap: 7 },
};
