"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type TableRow = {
  team_id: string;
  total_score: number;
  teams: { name: string };
};

type SeriesRow = {
  team_id: string;
  team_name: string;
  matchday_number: number;
  cumulative_score: number;
};

export default function ClassificaPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [table, setTable] = useState<TableRow[]>([]);
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [leagueName, setLeagueName] = useState("—");
  const [teamName, setTeamName] = useState("—");
  const [myTeamId, setMyTeamId] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.replace("/login");
        return;
      }

      // 1) Lega attiva
      const { data: ctx } = await supabase
        .from("user_context")
        .select("active_league_id")
        .eq("user_id", auth.user.id)
        .maybeSingle();

      if (!ctx?.active_league_id) {
        router.replace("/seleziona-lega");
        return;
      }

      const leagueId = ctx.active_league_id;

      // 2) Membership per quella lega
      const { data: m } = await supabase
        .from("memberships")
        .select("team_id")
        .eq("league_id", leagueId)
        .limit(1)
        .maybeSingle();

      if (!m) {
        router.replace("/seleziona-lega");
        return;
      }

      setMyTeamId(m.team_id);

      // Nomi lega/squadra
      const { data: lg } = await supabase
        .from("leagues")
        .select("name")
        .eq("id", leagueId)
        .single();
      if (lg?.name) setLeagueName(lg.name);

      const { data: tm } = await supabase
        .from("teams")
        .select("name")
        .eq("id", m.team_id)
        .single();
      if (tm?.name) setTeamName(tm.name);

      // Tabella classifica (RLS già filtra per lega, ma noi leggiamo tutta la lega selezionata)
      const { data: tData } = await supabase
        .from("league_table")
        .select(`team_id, total_score, teams(name)`)
        .order("total_score", { ascending: false });

      setTable((tData || []) as any);

      // Serie cumulativa (RPC aggiornata a user_context)
      const { data: sData } = await supabase.rpc("get_league_cumulative_series");
      setSeries((sData || []) as any);

      setLoading(false);
    }

    run();
  }, [router]);

  const chartData = useMemo(() => {
    if (!series.length) return [];

    const teams = Array.from(new Set(series.map((r) => r.team_name)));
    const byMatch: Record<number, Record<string, number>> = {};

    for (const r of series) {
      if (!byMatch[r.matchday_number]) byMatch[r.matchday_number] = {};
      byMatch[r.matchday_number][r.team_name] = Number(r.cumulative_score);
    }

    const matchdays = Object.keys(byMatch).map(Number).sort((a, b) => a - b);

    const last: Record<string, number> = {};
    return matchdays.map((md) => {
      const row: any = { matchday: md };
      for (const tn of teams) {
        const v = byMatch[md][tn];
        if (typeof v === "number") last[tn] = v;
        row[tn] = last[tn] ?? 0;
      }
      return row;
    });
  }, [series]);

  const teamNames = useMemo(() => {
    return Array.from(new Set(series.map((r) => r.team_name))).sort();
  }, [series]);

  const colorFor = (name: string) => {
    const palette = [
      "#22c55e", "#f97316", "#3b82f6", "#a855f7",
      "#ef4444", "#0ea5e9", "#84cc16", "#db2777",
    ];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  };

  if (loading) return <main className="container">Caricamento...</main>;

  return (
    <>
      <AppBar league={leagueName} team={teamName} />

      <main className="container">
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 1000 }}>Classifica Campionato</div>
        </div>

        <div className="card" style={{ padding: 16, marginTop: 12, borderLeft: "6px solid var(--accent)" }}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Andamento cumulativo</div>

          {chartData.length === 0 ? (
            <div style={{ marginTop: 10, color: "var(--muted)", fontWeight: 800 }}>
              Nessun dato ancora. Si popola dopo che l’admin chiude almeno una giornata.
            </div>
          ) : (
            <div style={{ marginTop: 12, width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <XAxis dataKey="matchday" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {teamNames.map((tn) => (
                    <Line
                      key={tn}
                      type="monotone"
                      dataKey={tn}
                      dot={false}
                      strokeWidth={3}
                      stroke={colorFor(tn)}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          {table.map((r, i) => {
            const isMine = r.team_id === myTeamId;
            const total = Number(r.total_score || 0);

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
                  <div style={{ fontWeight: 1000 }}>{i + 1}. {r.teams.name}</div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 1000,
                      color: total > 0 ? "var(--primary-dark)" : total < 0 ? "var(--accent-dark)" : "var(--muted)",
                    }}
                  >
                    {fmt(total)}
                  </div>
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

function fmt(n: number) {
  const s = Math.round(n * 10) / 10;
  return String(s).replace(".", ",");
}
