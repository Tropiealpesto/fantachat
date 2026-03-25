"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { useApp } from "../components/AppContext";

type LiveRow = {
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

export default function LivePage() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamId, teamName } = useApp();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LiveRow[]>([]);
  const [matchday, setMatchday] = useState<Matchday | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [nyxMessage, setNyxMessage] = useState<string | null>(null);

  const prevLeaderRef = useRef<string | null>(null);
  const nyxTimerRef = useRef<number | null>(null);
  const lastNyxAtRef = useRef<number>(0);
  const lastNyxTypeRef = useRef<string | null>(null);

  async function refresh() {
    if (!activeLeagueId) return;

    setErr(null);

    // Giornata open se esiste, altrimenti ultima con dati
    const { data: openMd } = await supabase
      .from("matchdays")
      .select("id, number, status")
      .eq("league_id", activeLeagueId)
      .eq("status", "open")
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openMd) {
      setMatchday(openMd as Matchday);
    } else {
  const { data: closedMatchdays } = await supabase
    .from("matchdays")
    .select("id, number, status")
    .eq("league_id", activeLeagueId)
    .neq("status", "open")
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (closedMatchdays) {
    setMatchday(closedMatchdays as Matchday);
  } else {
    setMatchday(null);
  }
}

    const { data, error } = await supabase.rpc("get_live_table_for_active_league");

    if (error) {
      setErr(error.message);
      setRows([]);
      return;
    }

    const normalized: LiveRow[] = (data || []).map((r: any) => ({
      team_id: String(r.team_id),
      team_name: String(r.team_name || "—"),
      base_total: Number(r.base_total || 0),
      live_score: Number(r.live_score || 0),
      live_total: Number(r.live_total || 0),
      old_rank: Number(r.old_rank || 0),
      live_rank: Number(r.live_rank || 0),
      gk_name: r.gk_name || null,
      gk_vote: Number(r.gk_vote || 0),
      def_name: r.def_name || null,
      def_vote: Number(r.def_vote || 0),
      mid_name: r.mid_name || null,
      mid_vote: Number(r.mid_vote || 0),
      fwd_name: r.fwd_name || null,
      fwd_vote: Number(r.fwd_vote || 0),
    }));

    setRows(normalized);
  }

  useEffect(() => {
    async function run() {
      if (!ready) return;

      if (!userId) return router.replace("/login");
      if (!activeLeagueId || !teamId) return router.replace("/seleziona-lega");

      await refresh();
      setLoading(false);
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, userId, activeLeagueId, teamId]);

  useEffect(() => {
    if (!ready || !activeLeagueId) return;

    const id = window.setInterval(() => {
      refresh();
    }, 15000);

    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, activeLeagueId]);

  function canShowNyx() {
    const now = Date.now();
    return now - lastNyxAtRef.current > 120000; // 2 minuti
  }

  function showNyx(message: string, type: string) {
    const now = Date.now();

    if (!canShowNyx() && lastNyxTypeRef.current === type) return;

    lastNyxAtRef.current = now;
    lastNyxTypeRef.current = type;

    setNyxMessage(message);

    if (nyxTimerRef.current) {
      window.clearTimeout(nyxTimerRef.current);
    }

    nyxTimerRef.current = window.setTimeout(() => {
      setNyxMessage(null);
    }, 2500);
  }

  useEffect(() => {
    if (!rows || rows.length === 0) return;

    const currentLeader = rows[0].team_id;
    const prevLeader = prevLeaderRef.current;

    // 1) Nuovo leader
    if (prevLeader && currentLeader !== prevLeader) {
      showNyx("Abbiamo un nuovo leader!", "leader");
      prevLeaderRef.current = currentLeader;
      return;
    }

    prevLeaderRef.current = currentLeader;

    // 2) Bonus forte
    const bestRow = rows[0];
    if (bestRow && bestRow.live_score >= 6 && canShowNyx()) {
      const bonusMessages = [
        "Nyx osserva. Che bonus.",
        "Nyx sorride. Qui si vola.",
        "Nyx dice: giornata pesante.",
      ];
      const msg = bonusMessages[Math.floor(Math.random() * bonusMessages.length)];
      showNyx(msg, "bonus");
      return;
    }

    // 3) Malus forte
    const worstRow = [...rows].sort((a, b) => a.live_score - b.live_score)[0];
    if (worstRow && worstRow.live_score <= -3 && canShowNyx()) {
      const malusMessages = [
        "Nyx scuote la testa. Questo malus farà male.",
        "Nyx ha visto di meglio.",
        "Nyx dice: giornata complicata.",
      ];
      const msg = malusMessages[Math.floor(Math.random() * malusMessages.length)];
      showNyx(msg, "malus");
    }

    return () => {
      if (nyxTimerRef.current) {
        window.clearTimeout(nyxTimerRef.current);
      }
    };
  }, [rows]);

  const titleLabel = useMemo(() => {
    if (!matchday) return "Classifica campionato";
    return matchday.status === "open"
      ? `Classifica campionato live · Giornata ${matchday.number}`
      : `Classifica campionato · Ultima giornata ${matchday.number}`;
  }, [matchday]);

  if (!ready) return <main className="container">Caricamento...</main>;
  if (loading) return <main className="container">Caricamento...</main>;

  return (
    <>
      <AppBar league={leagueName} team={teamName} />

      <main className="container">
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 1000 }}>Live</div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
            {titleLabel}
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
            Nessun dato disponibile.
          </div>
        ) : (
          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            {rows.map((r) => {
              const movement =
                r.live_rank < r.old_rank ? "up" : r.live_rank > r.old_rank ? "down" : "same";

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
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "44px 1fr auto auto",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <div style={{ fontSize: 24, fontWeight: 1000, color: "var(--muted)" }}>
                      #{r.live_rank}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 1000,
                          fontSize: 18,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {r.team_name}
                      </div>

                      <div
                        style={{
                          marginTop: 4,
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                          color: "var(--muted)",
                          fontWeight: 900,
                          fontSize: 13,
                        }}
                      >
                        <span>Campionato {fmt(r.base_total)}</span>
                        <span>Live {signedFmt(r.live_score)}</span>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 24, fontWeight: 1000 }}>{fmt(r.live_total)}</div>
                      <div style={{ color: "var(--muted)", fontWeight: 900, fontSize: 12 }}>
                        totale live
                      </div>
                    </div>

                    <div style={{ width: 22, textAlign: "center", fontWeight: 1000, fontSize: 20 }}>
                      {movement === "up" ? (
                        <span style={{ color: "var(--primary-dark)" }}>↑</span>
                      ) : movement === "down" ? (
                        <span style={{ color: "var(--accent-dark)" }}>↓</span>
                      ) : null}
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      paddingTop: 10,
                      borderTop: "1px solid var(--border)",
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <MiniPlayerRow role="P" name={r.gk_name} vote={r.gk_vote} />
                    <MiniPlayerRow role="D" name={r.def_name} vote={r.def_vote} />
                    <MiniPlayerRow role="C" name={r.mid_name} vote={r.mid_vote} />
                    <MiniPlayerRow role="A" name={r.fwd_name} vote={r.fwd_vote} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {nyxMessage && (
        <div
          style={{
            position: "fixed",
            top: "18%",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            textAlign: "center",
            pointerEvents: "none",
            width: "min(86vw, 320px)",
          }}
        >
          <img
            src="/nyx.png"
            alt="Nyx"
            style={{
              width: 170,
              maxWidth: "60vw",
              marginBottom: 8,
            }}
          />

          <div
            style={{
              background: "rgba(255,255,255,.96)",
              padding: "10px 16px",
              borderRadius: 16,
              fontWeight: 1000,
              fontSize: 15,
              color: "var(--text)",
              boxShadow: "0 10px 25px rgba(0,0,0,0.18)",
            }}
          >
            {nyxMessage}
          </div>
        </div>
      )}

      <BottomNav />
    </>
  );
}

function MiniPlayerRow(props: { role: string; name: string | null; vote: number }) {
  const hasName = Boolean(props.name && props.name.trim());

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
      <div style={{ color: "var(--muted)", fontWeight: 1000 }}>{props.role}</div>
      <div
        style={{
          color: "var(--muted)",
          fontWeight: 800,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {hasName ? props.name : "—"}
      </div>
      <div style={{ fontWeight: 900 }}>{signedFmt(props.vote)}</div>
    </div>
  );
}

function fmt(n: number) {
  if (!Number.isFinite(n)) return "0";
  return (Math.round(n * 10) / 10).toString().replace(".", ",");
}

function signedFmt(n: number) {
  if (!Number.isFinite(n)) return "0";
  const v = Math.round(n * 10) / 10;
  if (v > 0) return `+${String(v).replace(".", ",")}`;
  return String(v).replace(".", ",");
}
