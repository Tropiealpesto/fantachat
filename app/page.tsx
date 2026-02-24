"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "./components/AppBar";
import BottomNav from "./components/BottomNav";
import SeasonBarChart from "./components/SeasonBarChart";
import { useApp } from "./components/AppContext";

type SeasonStats = {
  rank: number;
  total: number;
  avg: number;
  best: number;
  worst: number;
  played: number;
  history: { matchday_number: number; score: number; is_final: boolean }[];
};

type Lineup = {
  gk_name: string;  gk_vote: number | null;
  def_name: string; def_vote: number | null;
  mid_name: string; mid_vote: number | null;
  fwd_name: string; fwd_vote: number | null;
  total_score: number;
};

export default function Home() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamId, teamName, role } = useApp();

  const [loading, setLoading] = useState(true);

  const [matchdayId, setMatchdayId] = useState<string | null>(null);
  const [matchdayNum, setMatchdayNum] = useState<number | null>(null);

  const [lineup, setLineup] = useState<Lineup | null>(null);
  const [stats, setStats] = useState<SeasonStats | null>(null);

  const [mySlot, setMySlot] = useState<{ slot_start_at: string; slot_end_at: string } | null>(null);

  const [articleTitle, setArticleTitle] = useState<string | null>(null);
  const [articlePreview, setArticlePreview] = useState<string | null>(null);
  const [articleMatchday, setArticleMatchday] = useState<number | null>(null);

  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    // redirect base
    if (!userId) {
      router.replace("/login");
      return;
    }
    if (!activeLeagueId || !teamId) {
      router.replace("/seleziona-lega");
      return;
    }

    let cancelled = false;

    async function run() {
      setErr(null);
      setLoading(true);

      try {
        // 1) Giornata open PER LEGA
        const { data: md } = await supabase
          .from("matchdays")
          .select("id, number")
          .eq("league_id", activeLeagueId)
          .eq("status", "open")
          .order("number", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (!md?.id) {
          setMatchdayId(null);
          setMatchdayNum(null);
          setLineup(null);
          setMySlot(null);
        } else {
          setMatchdayId(md.id);
          setMatchdayNum(md.number);

          // 2) Mia formazione + voti
          const { data: lu } = await supabase.rpc("get_my_matchday_lineup", {
            p_matchday_id: md.id,
          });

          if (cancelled) return;
          setLineup(Array.isArray(lu) && lu.length ? (lu[0] as any) : null);

          // 3) Il mio slot (se schedule generato)
          const { data: mySlotData } = await supabase
            .from("pick_schedule")
            .select("slot_start_at, slot_end_at")
            .eq("league_id", activeLeagueId)
            .eq("matchday_id", md.id)
            .eq("team_id", teamId)
            .maybeSingle();

          if (cancelled) return;
          setMySlot(mySlotData ?? null);
        }

        // 4) Stats stagione
        const { data: s, error: sErr } = await supabase.rpc("get_my_season_stats");
        if (sErr) setErr(sErr.message);
        if (cancelled) return;

        setStats({
          rank: Number(s?.rank ?? 0),
          total: Number(s?.total ?? 0),
          avg: Number(s?.avg ?? 0),
          best: Number(s?.best ?? 0),
          worst: Number(s?.worst ?? 0),
          played: Number(s?.played ?? 0),
          history: Array.isArray(s?.history)
            ? s.history.map((x: any) => ({
                matchday_number: Number(x.matchday_number),
                score: Number(x.score),
                is_final: Boolean(x.is_final),
              }))
            : [],
        });

        // 5) Ultimo giornale della lega (se presente)
        const { data: lastArticle } = await supabase
          .from("matchday_articles")
          .select("title, content, matchday_id, created_at")
          .eq("league_id", activeLeagueId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;

        if (lastArticle?.title) {
          setArticleTitle(lastArticle.title);

          const preview = String(lastArticle.content || "")
            .split("\n")
            .filter((x) => x.trim() !== "")
            .slice(0, 2)
            .join(" ");
          setArticlePreview(preview);

          const { data: mdNum } = await supabase
            .from("matchdays")
            .select("number")
            .eq("id", lastArticle.matchday_id)
            .maybeSingle();

          setArticleMatchday(mdNum?.number ?? null);
        } else {
          setArticleTitle(null);
          setArticlePreview(null);
          setArticleMatchday(null);
        }

        setLoading(false);
      } catch (e: any) {
        setErr(e?.message || String(e));
        setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [ready, userId, activeLeagueId, teamId, router]);

  if (!ready) return <main className="container">Caricamento...</main>;
  if (!userId) return <main className="container">Caricamento...</main>;
  if (!activeLeagueId || !teamId) return <main className="container">Caricamento...</main>;
  if (loading) return <main className="container">Caricamento...</main>;

  const ctaLabel = lineup ? "Vedi Rosa (inviata)" : "Invia Rosa";

  return (
    <>
      <AppBar
        league={leagueName}
        team={teamName}
        right={
          <button className="btn" onClick={() => router.push("/seleziona-lega")}>
            Leghe
          </button>
        }
      />

      <main className="container" style={{ fontSize: "0.94rem" }}>
        {err && (
          <div
            className="card"
            style={{
              padding: 14,
              borderColor: "#fecaca",
              background: "#fff1f2",
              color: "#991b1b",
              fontWeight: 900,
            }}
          >
            Errore: {err}
          </div>
        )}

        {/* Card Giornata */}
        <div className="card" style={{ padding: 14, marginTop: 10, borderLeft: "6px solid var(--primary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>Giornata</div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{ fontWeight: 1000, color: matchdayId ? "var(--primary-dark)" : "var(--muted)" }}>
                ● {matchdayId ? "OPEN" : "LOCKED"}
              </div>

              {mySlot && (
                <div style={{ marginTop: 4, alignSelf: "flex-start", fontSize: 13, fontWeight: 900, color: "var(--muted)" }}>
                  {formatSlot(mySlot.slot_start_at, mySlot.slot_end_at)}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 8, fontSize: 20, fontWeight: 1000 }}>
            {matchdayNum ? `${matchdayNum} / 38` : "— / 38"}
          </div>

          <button
            className="btn btn-primary"
            style={{ marginTop: 12, width: "100%", padding: 12, borderRadius: 14 }}
            onClick={() => router.push("/rosa")}
            disabled={!matchdayId}
          >
            {ctaLabel}
          </button>

          <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
            {lineup ? (
              <>
                <div style={{ display: "grid", gap: 8 }}>
                  <LineupRow role="P" name={lineup.gk_name} vote={lineup.gk_vote} />
                  <LineupRow role="D" name={lineup.def_name} vote={lineup.def_vote} />
                  <LineupRow role="C" name={lineup.mid_name} vote={lineup.mid_vote} />
                  <LineupRow role="A" name={lineup.fwd_name} vote={lineup.fwd_vote} />
                </div>

                {(() => {
                  const total = Number(lineup.total_score || 0);

                  let color = "var(--muted)";
                  if (total > 0) color = "var(--primary-dark)";
                  if (total < 0) color = "var(--accent-dark)";

                  return (
                    <div
                      style={{
                        marginTop: 14,
                        padding: "12px 14px",
                        borderRadius: 16,
                        background:
                          total > 0
                            ? "rgba(34,197,94,.12)"
                            : total < 0
                            ? "rgba(249,115,22,.12)"
                            : "#f1f5f9",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontWeight: 1000,
                      }}
                    >
                      <span style={{ color: "var(--text)" }}>Totale giornata</span>
                      <span style={{ fontSize: 22, color }}>{fmt(total)}</span>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div style={{ color: "var(--muted)", fontWeight: 800 }}>
                Rosa non inviata per questa giornata.
              </div>
            )}
          </div>
        </div>

        {/* KPI */}
        <div className="kpi-grid" style={{ marginTop: 10 }}>
          <Kpi title="Posizione" value={stats ? `#${stats.rank || "—"}` : "—"} />
          <Kpi title="Totale" value={stats ? fmt(stats.total) : "—"} />
          <Kpi title="Media" value={stats ? fmt(stats.avg) : "—"} />
        </div>

        {/* Giornale (se esiste) */}
        {articleTitle && (
          <div className="card" style={{ padding: 14, marginTop: 10, borderLeft: "6px solid var(--accent)" }}>
            <div style={{ fontSize: 18, fontWeight: 1000 }}>
              📰 {articleTitle}
              {articleMatchday && (
                <span style={{ color: "var(--muted)", fontWeight: 800, fontSize: 14 }}>
                  {" "}• Giornata {articleMatchday}
                </span>
              )}
            </div>

            <div style={{ marginTop: 8, color: "var(--muted)", fontWeight: 800 }}>
              {articlePreview}
            </div>

            <a
              href="/giornale"
              style={{
                display: "inline-block",
                marginTop: 10,
                border: "2px solid var(--accent)",
                borderRadius: 14,
                padding: "8px 14px",
                fontWeight: 900,
                textDecoration: "none",
                color: "var(--text)",
              }}
            >
              Leggi tutto →
            </a>
          </div>
        )}

        {/* Azioni */}
        <div className="actions-grid" style={{ marginTop: 10 }}>
          <a href="/rosa" className="action">
            <div style={{ fontSize: 18, fontWeight: 1000 }}>Rosa</div>
            <small>Scegli i 4 giocatori</small>
          </a>
          <a href="/live" className="action">
            <div style={{ fontSize: 18, fontWeight: 1000 }}>Live</div>
            <small>Punteggi giornata</small>
          </a>
          <a href="/classifica" className="action">
            <div style={{ fontSize: 18, fontWeight: 1000 }}>Classifica</div>
            <small>Ranking campionato</small>
          </a>
          <a href="/giornale" className="action">
            <div style={{ fontSize: 18, fontWeight: 1000 }}>Giornale</div>
            <small>Il Giornale FantaChat</small>
          </a>
        </div>

        {/* Grafico */}
        <div className="card" style={{ padding: 14, marginTop: 10, borderLeft: "6px solid var(--accent)" }}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Andamento stagione</div>
          <div style={{ marginTop: 10 }}>
            <SeasonBarChart history={stats?.history || []} totalMatchdays={38} />
          </div>
        </div>

        {/* Admin */}
        {role === "admin" && (
          <div className="card" style={{ padding: 14, marginTop: 10, borderLeft: "6px solid var(--accent)" }}>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>Admin</div>
            <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
              Gestisci voti, giornata, Top6, giornale e partite.
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a className="btn" href="/admin/voti">Voti</a>
              <a className="btn" href="/admin/giornata">Giornata</a>
              <a className="btn" href="/admin/top6">Top6</a>
              <a className="btn" href="/admin/giornale">Giornale</a>
              <a className="btn" href="/admin/partite">Partite</a>
              <a className="btn" href="/crea-lega">Crea lega</a>
            </div>
          </div>
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

function LineupRow(props: { role: string; name: string; vote: number | null }) {
  const hasVote = typeof props.vote === "number" && Number.isFinite(props.vote);

  let voteColor = "var(--muted)";
  if (hasVote) {
    if ((props.vote as number) > 0) voteColor = "var(--primary-dark)";
    else if ((props.vote as number) < 0) voteColor = "var(--accent-dark)";
  }

  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontWeight: 900 }}>
      <span style={{ width: 22, color: "var(--muted)" }}>{props.role}</span>
      <span style={{ flex: 1 }}>{props.name}</span>
      <span style={{ color: voteColor }}>{hasVote ? fmt(props.vote as number) : "—"}</span>
    </div>
  );
}

function fmt(n: number) {
  if (!Number.isFinite(n)) return "—";
  const s = Math.round(n * 10) / 10;
  return String(s).replace(".", ",");
}

function formatSlot(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);

  const dayNames = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
  const day = dayNames[start.getDay()];

  const pad = (n: number) => String(n).padStart(2, "0");
  const s = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
  const eMin = pad(end.getMinutes());
  const eHour = pad(end.getHours());

  const endStr = eMin === "00" ? `${eHour}` : `${eHour}:${eMin}`;
  return `${day} ${s}-${endStr}`;
}
