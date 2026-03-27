"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { useApp } from "../components/AppContext";

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

export default function StoricoPage() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamId, teamName } = useApp();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<StoricoCard[]>([]);

  const lastCardRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    async function run() {
      if (!ready) return;
      if (!userId) {
        router.replace("/login");
        return;
      }
      if (!activeLeagueId || !teamId) {
        router.replace("/seleziona-lega");
        return;
      }

      setLoading(true);
      setErr(null);

      const { data: scores, error: scoresErr } = await supabase
        .from("matchday_team_scores")
        .select(`
          matchday_id,
          total_score,
          gk_vote,
          def_vote,
          mid_vote,
          fwd_vote,
          gk_player_id,
          def_player_id,
          mid_player_id,
          fwd_player_id
        `)
        .eq("league_id", activeLeagueId)
        .eq("team_id", teamId);

      if (scoresErr) {
        setErr(scoresErr.message);
        setLoading(false);
        return;
      }

      const scoreRows = ((scores || []) as ScoreRow[]) ?? [];

      if (scoreRows.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const matchdayIds = [...new Set(scoreRows.map((r) => r.matchday_id))];
      const playerIds = [
        ...new Set(
          scoreRows
            .flatMap((r) => [
              r.gk_player_id,
              r.def_player_id,
              r.mid_player_id,
              r.fwd_player_id,
            ])
            .filter(Boolean)
        ),
      ] as string[];

      const { data: matchdays, error: mdErr } = await supabase
        .from("matchdays")
        .select("id, number, status")
        .eq("league_id", activeLeagueId)
        .in("id", matchdayIds)
        .order("number", { ascending: true });

      if (mdErr) {
        setErr(mdErr.message);
        setLoading(false);
        return;
      }

      const playerMap = new Map<string, string>();

      if (playerIds.length > 0) {
        const { data: players, error: pErr } = await supabase
          .from("players")
          .select("id, name")
          .in("id", playerIds);

        if (pErr) {
          setErr(pErr.message);
          setLoading(false);
          return;
        }

        (players || []).forEach((p: any) => {
          playerMap.set(String(p.id), String(p.name));
        });
      }

      const mdMap = new Map<string, MatchdayRow>();
      ((matchdays || []) as MatchdayRow[]).forEach((m) => {
        mdMap.set(m.id, m);
      });

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
      lastCardRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [loading, rows]);

  const subtitle = useMemo(() => {
    if (rows.length === 0) return "Nessuna giornata disponibile";
    return `Le tue giornate · ${rows.length} presenti`;
  }, [rows]);

  if (!ready || loading) {
    return <main className="container">Caricamento...</main>;
  }

  return (
    <>
      <AppBar league={leagueName} team={teamName} />

      <main className="container" style={{ paddingBottom: 100 }}>
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 1000 }}>Storico</div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
            {subtitle}
          </div>
        </div>

        {err && (
          <div
            className="card"
            style={{
              padding: 14,
              marginTop: 12,
              borderLeft: "6px solid var(--accent)",
              fontWeight: 900,
              color: "var(--accent-dark)",
            }}
          >
            {err}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="card" style={{ padding: 16, marginTop: 12 }}>
            Nessuna formazione storica disponibile.
          </div>
        ) : (
          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            {rows.map((r, idx) => {
              const isLast = idx === rows.length - 1;

              return (
                <button
                  key={r.matchday_id}
                  ref={isLast ? lastCardRef : null}
                  type="button"
                  onClick={() => router.push(`/storico/${r.matchday_id}`)}
                  className="card"
                  style={{
                    padding: 14,
                    textAlign: "left",
                    border: "1px solid var(--border)",
                    background: "white",
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 1000 }}>
                    Giornata {r.matchday_number}
                  </div>

                  <div
                    style={{
                      marginTop: 4,
                      color: "var(--muted)",
                      fontWeight: 800,
                      fontSize: 14,
                    }}
                  >
                    {statusLabel(r.status)} · totale {fmt(r.total_score)}
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      display: "grid",
                      gap: 8,
                    }}
                  >
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

function HistoricRow(props: { role: string; name: string; vote: number | null }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "18px 1fr auto",
        gap: 8,
        alignItems: "center",
        fontWeight: 800,
        fontSize: 14,
      }}
    >
      <div style={{ color: "var(--muted)", fontWeight: 1000 }}>{props.role}</div>
      <div
        style={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {props.name}
      </div>
      <div style={{ fontWeight: 900 }}>{signedFmt(props.vote)}</div>
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
