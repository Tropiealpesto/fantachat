"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import { useApp } from "../../components/AppContext";

type HistoryRow = {
  matchday_id: string;
  matchday_number: number;
  points: number;
};

type PlayerCard = {
  player_id: string;
  player_name: string;
  role: string;
  real_team_name: string | null;
  avg_points: number | null;
  best_points: number | null;
  worst_points: number | null;
  played_count: number;
  history: HistoryRow[];
};

export default function GiocatorePage() {
  const router = useRouter();
  const params = useParams();
  const { ready, userId, activeLeagueId, leagueName, teamName, openDrawer } = useApp();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [card, setCard] = useState<PlayerCard | null>(null);

  const playerId = params?.id as string;

  useEffect(() => {
    async function run() {
      if (!ready) return;
      if (!userId) return void router.replace("/login");
      if (!activeLeagueId) return void router.replace("/seleziona-lega");
      if (!playerId) return;

      setLoading(true);
      setErr(null);

      // 1) Dati base giocatore
      const { data: playerRow, error: playerErr } = await supabase
        .from("players")
        .select("id, name, role, real_team_id, real_teams(name)")
        .eq("id", playerId)
        .maybeSingle();

      if (playerErr) {
        setErr(playerErr.message);
        setLoading(false);
        return;
      }

      if (!playerRow) {
        setCard(null);
        setLoading(false);
        return;
      }

      // 2) Statistiche aggregate per lega
      const { data: statsRow, error: statsErr } = await supabase
        .from("player_league_stats")
        .select("player_id, avg_points, best_points, worst_points, played_count")
        .eq("league_id", activeLeagueId)
        .eq("player_id", playerId)
        .maybeSingle();

      if (statsErr) {
        setErr(statsErr.message);
        setLoading(false);
        return;
      }

      // 3) Storico per giornata
      const { data: historyRows, error: histErr } = await supabase
        .from("player_league_matchday_stats")
        .select("matchday_id, points")
        .eq("league_id", activeLeagueId)
        .eq("player_id", playerId);

      if (histErr) {
        setErr(histErr.message);
        setLoading(false);
        return;
      }

      const matchdayIds = (historyRows || []).map((x: any) => x.matchday_id);

      let history: HistoryRow[] = [];

      if (matchdayIds.length > 0) {
        const { data: matchdays, error: mdErr } = await supabase
          .from("matchdays")
          .select("id, number")
          .in("id", matchdayIds);

        if (mdErr) {
          setErr(mdErr.message);
          setLoading(false);
          return;
        }

        const mdMap = new Map<string, number>();
        (matchdays || []).forEach((m: any) => {
          mdMap.set(String(m.id), Number(m.number));
        });

        history = (historyRows || [])
          .map((x: any) => ({
            matchday_id: String(x.matchday_id),
            matchday_number: Number(mdMap.get(String(x.matchday_id)) || 0),
            points: Number(x.points || 0),
          }))
          .sort((a, b) => b.matchday_number - a.matchday_number);
      }

      setCard({
        player_id: String(playerRow.id),
        player_name: String(playerRow.name),
        role: String(playerRow.role || ""),
        real_team_name: (playerRow as any).real_teams?.name || null,
        avg_points: statsRow ? Number(statsRow.avg_points ?? 0) : null,
        best_points: statsRow ? Number(statsRow.best_points ?? 0) : null,
        worst_points: statsRow ? Number(statsRow.worst_points ?? 0) : null,
        played_count: statsRow ? Number(statsRow.played_count ?? 0) : 0,
        history,
      });

      setLoading(false);
    }

    run();
  }, [ready, userId, activeLeagueId, playerId, router]);

  if (!ready || loading) {
    return <main className="container">Caricamento...</main>;
  }

  return (
    <>
      <AppBar league={leagueName} team={teamName} onMenuOpen={openDrawer} />

      <main className="container" style={{ paddingBottom: 100 }}>
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

        {!card ? (
          <div className="card" style={{ padding: 16, marginTop: 12 }}>
            Giocatore non trovato.
          </div>
        ) : (
          <>
            <div className="card" style={{ padding: 16, marginTop: 12 }}>
              <div style={{ fontSize: 24, fontWeight: 1000 }}>{card.player_name}</div>
              <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
                {roleLabel(card.role)}
                {card.real_team_name ? ` · ${card.real_team_name}` : ""}
              </div>
            </div>

            <div className="kpi-grid" style={{ marginTop: 10 }}>
              <Kpi title="Pt medio" value={fmt(card.avg_points)} />
              <Kpi title="Migliore" value={fmt(card.best_points)} />
              <Kpi title="Peggiore" value={fmt(card.worst_points)} />
            </div>

            <div className="card" style={{ padding: 16, marginTop: 10 }}>
              <div style={{ fontWeight: 1000, fontSize: 18 }}>Storico</div>
              <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
                {card.played_count} giornate giocate
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                {card.history.length === 0 ? (
                  <div style={{ color: "var(--muted)", fontWeight: 800 }}>
                    Nessun dato disponibile.
                  </div>
                ) : (
                  card.history.map((h) => (
                    <button
                      key={h.matchday_id}
                      type="button"
                      onClick={() => router.push(`/storico/${h.matchday_id}`)}
                      className="card"
                      style={{
                        padding: 12,
                        textAlign: "left",
                        border: "1px solid var(--border)",
                        background: "white",
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <div style={{ fontWeight: 900 }}>Giornata {h.matchday_number}</div>
                      <div style={{ fontWeight: 1000 }}>{signedFmt(h.points)}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </>
  );
}

function Kpi(props: { title: string; value: string }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ color: "var(--muted)", fontWeight: 900 }}>{props.title}</div>
      <div style={{ marginTop: 4, fontSize: 20, fontWeight: 1000 }}>{props.value}</div>
    </div>
  );
}

function fmt(n: number | null) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return (Math.round(n * 10) / 10).toString().replace(".", ",");
}

function signedFmt(n: number | null) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  const v = Math.round(n * 10) / 10;
  if (v > 0) return `+${String(v).replace(".", ",")}`;
  return String(v).replace(".", ",");
}

function roleLabel(role: string) {
  if (role === "GK") return "Portiere";
  if (role === "DEF") return "Difensore";
  if (role === "MID") return "Centrocampista";
  if (role === "FWD") return "Attaccante";
  return role || "—";
}
