"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import { useApp } from "../../components/AppContext";
import { THEMES, DEFAULT_THEME } from "../../page";
import type { CompetitionTheme } from "../../page";
import LoadingScreen from "../../components/LoadingScreen";

// ─── TIPI ─────────────────────────────────────────────────────────────────────

type Row = {
  user_id: string;
  team_name: string;
  total_score: number;
  gk_name: string | null;
  gk_points: number;
  def_name: string | null;
  def_points: number;
  mid_name: string | null;
  mid_points: number;
  fwd_name: string | null;
  fwd_points: number;
};

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  P: { bg: "#fefce8", color: "#a16207" },
  D: { bg: "#e8f5ee", color: "#1a5c33" },
  C: { bg: "#e6f1fb", color: "#0c447c" },
  A: { bg: "#fcebeb", color: "#a32d2d" },
};

// ─── COMPONENTE ───────────────────────────────────────────────────────────────

export default function StoricoDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { ready, userId, activeLeagueId, leagueName, teamName, openDrawer, competitionSlug } = useApp();

  const theme: CompetitionTheme = THEMES[competitionSlug ?? ""] ?? DEFAULT_THEME;

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [matchdayNumber, setMatchdayNumber] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const matchdayId = params?.id as string;

  useEffect(() => {
    async function run() {
      if (!ready) return;
      if (!userId) return router.replace("/login");
      if (!activeLeagueId) return router.replace("/seleziona-lega");
      if (!matchdayId) return;

      setLoading(true);
      setErr(null);

      try {
        // 1) Info giornata
        const { data: md } = await supabase
          .from("matchdays")
          .select("number")
          .eq("id", matchdayId)
          .single();

        setMatchdayNumber(md?.number ?? null);

        // 2) Tutti i membri
        const { data: members } = await supabase
          .from("league_members")
          .select("user_id, team_name")
          .eq("league_id", activeLeagueId);

        // 3) Tutte le lineup per questa giornata
        const { data: lineups } = await supabase
          .from("lineups")
          .select(`
            user_id,
            lineup_players(
              role,
              real_players!inner(name),
              scores!left(points)
            )
          `)
          .eq("league_id", activeLeagueId)
          .eq("matchday_id", matchdayId);

        // 4) Costruisci le righe
        const memberMap = new Map<string, string>();
        for (const m of (members ?? []) as any[]) {
          memberMap.set(m.user_id, m.team_name);
        }

        const lineupMap = new Map<string, any[]>();
        for (const lu of (lineups ?? []) as any[]) {
          lineupMap.set(lu.user_id, lu.lineup_players ?? []);
        }

        const result: Row[] = Array.from(memberMap.entries()).map(([uid, teamName]) => {
          const players = lineupMap.get(uid) ?? [];
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

          const total = gk.points + def.points + mid.points + fwd.points;

          return {
            user_id: uid, team_name: teamName,
            total_score: total,
            gk_name: gk.name, gk_points: gk.points,
            def_name: def.name, def_points: def.points,
            mid_name: mid.name, mid_points: mid.points,
            fwd_name: fwd.name, fwd_points: fwd.points,
          };
        }).sort((a, b) => b.total_score - a.total_score);

        setRows(result);
        setLoading(false);
      } catch (e: any) {
        setErr(e?.message || String(e));
        setLoading(false);
      }
    }

    run();
  }, [ready, userId, activeLeagueId, matchdayId, router]);

  if (!ready || loading) return <LoadingScreen />;

  return (
    <>
      <AppBar league={leagueName} team={teamName} onMenuOpen={openDrawer} />

      <main style={s.container}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.headerTitle}>Giornata {matchdayNumber}</div>
          <div style={s.headerSub}>Classifica della giornata</div>
        </div>

        {err && <div style={s.errorMsg}>{err}</div>}

        {/* Lista squadre */}
        <div style={{ display: "grid", gap: 10 }}>
          {rows.map((r, idx) => {
            const isMe = r.user_id === userId;
            const borderLeft = isMe ? `4px solid ${theme.primary}` : "1.5px solid #e5e7eb";

            return (
              <div
                key={r.user_id}
                style={{
                  background: isMe ? `${theme.primary}08` : "white",
                  border: isMe ? `1.5px solid ${theme.primary}33` : "1.5px solid #e5e7eb",
                  borderLeft,
                  borderRadius: 16, padding: 14,
                }}
              >
                {/* Top: rank + nome + totale */}
                <div style={{
                  display: "grid", gridTemplateColumns: "36px 1fr auto",
                  gap: 10, alignItems: "center", marginBottom: 12,
                }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#1a3d2a" }}>
                    #{idx + 1}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#1a3d2a" }}>
                      {r.team_name}
                      {isMe && (
                        <span style={{
                          display: "inline-block", background: theme.primary,
                          color: "white", fontSize: 10, fontWeight: 800,
                          borderRadius: 20, padding: "1px 8px", marginLeft: 6,
                          verticalAlign: "middle",
                        }}>Tu</span>
                      )}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 22, fontWeight: 900,
                    color: isMe ? theme.primary : "#1a3d2a",
                  }}>
                    {fmt(r.total_score)}
                  </div>
                </div>

                {/* Giocatori */}
                <div style={{ display: "grid", gap: 7 }}>
                  <PlayerRow role="P" name={r.gk_name}  points={r.gk_points} />
                  <PlayerRow role="D" name={r.def_name} points={r.def_points} />
                  <PlayerRow role="C" name={r.mid_name} points={r.mid_points} />
                  <PlayerRow role="A" name={r.fwd_name} points={r.fwd_points} />
                </div>
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

function PlayerRow({ role, name, points }: { role: string; name: string | null; points: number }) {
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
        fontSize: 13, fontWeight: 800, color: "#1a3d2a",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {name || "—"}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 900, textAlign: "right", minWidth: 36,
        color: points > 0 ? "#1a7a3e" : points < 0 ? "#a32d2d" : "#888",
      }}>
        {signedFmt(points)}
      </div>
    </div>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return String(Math.round(n * 10) / 10).replace(".", ",");
}

function signedFmt(n: number) {
  const v = Math.round(n * 10) / 10;
  if (v > 0) return `+${String(v).replace(".", ",")}`;
  return String(v).replace(".", ",");
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
  headerTitle: { fontSize: 20, fontWeight: 900, color: "#1a3d2a" },
  headerSub: { fontSize: 12, color: "#5a8a6e", fontWeight: 700, marginTop: 3 },
  errorMsg: {
    background: "#fff4ea", border: "1px solid #f5c990",
    borderRadius: 12, padding: "12px 14px",
    color: "#b85c0a", fontWeight: 800, fontSize: 13,
  },
};
