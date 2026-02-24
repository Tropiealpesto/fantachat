"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { useApp } from "../components/AppContext";

type ScoreRow = {
  team_id: string;
  team_name: string;

  gk_name: string; gk_vote: number;
  def_name: string; def_vote: number;
  mid_name: string; mid_vote: number;
  fwd_name: string; fwd_vote: number;

  total_score: number;
};

export default function LivePage() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamId, teamName } = useApp();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ScoreRow[]>([]);
  const [matchdayNumber, setMatchdayNumber] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  useEffect(() => {
    if (!ready) return;

    if (!userId) {
      router.replace("/login");
      return;
    }
    if (!activeLeagueId || !teamId) {
      router.replace("/seleziona-lega");
      return;
    }

    let cancelled = false;
    let timer: any = null;

    async function loadLive() {
      try {
        // giornata open PER LEGA
        const { data: md } = await supabase
          .from("matchdays")
          .select("id, number")
          .eq("league_id", activeLeagueId)
          .eq("status", "open")
          .order("number", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (!md) {
          setMatchdayNumber(null);
          setRows([]);
          setLoading(false);
          return;
        }

        setMatchdayNumber(md.number);

        const { data } = await supabase.rpc("get_league_scores", {
          p_matchday_id: md.id,
        });

        if (cancelled) return;

        setRows((data || []) as ScoreRow[]);
        setUpdatedAt(new Date().toLocaleTimeString());
        setLoading(false);
      } catch {
        // niente: evitiamo spam di errori UI
        setLoading(false);
      }
    }

    // prima load immediato, poi polling
    loadLive();
    timer = setInterval(loadLive, 15000); // 15s

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [ready, userId, activeLeagueId, teamId, router]);

  if (!ready) return <main className="container">Caricamento...</main>;
  if (loading) return <main className="container">Caricamento...</main>;

  return (
    <>
      <AppBar league={leagueName} team={teamName} />
      <main className="container">
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 1000 }}>
            Live {matchdayNumber ? `– Giornata ${matchdayNumber}` : ""}
          </div>
          {updatedAt && (
            <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
              Aggiornato alle {updatedAt}
            </div>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          {rows.map((r, i) => {
            const isMine = r.team_id === teamId;
            const total = Number(r.total_score || 0);

            let totalColor = "var(--muted)";
            if (total > 0) totalColor = "var(--primary-dark)";
            if (total < 0) totalColor = "var(--accent-dark)";

            return (
              <div
                key={r.team_id}
                className="card"
                style={{
                  padding: 16,
                  marginBottom: 12,
                  borderLeft: isMine ? "6px solid var(--primary)" : "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontWeight: 1000 }}>
                    {i + 1}. {r.team_name}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 1000, color: totalColor }}>
                    {fmt(total)}
                  </div>
                </div>

                <div style={{ marginTop: 8, display: "grid", gap: 4, fontWeight: 900 }}>
                  <Line role="P" name={r.gk_name} vote={r.gk_vote} />
                  <Line role="D" name={r.def_name} vote={r.def_vote} />
                  <Line role="C" name={r.mid_name} vote={r.mid_vote} />
                  <Line role="A" name={r.fwd_name} vote={r.fwd_vote} />
                </div>
              </div>
            );
          })}

          {rows.length === 0 && (
            <div className="card" style={{ padding: 16, marginTop: 12 }}>
              <div style={{ color: "var(--muted)", fontWeight: 800 }}>
                Nessun dato live ancora per questa giornata.
              </div>
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  );
}

function Line(props: { role: string; name: string; vote: number }) {
  let color = "var(--muted)";
  if (props.vote > 0) color = "var(--primary-dark)";
  if (props.vote < 0) color = "var(--accent-dark)";

  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <span style={{ width: 20, color: "var(--muted)" }}>{props.role}</span>
      <span style={{ flex: 1 }}>{props.name}</span>
      <span style={{ color }}>{fmt(props.vote)}</span>
    </div>
  );
}

function fmt(n: number) {
  const s = Math.round(n * 10) / 10;
  return String(s).replace(".", ",");
}
