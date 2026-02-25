"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { useApp } from "../components/AppContext";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

type RoleView = "total" | "gk" | "def" | "mid" | "fwd";
type RangeView = "all" | "10" | "5";

type TableRow = {
  team_id: string;
  team_name: string;
  total_score: number;
  gk_total: number;
  def_total: number;
  mid_total: number;
  fwd_total: number;
};

type SeriesRoleRow = {
  team_id: string;
  team_name: string;
  matchday_number: number;
  gk_cum: number;
  def_cum: number;
  mid_cum: number;
  fwd_cum: number;
  total_cum: number;
};

export default function ClassificaPage() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamId, teamName } = useApp();

  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  const [table, setTable] = useState<TableRow[]>([]);
  const [series, setSeries] = useState<SeriesRoleRow[]>([]);

  const [roleView, setRoleView] = useState<RoleView>("total");
  const [rangeView, setRangeView] = useState<RangeView>("all");

  useEffect(() => {
    if (!ready) return;
    if (!userId) return router.replace("/login");
    if (!activeLeagueId || !teamId) return router.replace("/seleziona-lega");

    let cancelled = false;
    let timer: any = null;

    async function loadAll() {
      try {
        setLoading(true);

        // Tabella compatta con totali per ruolo
        const { data: tbl, error: tblErr } = await supabase.rpc("get_league_table_with_roles");
        if (!cancelled) {
          if (tblErr) throw tblErr;
          setTable(
            (tbl || []).map((r: any) => ({
              team_id: String(r.team_id),
              team_name: String(r.team_name),
              total_score: Number(r.total_score || 0),
              gk_total: Number(r.gk_total || 0),
              def_total: Number(r.def_total || 0),
              mid_total: Number(r.mid_total || 0),
              fwd_total: Number(r.fwd_total || 0),
            }))
          );
        }

        // Serie cumulativa per ruoli
        const { data: s, error: sErr } = await supabase.rpc("get_league_cumulative_series_roles");
        if (!cancelled) {
          if (sErr) throw sErr;
          setSeries((s || []) as any);
        }

        if (!cancelled) {
          setUpdatedAt(new Date().toLocaleTimeString());
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    timer = setInterval(loadAll, 20000); // refresh ogni 20s

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [ready, userId, activeLeagueId, teamId, router]);

  const chartData = useMemo(() => {
    if (!series.length) return [];

    // tutte le squadre
    const teams = Array.from(new Set(series.map((r) => r.team_name)));

    // mappa matchday -> team -> value
    const byMatch: Record<number, Record<string, number>> = {};

    for (const r of series) {
      const md = Number(r.matchday_number);
      if (!byMatch[md]) byMatch[md] = {};

      let v = 0;
      if (roleView === "total") v = Number(r.total_cum);
      if (roleView === "gk") v = Number(r.gk_cum);
      if (roleView === "def") v = Number(r.def_cum);
      if (roleView === "mid") v = Number(r.mid_cum);
      if (roleView === "fwd") v = Number(r.fwd_cum);

      byMatch[md][r.team_name] = v;
    }

    let matchdays = Object.keys(byMatch).map(Number).sort((a, b) => a - b);

    if (rangeView !== "all") {
      const n = rangeView === "10" ? 10 : 5;
      matchdays = matchdays.slice(Math.max(0, matchdays.length - n));
    }

    // costruisci righe per recharts
    // (riempiamo i buchi con l'ultimo valore noto per ogni team)
    const last: Record<string, number> = {};
    return matchdays.map((md) => {
      const row: any = { matchday: md };
      for (const tn of teams) {
        const v = byMatch[md]?.[tn];
        if (typeof v === "number") last[tn] = v;
        row[tn] = last[tn] ?? 0;
      }
      return row;
    });
  }, [series, roleView, rangeView]);

  const teamNames = useMemo(() => {
    return Array.from(new Set(series.map((r) => r.team_name))).sort();
  }, [series]);

  const myTeamNameInTable = useMemo(() => {
    const mine = table.find((x) => x.team_id === teamId);
    return mine?.team_name ?? "";
  }, [table, teamId]);

  const colorFor = (name: string) => {
    const palette = ["#22c55e", "#f97316", "#3b82f6", "#a855f7", "#ef4444", "#0ea5e9", "#84cc16", "#db2777"];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  };

  if (!ready) return <main className="container">Caricamento...</main>;
  if (loading) return <main className="container">Caricamento...</main>;

  return (
    <>
      <AppBar league={leagueName} team={teamName} />

      <main className="container">
        {/* Header */}
        <div className="card" style={{ padding: 14, marginTop: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 1000 }}>Classifica</div>
          {updatedAt && (
            <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
              Aggiornato alle {updatedAt}
            </div>
          )}
        </div>

        {/* Controlli + Grafico */}
        <div className="card" style={{ padding: 14, marginTop: 12, borderLeft: "6px solid var(--accent)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>Storico</div>

            {/* Mini bottoni grigi: range */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <MiniBtn active={rangeView === "all"} onClick={() => setRangeView("all")}>Tutte</MiniBtn>
              <MiniBtn active={rangeView === "10"} onClick={() => setRangeView("10")}>Ultime 10</MiniBtn>
              <MiniBtn active={rangeView === "5"} onClick={() => setRangeView("5")}>Ultime 5</MiniBtn>
            </div>
          </div>

          {/* Ruolo */}
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <MiniBtn active={roleView === "total"} onClick={() => setRoleView("total")}>Tot</MiniBtn>
            <MiniBtn active={roleView === "gk"} onClick={() => setRoleView("gk")}>P</MiniBtn>
            <MiniBtn active={roleView === "def"} onClick={() => setRoleView("def")}>D</MiniBtn>
            <MiniBtn active={roleView === "mid"} onClick={() => setRoleView("mid")}>C</MiniBtn>
            <MiniBtn active={roleView === "fwd"} onClick={() => setRoleView("fwd")}>A</MiniBtn>
          </div>

          {/* Grafico */}
          {chartData.length === 0 ? (
            <div style={{ marginTop: 10, color: "var(--muted)", fontWeight: 800 }}>
              Nessun dato ancora.
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
                      strokeWidth={tn === myTeamNameInTable ? 4 : 2.8}
                      stroke={colorFor(tn)}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Tabella compatta stile foto */}
        <div className="card" style={{ padding: 0, marginTop: 12, overflow: "hidden" }}>
          <div style={{ padding: 14 }}>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>FantaChat Campionato</div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(249,115,22,.16)" }}>
                  <th style={thSmall}>#</th>
                  <th style={{ ...thSmall, textAlign: "left" }}>Squadra</th>
                  <th style={thSmall}>Tot</th>
                  <th style={thSmall}>P</th>
                  <th style={thSmall}>D</th>
                  <th style={thSmall}>C</th>
                  <th style={thSmall}>A</th>
                </tr>
              </thead>

              <tbody>
                {table.map((r, idx) => {
                  const isMine = r.team_id === teamId;
                  return (
                    <tr
                      key={r.team_id}
                      style={{
                        background: isMine ? "rgba(34,197,94,.10)" : idx % 2 ? "#f8fafc" : "white",
                      }}
                    >
                      <td style={tdSmallCenter}><b>{idx + 1}</b></td>
                      <td style={tdSmallLeft}><b>{r.team_name}</b></td>
                      <td style={tdSmallCenter}><b>{fmt(r.total_score)}</b></td>
                      <td style={tdSmallCenter}>{fmt(r.gk_total)}</td>
                      <td style={tdSmallCenter}>{fmt(r.def_total)}</td>
                      <td style={tdSmallCenter}>{fmt(r.mid_total)}</td>
                      <td style={tdSmallCenter}>{fmt(r.fwd_total)}</td>
                    </tr>
                  );
                })}

                {table.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 14, color: "var(--muted)", fontWeight: 800 }}>
                      Nessun dato.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <BottomNav />
    </>
  );
}

function MiniBtn(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        border: "1px solid var(--border)",
        background: props.active ? "rgba(15,23,42,.06)" : "#fff",
        padding: "8px 10px",
        borderRadius: 12,
        fontWeight: 900,
        fontSize: 12,
        color: "var(--text)",
        cursor: "pointer",
      }}
    >
      {props.children}
    </button>
  );
}

const thSmall: any = {
  padding: "10px 10px",
  fontWeight: 1000,
  fontSize: 12,
  color: "var(--text)",
  textAlign: "center",
  borderBottom: "1px solid var(--border)",
};

const tdSmallCenter: any = {
  padding: "10px 10px",
  fontWeight: 800,
  fontSize: 13,
  textAlign: "center",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const tdSmallLeft: any = {
  padding: "10px 10px",
  fontWeight: 900,
  fontSize: 13,
  textAlign: "left",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

function fmt(n: number) {
  const s = Math.round((Number(n) || 0) * 10) / 10;
  return String(s).replace(".", ",");
}
