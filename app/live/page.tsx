"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";

type ScoreRow = {
  team_id: string;
  team_name: string;

  gk_name: string; gk_real_team_name: string; gk_vote: number;
  def_name: string; def_real_team_name: string; def_vote: number;
  mid_name: string; mid_real_team_name: string; mid_vote: number;
  fwd_name: string; fwd_real_team_name: string; fwd_vote: number;

  total_score: number;
};


export default function LivePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [leagueName, setLeagueName] = useState("—");
  const [teamName, setTeamName] = useState("—");
  const [myTeamId, setMyTeamId] = useState<string | null>(null);

  const [matchdayNumber, setMatchdayNumber] = useState<number | null>(null);
  const [rows, setRows] = useState<ScoreRow[]>([]);

  useEffect(() => {
    async function run() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");

      const { data: ctx } = await supabase
        .from("user_context")
        .select("active_league_id")
        .eq("user_id", auth.user.id)
        .maybeSingle();

      if (!ctx?.active_league_id) return router.replace("/seleziona-lega");
      const leagueId = ctx.active_league_id as string;

      const { data: mem } = await supabase
        .from("memberships")
        .select("team_id")
        .eq("league_id", leagueId)
        .limit(1)
        .maybeSingle();

      if (!mem) return router.replace("/seleziona-lega");
      setMyTeamId(mem.team_id);

      const { data: lg } = await supabase.from("leagues").select("name").eq("id", leagueId).single();
      if (lg?.name) setLeagueName(lg.name);

      const { data: tm } = await supabase.from("teams").select("name").eq("id", mem.team_id).single();
      if (tm?.name) setTeamName(tm.name);

      // matchday open PER LEGA
      const { data: md } = await supabase
        .from("matchdays")
        .select("id, number")
        .eq("league_id", leagueId)
        .eq("status", "open")
        .order("number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!md) {
        setLoading(false);
        return;
      }

      setMatchdayNumber(md.number);

      const { data } = await supabase.rpc("get_league_scores", { p_matchday_id: md.id });
      setRows((data || []) as ScoreRow[]);

      setLoading(false);
    }

    run();
  }, [router]);

  if (loading) return <main className="container">Caricamento...</main>;

  return (
    <>
      <AppBar league={leagueName} team={teamName} />
      <main className="container">
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 1000 }}>Live – Giornata {matchdayNumber ?? "—"}</div>
        </div>

        <div style={{ marginTop: 12 }}>
          {rows.map((r, i) => {
            const isMine = r.team_id === myTeamId;
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
<Line role="D" name={r.def_name} team={r.def_real_team_name} vote={r.def_vote} />
<Line role="C" name={r.mid_name} team={r.mid_real_team_name} vote={r.mid_vote} />
<Line role="A" name={r.fwd_name} team={r.fwd_real_team_name} vote={r.fwd_vote} />
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

function Line(props: { role: string; name: string; team?: string; vote: number }) {
  let color = "var(--muted)";
  if (props.vote > 0) color = "var(--primary-dark)";
  if (props.vote < 0) color = "var(--accent-dark)";

  const label =
    props.role === "P" ? props.name : `${props.name} (${props.team || "?"})`;

  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
      <span style={{ width: 20, color: "var(--muted)" }}>{props.role}</span>
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ color }}>{fmt(props.vote)}</span>
    </div>
  );
}

function fmt(n: number) {
  const s = Math.round(n * 10) / 10;
  return String(s).replace(".", ",");
}
