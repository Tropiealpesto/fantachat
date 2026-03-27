"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import { useApp } from "../../components/AppContext";

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

      // info giornata
      const { data: md, error: mdErr } = await supabase
        .from("matchdays")
        .select("id, number, status")
        .eq("id", matchdayId)
        .maybeSingle();

      if (mdErr) {
        setErr(mdErr.message);
        setLoading(false);
        return;
      }

      setMatchday(md as any);

      // classifica della giornata
      const { data, error } = await supabase.rpc("get_league_scores", {
        p_matchday_id: matchdayId,
      });

      if (error) {
        setErr(error.message);
        setRows([]);
        setLoading(false);
        return;
      }

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
    return <main className="container">Caricamento...</main>;
  }

  return (
    <>
      <AppBar league={leagueName} team={teamName} />

      <main className="container">
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 1000 }}>
            Giornata {matchday?.number}
          </div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
            Classifica della giornata
          </div>
        </div>

        {err && (
          <div className="card" style={{ padding: 14, marginTop: 12 }}>
            {err}
          </div>
        )}

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {rows.map((r) => {
            const movement =
              r.live_rank < r.old_rank
                ? "up"
                : r.live_rank > r.old_rank
                ? "down"
                : "same";

            const isMe = r.team_id === teamId;

            return (
              <div
                key={r.team_id}
                className="card"
                style={{
                  padding: 14,
                  borderLeft:
                    movement === "up"
                      ? "6px solid var(--primary)"
                      : movement === "down"
                      ? "6px solid var(--accent)"
                      : "6px solid transparent",
                  background: isMe ? "#f0fdf4" : "white",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 1fr auto",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 1000 }}>
                    #{r.live_rank}
                  </div>

                  <div>
                    <div style={{ fontWeight: 1000 }}>
                      {r.team_name}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>
                      {signedFmt(r.live_score)}
                    </div>
                  </div>

                  <div style={{ fontSize: 20, fontWeight: 1000 }}>
                    {fmt(r.live_total)}
                  </div>
                </div>

                <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
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

function PlayerRow(props: {
  role: string;
  name: string | null;
  vote: number;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "18px 1fr auto",
        gap: 8,
        alignItems: "center",
        fontSize: 13,
      }}
    >
      <div style={{ color: "var(--muted)", fontWeight: 1000 }}>
        {props.role}
      </div>
      <div>{props.name || "—"}</div>
      <div style={{ fontWeight: 900 }}>{signedFmt(props.vote)}</div>
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
