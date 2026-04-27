"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import LoadingScreen from "../components/LoadingScreen";
import { useApp } from "../components/AppContext";

type StatRow = {
  player_id: string;
  played_count: number;
  total_points: number;
  avg_points: number;
  best_points: number;
  worst_points: number;
  players: {
    id: string;
    name: string;
    role: string;
    real_team_id: string | null;
    real_teams: {
      name: string;
    } | null;
  } | null;
};

export default function StatistichePage() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamName, openDrawer } = useApp();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<StatRow[]>([]);

  useEffect(() => {
    async function run() {
      if (!ready) return;
      if (!userId) return void router.replace("/login");
      if (!activeLeagueId) return void router.replace("/seleziona-lega");

      setLoading(true);
      setErr(null);

      const { data, error } = await supabase
        .from("player_league_stats")
        .select(`
          player_id,
          played_count,
          total_points,
          avg_points,
          best_points,
          worst_points,
          players:player_id (
            id,
            name,
            role,
            real_team_id,
            real_teams(name)
          )
        `)
        .eq("league_id", activeLeagueId);

      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }

      const normalized = ((data || []) as any[])
        .map((r) => ({
          player_id: String(r.player_id),
          played_count: Number(r.played_count || 0),
          total_points: Number(r.total_points || 0),
          avg_points: Number(r.avg_points || 0),
          best_points: Number(r.best_points || 0),
          worst_points: Number(r.worst_points || 0),
          players: r.players
            ? {
                id: String(r.players.id),
                name: String(r.players.name || "—"),
                role: String(r.players.role || ""),
                real_team_id: r.players.real_team_id ? String(r.players.real_team_id) : null,
                real_teams: r.players.real_teams
                  ? { name: String(r.players.real_teams.name || "") }
                  : null,
              }
            : null,
        }))
        .filter((r) => r.players);

      setRows(normalized);
      setLoading(false);
    }

    run();
  }, [ready, userId, activeLeagueId, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const name = r.players?.name?.toLowerCase() || "";
      const team = r.players?.real_teams?.name?.toLowerCase() || "";
      return name.includes(q) || team.includes(q);
    });
  }, [rows, query]);

  const topAvg = useMemo(
    () => [...rows].sort((a, b) => b.avg_points - a.avg_points || a.players!.name.localeCompare(b.players!.name)).slice(0, 10),
    [rows]
  );

  const topBest = useMemo(
    () => [...rows].sort((a, b) => b.best_points - a.best_points || a.players!.name.localeCompare(b.players!.name)).slice(0, 10),
    [rows]
  );

  const topWorst = useMemo(
    () => [...rows].sort((a, b) => a.worst_points - b.worst_points || a.players!.name.localeCompare(b.players!.name)).slice(0, 10),
    [rows]
  );

  if (!ready || loading) return <LoadingScreen />;

  return (
    <>
      <AppBar league={leagueName} team={teamName} onMenuOpen={openDrawer} />

      <main className="container" style={{ paddingBottom: 100 }}>
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 24, fontWeight: 1000 }}>Statistiche</div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
            Cerca un giocatore o consulta le classifiche della lega
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca giocatore o squadra..."
            style={{
              width: "100%",
              marginTop: 14,
              padding: 14,
              borderRadius: 14,
              border: "1px solid var(--border)",
              fontWeight: 800,
              background: "white",
            }}
          />
        </div>

        {err && (
          <div
            className="card"
            style={{
              padding: 14,
              marginTop: 12,
              color: "var(--accent-dark)",
              fontWeight: 900,
            }}
          >
            {err}
          </div>
        )}

        {query.trim() !== "" && (
          <div className="card" style={{ padding: 16, marginTop: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 1000 }}>Risultati ricerca</div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {filtered.length === 0 ? (
                <div style={{ color: "var(--muted)", fontWeight: 800 }}>
                  Nessun giocatore trovato.
                </div>
              ) : (
                filtered.slice(0, 20).map((r) => (
                  <PlayerStatRow
                    key={r.player_id}
                    row={r}
                    statLabel="Pt medio"
                    statValue={fmt(r.avg_points)}
                    onClick={() => router.push(`/giocatore/${r.player_id}`)}
                  />
                ))
              )}
            </div>
          </div>
        )}

        <StatsBlock
          title="Top Pt medio"
          subtitle="I giocatori più affidabili della lega"
          rows={topAvg}
          statLabel="Pt medio"
          getValue={(r) => fmt(r.avg_points)}
          onRowClick={(id) => router.push(`/giocatore/${id}`)}
        />

        <StatsBlock
          title="Miglior picco"
          subtitle="I migliori punteggi singoli"
          rows={topBest}
          statLabel="Best"
          getValue={(r) => fmt(r.best_points)}
          onRowClick={(id) => router.push(`/giocatore/${id}`)}
        />

        <StatsBlock
          title="Flop"
          subtitle="I peggiori punteggi singoli"
          rows={topWorst}
          statLabel="Worst"
          getValue={(r) => fmt(r.worst_points)}
          onRowClick={(id) => router.push(`/giocatore/${id}`)}
        />
      </main>

      <BottomNav />
    </>
  );
}

function StatsBlock(props: {
  title: string;
  subtitle: string;
  rows: StatRow[];
  statLabel: string;
  getValue: (row: StatRow) => string;
  onRowClick: (playerId: string) => void;
}) {
  return (
    <div className="card" style={{ padding: 16, marginTop: 12 }}>
      <div style={{ fontSize: 18, fontWeight: 1000 }}>{props.title}</div>
      <div style={{ marginTop: 4, color: "var(--muted)", fontWeight: 800 }}>
        {props.subtitle}
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {props.rows.map((r, idx) => (
          <PlayerStatRow
            key={`${props.title}-${r.player_id}`}
            row={r}
            rank={idx + 1}
            statLabel={props.statLabel}
            statValue={props.getValue(r)}
            onClick={() => props.onRowClick(r.player_id)}
          />
        ))}
      </div>
    </div>
  );
}

function PlayerStatRow(props: {
  row: StatRow;
  rank?: number;
  statLabel: string;
  statValue: string;
  onClick: () => void;
}) {
  const p = props.row.players;
  if (!p) return null;

  return (
    <button
      type="button"
      onClick={props.onClick}
      className="card"
      style={{
        padding: 12,
        textAlign: "left",
        border: "1px solid var(--border)",
        background: "white",
        display: "grid",
        gridTemplateColumns: props.rank ? "28px 1fr auto" : "1fr auto",
        gap: 10,
        alignItems: "center",
      }}
    >
      {props.rank ? (
        <div style={{ fontWeight: 1000, color: "var(--muted)" }}>#{props.rank}</div>
      ) : null}

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 1000,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {p.name}
        </div>
        <div style={{ marginTop: 2, color: "var(--muted)", fontWeight: 800, fontSize: 13 }}>
          {roleLabel(p.role)}
          {p.real_teams?.name ? ` · ${p.real_teams.name}` : ""}
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <div style={{ color: "var(--muted)", fontWeight: 900, fontSize: 12 }}>
          {props.statLabel}
        </div>
        <div style={{ marginTop: 2, fontWeight: 1000, fontSize: 18 }}>
          {props.statValue}
        </div>
      </div>
    </button>
  );
}

function fmt(n: number | null) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return (Math.round(n * 10) / 10).toString().replace(".", ",");
}

function roleLabel(role: string) {
  if (role === "GK") return "Portiere";
  if (role === "DEF") return "Difensore";
  if (role === "MID") return "Centrocampista";
  if (role === "FWD") return "Attaccante";
  return role || "—";
}
