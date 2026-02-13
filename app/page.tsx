"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "./components/AppBar";
import BottomNav from "./components/BottomNav";
import SeasonBarChart from "./components/SeasonBarChart";

type Membership = { league_id: string; team_id: string; role: "player" | "admin" };

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
  const [loading, setLoading] = useState(true);

  const [membership, setMembership] = useState<Membership | null>(null);
  const [leagueName, setLeagueName] = useState("—");
  const [teamName, setTeamName] = useState("—");

  const [matchdayNum, setMatchdayNum] = useState<number | null>(null);
  const [matchdayStatus, setMatchdayStatus] = useState<"OPEN" | "LOCKED" | "—">("—");

  const [stats, setStats] = useState<SeasonStats | null>(null);
  const [lineup, setLineup] = useState<Lineup | null>(null);

  const [err, setErr] = useState<string | null>(null);

  const [articleTitle, setArticleTitle] = useState<string | null>(null);
const [articlePreview, setArticlePreview] = useState<string | null>(null);
const [articleMatchday, setArticleMatchday] = useState<number | null>(null);

  const actions = useMemo(
    () => [
      { title: "Rosa", desc: "Scegli i 4 giocatori", href: "/rosa" },
      { title: "Live", desc: "Punteggi giornata", href: "/live" },
      { title: "Classifica", desc: "Ranking campionato", href: "/classifica" },
    ],
    []
  );

  useEffect(() => {
    async function run() {
      setErr(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.replace("/login");
        return;
      }

      // 1) Lega attiva
      const { data: ctx, error: ctxErr } = await supabase
        .from("user_context")
        .select("active_league_id")
        .eq("user_id", auth.user.id)
        .maybeSingle();

      const activeLeagueId = ctx?.active_league_id || null;

      if (!activeLeagueId) {
        router.replace("/seleziona-lega");
        return;
      }

// 🔹 Carica ultimo giornale per la lega attiva
const { data: lastArticle } = await supabase
  .from("matchday_articles")
  .select("title, content, matchday_id")
  .eq("league_id", activeLeagueId)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (lastArticle?.title) {
  setArticleTitle(lastArticle.title);

  // preview: prime 2 righe
  const preview = lastArticle.content.split("\n").slice(0, 2).join(" ");
  setArticlePreview(preview);

  // prendi numero giornata
  const { data: mdNum } = await supabase
    .from("matchdays")
    .select("number")
    .eq("id", lastArticle.matchday_id)
    .maybeSingle();

  setArticleMatchday(mdNum?.number ?? null);
}

      // 2) Membership per quella lega
      const { data: m, error: mErr } = await supabase
        .from("memberships")
        .select("league_id, team_id, role")
        .eq("league_id", activeLeagueId)
        .limit(1)
        .maybeSingle();

      if (mErr || !m) {
        router.replace("/seleziona-lega");
        return;
      }

      const mem = m as Membership;
      setMembership(mem);

      // 3) Nome lega/squadra
      const { data: lg } = await supabase.from("leagues").select("name").eq("id", mem.league_id).single();
      if (lg?.name) setLeagueName(lg.name);

      const { data: tm } = await supabase.from("teams").select("name").eq("id", mem.team_id).single();
      if (tm?.name) setTeamName(tm.name);

      // 4) Giornata open
      const { data: md } = await supabase
        .from("matchdays")
        .select("id, number")
        .eq("status", "open")
        .order("number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (md?.id) {
        setMatchdayNum(md.number);
        setMatchdayStatus("OPEN");

        // 5) Mia formazione + voti (usa lega attiva dentro la RPC)
        const { data: lu, error: luErr } = await supabase.rpc("get_my_matchday_lineup", {
          p_matchday_id: md.id,
        });

        if (!luErr && Array.isArray(lu) && lu.length) setLineup(lu[0] as Lineup);
        else setLineup(null);
      } else {
        setMatchdayStatus("LOCKED");
        setLineup(null);
      }

      // 6) Statistiche stagione (usa lega attiva dentro la RPC)
      const { data: s, error: sErr } = await supabase.rpc("get_my_season_stats");
      if (sErr) setErr(sErr.message);
      else {
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
      }

      setLoading(false);
    }

    run();
  }, [router]);

  if (loading) return <main className="container">Caricamento...</main>;

  if (!membership) {
    return (
      <>
        <AppBar league="FantaChat" team="Home" right={<button className="btn" onClick={() => router.push("/seleziona-lega")}>Leghe</button>} />
        <main className="container">
          <div className="card" style={{ padding: 16, marginTop: 12 }}>
            <div style={{ fontWeight: 1000, fontSize: 20 }}>Nessuna lega selezionata</div>
            <div style={{ marginTop: 8, color: "var(--muted)", fontWeight: 800 }}>
              Vai su “Leghe” e seleziona una lega.
            </div>
            <button className="btn btn-primary" style={{ marginTop: 12, width: "100%", padding: 12 }} onClick={() => router.push("/seleziona-lega")}>
              Seleziona lega
            </button>
          </div>
        </main>
        <BottomNav />
      </>
    );
  }

  const ctaLabel = lineup ? "Vedi Rosa (inviata)" : "Invia Rosa";

  return (
    <>
      <AppBar
        league={leagueName}
        team={teamName}
        right={<button className="btn" onClick={() => router.push("/seleziona-lega")}>Leghe</button>}
      />

      <main className="container">
        {err && (
          <div className="card" style={{ padding: 14, borderColor: "#fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 900 }}>
            Errore: {err}
          </div>
        )}

        {/* Card Giornata + mia formazione */}
        <div className="card" style={{ padding: 16, marginTop: 12, borderLeft: "6px solid var(--primary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>Giornata</div>
            <div style={{ fontWeight: 1000, color: matchdayStatus === "OPEN" ? "var(--primary-dark)" : "var(--muted)" }}>
              ● {matchdayStatus}
            </div>
          </div>

          <div style={{ marginTop: 8, fontSize: 22, fontWeight: 1000 }}>
            {matchdayNum ? `${matchdayNum} / 38` : "— / 38"}
          </div>

          <button className="btn btn-primary" style={{ marginTop: 12, width: "100%", padding: 12 }} onClick={() => router.push("/rosa")} disabled={matchdayStatus !== "OPEN"}>
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
                          total > 0 ? "rgba(34,197,94,.12)" : total < 0 ? "rgba(249,115,22,.12)" : "#f1f5f9",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontWeight: 1000,
                      }}
                    >
                      <span style={{ color: "var(--text)", fontWeight: 1000 }}>Totale giornata</span>
                      <span style={{ fontSize: 22, color }}>{fmt(total)}</span>
                    </div>
                  );
                })()}

                <div style={{ marginTop: 8, color: "var(--muted)", fontWeight: 800, fontSize: 13 }}>
                  Per vedere tutti i punteggi vai su{" "}
                  <a href="/live" style={{ fontWeight: 900, color: "var(--accent-dark)", textDecoration: "none" }}>Live</a>.
                </div>
              </>
            ) : (
              <div style={{ color: "var(--muted)", fontWeight: 800 }}>
                Rosa non inviata per questa giornata.
              </div>
            )}
          </div>
        </div>

        {/* KPI */}
        <div className="kpi-grid" style={{ marginTop: 12 }}>
          <Kpi title="Posizione" value={stats ? `#${stats.rank || "—"}` : "—"} />
          <Kpi title="Totale" value={stats ? fmt(stats.total) : "—"} />
          <Kpi title="Media" value={stats ? fmt(stats.avg) : "—"} />
        </div>

{/* Giornale FantaChat */}
{articleTitle && (
  <div
    className="card"
    style={{
      padding: 16,
      marginTop: 12,
      borderLeft: "6px solid var(--accent)",
    }}
  >
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
        <div className="actions-grid" style={{ marginTop: 12 }}>
          {actions.map((a) => (
            <a key={a.title} href={a.href} className="action">
              <div style={{ fontSize: 18 }}>{a.title}</div>
              <small>{a.desc}</small>
            </a>
          ))}
        </div>

        {/* Grafico */}
        <div id="storico" className="card" style={{ padding: 16, marginTop: 12, borderLeft: "6px solid var(--accent)" }}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Andamento stagione</div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
            38 giornate sull’asse X. Verde sopra lo 0, arancione sotto lo 0.
          </div>
          <div style={{ marginTop: 12 }}>
            <SeasonBarChart history={stats?.history || []} totalMatchdays={38} />
          </div>
        </div>

        {/* Admin */}
        {membership.role === "admin" && (
          <div className="card" style={{ padding: 16, marginTop: 12, borderLeft: "6px solid var(--accent)" }}>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>Admin</div>
            <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
              Gestisci voti, giornata, Top6 e giornale.
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a className="btn" href="/admin/voti">Voti</a>
              <a className="btn" href="/admin/giornata">Giornata</a>
              <a className="btn" href="/admin/top6">Top6</a>
              <a className="btn" href="/admin/giornale">Giornale</a>
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
      <div style={{ marginTop: 6, fontSize: 24, fontWeight: 1000 }}>{props.value}</div>
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
      <span style={{ flex: 1, textAlign: "left" }}>{props.name}</span>
      <span style={{ color: voteColor }}>{hasVote ? fmt(props.vote as number) : "—"}</span>
    </div>
  );
}

function fmt(n: number) {
  if (!Number.isFinite(n)) return "—";
  const s = Math.round(n * 10) / 10;
  return String(s).replace(".", ",");
}
