"use client";
 
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import { useApp } from "../../components/AppContext";
import LoadingScreen from "../../components/LoadingScreen";
 
type Row = {
  team_id: string;
  team_name: string;
  base_total: number;
  live_score: number;
  live_total: number;
  old_rank: number;
  live_rank: number;
  gk_name: string | null;
  gk_vote: number;
  def_name: string | null;
  def_vote: number;
  mid_name: string | null;
  mid_vote: number;
  fwd_name: string | null;
  fwd_vote: number;
};
 
type Matchday = {
  id: string;
  number: number;
  status: string;
};
 
const roleColors: Record<string, { bg: string; color: string }> = {
  P: { bg: "#fefce8", color: "#a16207" },
  D: { bg: "#e8f5ee", color: "#1a5c33" },
  C: { bg: "#e6f1fb", color: "#0c447c" },
  A: { bg: "#fcebeb", color: "#a32d2d" },
};
 
export default function StoricoDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { ready, userId, activeLeagueId, teamId, leagueName, teamName } = useApp();
 
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [matchday, setMatchday] = useState<Matchday | null>(null);
  const [err, setErr] = useState<string | null>(null);
 
  const matchdayId = params?.id as string;
 
  useEffect(() => {
    async function run() {
      if (!ready) return;
      if (!userId) return router.replace("/login");
      if (!activeLeagueId || !teamId) return router.replace("/seleziona-lega");
      if (!matchdayId) return;
 
      setLoading(true);
      setErr(null);
 
      const { data: md, error: mdErr } = await supabase
        .from("matchdays")
        .select("id, number, status")
        .eq("id", matchdayId)
        .maybeSingle();
 
      if (mdErr) { setErr(mdErr.message); setLoading(false); return; }
      setMatchday(md as any);
 
      const { data, error } = await supabase.rpc("get_league_scores", {
        p_matchday_id: matchdayId,
      });
 
      if (error) { setErr(error.message); setRows([]); setLoading(false); return; }
 
      const normalized: Row[] = (data || []).map((r: any) => ({
        team_id: String(r.team_id),
        team_name: String(r.team_name),
        base_total: Number(r.base_total || 0),
        live_score: Number(r.live_score || 0),
        live_total: Number(r.live_total || 0),
        old_rank: Number(r.old_rank || 0),
        live_rank: Number(r.live_rank || 0),
        gk_name: r.gk_name,
        gk_vote: Number(r.gk_vote || 0),
        def_name: r.def_name,
        def_vote: Number(r.def_vote || 0),
        mid_name: r.mid_name,
        mid_vote: Number(r.mid_vote || 0),
        fwd_name: r.fwd_name,
        fwd_vote: Number(r.fwd_vote || 0),
      }));
 
      setRows(normalized);
      setLoading(false);
    }
 
    run();
  }, [ready, userId, activeLeagueId, teamId, matchdayId, router]);
 
  if (!ready || loading) {
    return <LoadingScreen />;
  }
 
  return (
    <>
      <AppBar league={leagueName} team={teamName} />
 
      <main className="container" style={{ fontFamily: "'Nunito', sans-serif", paddingBottom: 100 }}>
 
        {/* Header */}
        <div style={{
          background: "white",
          border: "1.5px solid #c8e6d4",
          borderRadius: 16,
          padding: 16,
          marginTop: 12,
        }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#1a3d2a" }}>
            Giornata {matchday?.number}
          </div>
          <div style={{ fontSize: 12, color: "#5a8a6e", fontWeight: 700, marginTop: 3 }}>
            Classifica della giornata
          </div>
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
          }}>
            {err}
          </div>
        )}
 
        {/* Lista squadre */}
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {rows.map((r) => {
            const movement = r.live_rank < r.old_rank ? "up" : r.live_rank > r.old_rank ? "down" : "same";
            const isMe = r.team_id === teamId;
 
            const borderColor = movement === "up" ? "#1a7a3e" : movement === "down" ? "#e07b1a" : "#e5e7eb";
            const borderLeft = movement !== "same" ? `4px solid ${borderColor}` : "1.5px solid #e5e7eb";
 
            return (
              <div
                key={r.team_id}
                style={{
                  background: isMe ? "#f0faf4" : "white",
                  border: isMe ? "1.5px solid #a3d9b8" : "1.5px solid #e5e7eb",
                  borderLeft,
                  borderRadius: 16,
                  padding: 14,
                }}
              >
                {/* Top row: rank + nome + totale */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "36px 1fr auto",
                  gap: 10,
                  alignItems: "center",
                  marginBottom: 12,
                }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#1a3d2a" }}>
                    #{r.live_rank}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#1a3d2a" }}>
                      {r.team_name}
                      {isMe && (
                        <span style={{
                          display: "inline-block",
                          background: "#1a7a3e",
                          color: "white",
                          fontSize: 10,
                          fontWeight: 800,
                          borderRadius: 20,
                          padding: "1px 8px",
                          marginLeft: 6,
                          verticalAlign: "middle",
                          textTransform: "uppercase",
                          letterSpacing: "0.3px",
                        }}>Tu</span>
                      )}
                    </div>
 
                  </div>
                  <div style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: isMe ? "#1a7a3e" : "#1a3d2a",
                  }}>
                    {fmt(r.gk_vote + r.def_vote + r.mid_vote + r.fwd_vote || r.live_total)}
                  </div>
                </div>
 
                {/* Giocatori */}
                <div style={{ display: "grid", gap: 7 }}>
                  <PlayerRow role="P" name={r.gk_name} vote={r.gk_vote} />
                  <PlayerRow role="D" name={r.def_name} vote={r.def_vote} />
                  <PlayerRow role="C" name={r.mid_name} vote={r.mid_vote} />
                  <PlayerRow role="A" name={r.fwd_name} vote={r.fwd_vote} />
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
 
function PlayerRow({ role, name, vote }: { role: string; name: string | null; vote: number }) {
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
        {name || "—"}
      </div>
      <div style={{
        fontSize: 13,
        fontWeight: 900,
        textAlign: "right",
        minWidth: 36,
        color: vote > 0 ? "#1a7a3e" : vote < 0 ? "#a32d2d" : "#888",
      }}>
        {signedFmt(vote)}
      </div>
    </div>
  );
}
 
function fmt(n: number) {
  return (Math.round(n * 10) / 10).toString().replace(".", ",");
}
 
function signedFmt(n: number) {
  const v = Math.round(n * 10) / 10;
  if (v > 0) return `+${String(v).replace(".", ",")}`;
  return String(v).replace(".", ",");
}