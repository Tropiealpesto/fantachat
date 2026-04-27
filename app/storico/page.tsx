"use client";
 
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { useApp } from "../components/AppContext";
import LoadingScreen from "../components/LoadingScreen";
 
type MatchdayRow = {
  id: string;
  number: number;
  status: string;
};
 
type ScoreRow = {
  matchday_id: string;
  total_score: number | null;
  gk_vote: number | null;
  def_vote: number | null;
  mid_vote: number | null;
  fwd_vote: number | null;
  gk_player_id: string | null;
  def_player_id: string | null;
  mid_player_id: string | null;
  fwd_player_id: string | null;
};
 
type StoricoCard = {
  matchday_id: string;
  matchday_number: number;
  status: string;
  total_score: number;
  gk_name: string;
  gk_vote: number | null;
  def_name: string;
  def_vote: number | null;
  mid_name: string;
  mid_vote: number | null;
  fwd_name: string;
  fwd_vote: number | null;
};
 
const roleColors: Record<string, { bg: string; color: string }> = {
  P: { bg: "#fefce8", color: "#a16207" },
  D: { bg: "#e8f5ee", color: "#1a5c33" },
  C: { bg: "#e6f1fb", color: "#0c447c" },
  A: { bg: "#fcebeb", color: "#a32d2d" },
};
 
export default function StoricoPage() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamId, teamName, openDrawer } = useApp();
 
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<StoricoCard[]>([]);
 
  const lastCardRef = useRef<HTMLButtonElement | null>(null);
 
  useEffect(() => {
    async function run() {
      if (!ready) return;
      if (!userId) { router.replace("/login"); return; }
      if (!activeLeagueId || !teamId) { router.replace("/seleziona-lega"); return; }
 
      setLoading(true);
      setErr(null);
 
      const { data: scores, error: scoresErr } = await supabase
        .from("matchday_team_scores")
        .select(`matchday_id, total_score, gk_vote, def_vote, mid_vote, fwd_vote, gk_player_id, def_player_id, mid_player_id, fwd_player_id`)
        .eq("league_id", activeLeagueId)
        .eq("team_id", teamId);
 
      if (scoresErr) { setErr(scoresErr.message); setLoading(false); return; }
 
      const scoreRows = ((scores || []) as ScoreRow[]) ?? [];
 
      if (scoreRows.length === 0) { setRows([]); setLoading(false); return; }
 
      const matchdayIds = [...new Set(scoreRows.map((r) => r.matchday_id))];
      const playerIds = [
        ...new Set(scoreRows.flatMap((r) => [r.gk_player_id, r.def_player_id, r.mid_player_id, r.fwd_player_id]).filter(Boolean)),
      ] as string[];
 
      const { data: matchdays, error: mdErr } = await supabase
        .from("matchdays")
        .select("id, number, status")
        .eq("league_id", activeLeagueId)
        .in("id", matchdayIds)
        .order("number", { ascending: true });
 
      if (mdErr) { setErr(mdErr.message); setLoading(false); return; }
 
      const playerMap = new Map<string, string>();
      if (playerIds.length > 0) {
        const { data: players, error: pErr } = await supabase.from("players").select("id, name").in("id", playerIds);
        if (pErr) { setErr(pErr.message); setLoading(false); return; }
        (players || []).forEach((p: any) => playerMap.set(String(p.id), String(p.name)));
      }
 
      const mdMap = new Map<string, MatchdayRow>();
      ((matchdays || []) as MatchdayRow[]).forEach((m) => mdMap.set(m.id, m));
 
      const merged: StoricoCard[] = scoreRows
        .map((r) => {
          const md = mdMap.get(r.matchday_id);
          if (!md) return null;
          return {
            matchday_id: r.matchday_id,
            matchday_number: md.number,
            status: md.status,
            total_score: Number(r.total_score || 0),
            gk_name: r.gk_player_id ? playerMap.get(r.gk_player_id) || "—" : "—",
            gk_vote: r.gk_vote,
            def_name: r.def_player_id ? playerMap.get(r.def_player_id) || "—" : "—",
            def_vote: r.def_vote,
            mid_name: r.mid_player_id ? playerMap.get(r.mid_player_id) || "—" : "—",
            mid_vote: r.mid_vote,
            fwd_name: r.fwd_player_id ? playerMap.get(r.fwd_player_id) || "—" : "—",
            fwd_vote: r.fwd_vote,
          };
        })
        .filter((x): x is StoricoCard => x !== null)
        .sort((a, b) => a.matchday_number - b.matchday_number);
 
      setRows(merged);
      setLoading(false);
    }
 
    run();
  }, [ready, userId, activeLeagueId, teamId, router]);
 
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
 
      <main className="container" style={{ paddingBottom: 100, fontFamily: "'Nunito', sans-serif" }}>
 
        {/* Header */}
        <div style={{
          background: "white",
          border: "1.5px solid #c8e6d4",
          borderRadius: 16,
          padding: 16,
          marginTop: 12,
        }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#1a3d2a" }}>Storico</div>
          <div style={{ marginTop: 4, color: "#5a8a6e", fontWeight: 700, fontSize: 13 }}>{subtitle}</div>
        </div>
 
        {/* Errore */}
        {err && (
          <div style={{
            marginTop: 12,
            background: "#fff4ea",
            border: "1px solid #f5c990",
            borderRadius: 12,
            padding: "12px 14px",
            color: "#b85c0a",
            fontWeight: 800,
            fontSize: 13,
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}>
            {err}
          </div>
        )}
 
        {/* Lista giornate */}
        {rows.length === 0 ? (
          <div style={{
            background: "white",
            border: "1.5px solid #e5e7eb",
            borderRadius: 16,
            padding: 16,
            marginTop: 12,
            color: "#5a8a6e",
            fontWeight: 700,
            fontSize: 14,
          }}>
            Nessuna formazione storica disponibile.
          </div>
        ) : (
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {rows.map((r, idx) => {
              const isLast = idx === rows.length - 1;
              const isFinal = r.status === "final";
              const isOpen = r.status === "open";
 
              return (
                <button
                  key={r.matchday_id}
                  ref={isLast ? lastCardRef : null}
                  type="button"
                  onClick={() => router.push(`/storico/${r.matchday_id}`)}
                  style={{
                    background: "white",
                    border: `1.5px solid ${isFinal ? "#c8e6d4" : isOpen ? "#f5c990" : "#e5e7eb"}`,
                    borderRadius: 16,
                    padding: 16,
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: "'Nunito', sans-serif",
                    width: "100%",
                  }}
                >
                  {/* Giornata + punteggio */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#1a3d2a" }}>
                        Giornata {r.matchday_number}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#5a8a6e", marginTop: 2 }}>
                        {statusLabel(r.status)}
                      </div>
                    </div>
                    <div style={{
                      background: isFinal ? "#e8f5ee" : isOpen ? "#fff4ea" : "#f3f4f6",
                      color: isFinal ? "#1a5c33" : isOpen ? "#b85c0a" : "#888",
                      borderRadius: 12,
                      padding: "6px 14px",
                      fontSize: 18,
                      fontWeight: 900,
                    }}>
                      {fmt(r.total_score)}
                    </div>
                  </div>
 
                  {/* Giocatori */}
                  <div style={{ display: "grid", gap: 7 }}>
                    <HistoricRow role="P" name={r.gk_name} vote={r.gk_vote} />
                    <HistoricRow role="D" name={r.def_name} vote={r.def_vote} />
                    <HistoricRow role="C" name={r.mid_name} vote={r.mid_vote} />
                    <HistoricRow role="A" name={r.fwd_name} vote={r.fwd_vote} />
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
 
function HistoricRow({ role, name, vote }: { role: string; name: string; vote: number | null }) {
  const colors = roleColors[role] || { bg: "#f3f4f6", color: "#888" };
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "28px 1fr auto",
      gap: 8,
      alignItems: "center",
    }}>
      <div style={{
        width: 28, height: 28,
        borderRadius: 7,
        background: colors.bg,
        color: colors.color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 900,
        flexShrink: 0,
      }}>
        {role}
      </div>
      <div style={{
        fontSize: 13,
        fontWeight: 800,
        color: "#1a3d2a",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {name}
      </div>
      <div style={{
        fontSize: 13,
        fontWeight: 900,
        color: vote !== null && vote > 0 ? "#1a7a3e" : vote !== null && vote < 0 ? "#a32d2d" : "#888",
        minWidth: 32,
        textAlign: "right",
      }}>
        {signedFmt(vote)}
      </div>
    </div>
  );
}
 
function fmt(n: number) {
  if (!Number.isFinite(n)) return "0";
  return (Math.round(n * 10) / 10).toString().replace(".", ",");
}
 
function signedFmt(n: number | null) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const v = Math.round(n * 10) / 10;
  if (v > 0) return `+${String(v).replace(".", ",")}`;
  return String(v).replace(".", ",");
}
 
function statusLabel(status: string) {
  if (status === "open") return "aperta";
  if (status === "closed") return "chiusa";
  if (status === "final") return "finale";
  return status || "—";
}