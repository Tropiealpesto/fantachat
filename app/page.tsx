"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppBar from "./components/AppBar";
import BottomNav from "./components/BottomNav";
import LoadingScreen from "./components/LoadingScreen";
import CompetitionBadge from "./components/CompetitionBadge";
import { useRequireApp } from "./hooks/useRequireApp";
import { rpcJson, fmt, signedFmt } from "../lib/rpc";
import { supabase } from "../lib/supabaseClient";

type HomeData = {
  matchday?: {
    id: string;
    number: number;
    status: string;
    slot_start?: string | null;
    slot_end?: string | null;
  } | null;
  lineup?: {
    total_points: number;
    players: {
      role: string;
      name: string;
      points: number | null;
    }[];
  } | null;
  stats?: {
    rank: number | null;
    total_points: number;
    avg_points: number;
    history: {
      matchday_number: number;
      score: number;
    }[];
  } | null;
  nyx?: {
    id: string;
    title: string;
    text: string | null;
    audio_url?: string | null;
    matchday_number?: number | null;
  } | null;
};

type CompetitionStatus = {
  league_competition_id: string;
  league_competition_status: string;
  competition_id: string;
  competition_name: string;
  competition_visibility_status: string;
  competition_active: boolean;
};

type StandingRow = {
  user_id: string;
  team_name: string;
  total_points: number;
  rank: number;
};

const emptyHome: HomeData = {
  matchday: null,
  lineup: null,
  stats: null,
  nyx: null,
};

export default function Home() {
  const router = useRouter();
  const app = useRequireApp(false);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HomeData>(emptyHome);
  const [err, setErr] = useState<string | null>(null);

  const [competitionStatus, setCompetitionStatus] = useState<CompetitionStatus | null>(null);
  const [finalStanding, setFinalStanding] = useState<StandingRow[]>([]);

  useEffect(() => {
    if (!app.ready) return;
    if (!app.userId) return;
    if (!app.activeLeagueId) return;

    if (!app.activeLeagueCompetitionId) {
      setLoading(false);
      setData(emptyHome);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);

      try {
        const { data: statusData } = await supabase.rpc(
          "get_active_league_competition_status",
          {
            p_league_competition_id: app.activeLeagueCompetitionId,
          }
        );

        const normalizedStatus = statusData as CompetitionStatus | null;

        if (!cancelled) {
          setCompetitionStatus(normalizedStatus);
        }

        const isClosed =
          normalizedStatus?.league_competition_status === "completed" ||
          normalizedStatus?.competition_visibility_status === "archived" ||
          normalizedStatus?.competition_active === false;

        if (isClosed) {
          const standings = await rpcJson<any>(
            "get_standings",
            {
              p_league_competition_id: app.activeLeagueCompetitionId,
            },
            []
          );

          if (!cancelled) {
            setFinalStanding(normalizeStandings(standings));
            setData(emptyHome);
          }

          return;
        }

        const result = await rpcJson<HomeData>(
          "get_home_data",
          {
            p_league_id: app.activeLeagueId,
            p_league_competition_id: app.activeLeagueCompetitionId,
          },
          emptyHome
        );

        if (!cancelled) {
          setData(result ?? emptyHome);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message ?? String(e));
          setData(emptyHome);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [
    app.ready,
    app.userId,
    app.activeLeagueId,
    app.activeLeagueCompetitionId,
  ]);

  if (!app.ready) return <LoadingScreen />;

  if (!app.userId || !app.activeLeagueId) {
    return <LoadingScreen />;
  }

  const theme = app.competitionTheme;

  if (!app.activeLeagueCompetitionId) {
    return (
      <>
        <AppBar
          league={app.leagueName}
          team={app.teamName}
          onMenuOpen={app.openDrawer}
          right={
            <button
              style={s.topBtn}
              onClick={() => router.push("/seleziona-lega")}
            >
              Leghe
            </button>
          }
        />

        <main style={s.container}>
          <div style={s.card}>
            <h2 style={{ margin: 0 }}>Nessuna competizione attiva</h2>
            <p style={s.muted}>
              La lega è selezionata, ma non risulta ancora una competizione attiva.
            </p>

            {app.isAdmin ? (
              <button
                style={{ ...s.primaryBtn, background: "#16a34a" }}
                onClick={() => router.push("/admin/competizione/nuova")}
              >
                Aggiungi competizione
              </button>
            ) : (
              <button
                style={{ ...s.primaryBtn, background: "#16a34a" }}
                onClick={() => router.push("/seleziona-lega")}
              >
                Torna alle leghe
              </button>
            )}
          </div>
        </main>

        <BottomNav />
      </>
    );
  }

  if (loading) return <LoadingScreen />;

  const isClosed =
    competitionStatus?.league_competition_status === "completed" ||
    competitionStatus?.competition_visibility_status === "archived" ||
    competitionStatus?.competition_active === false;

  if (isClosed) {
    return (
      <>
        <AppBar
          league={app.leagueName}
          team={app.teamName}
          onMenuOpen={app.openDrawer}
          right={
            <button
              style={s.topBtn}
              onClick={() => router.push("/seleziona-lega")}
            >
              Leghe
            </button>
          }
        />

        <section style={{ ...s.hero, background: theme.hero }}>
          <div style={s.heroInner}>
            <CompetitionBadge
              name={app.competitionName}
              type={app.competitionType}
            />

            <div style={s.hello}>Archivio competizione</div>
            <h1 style={s.team}>Competizione conclusa</h1>

            <p style={s.closedText}>
              {app.competitionName ?? "Questa competizione"} è terminata.
              Qui sotto trovi la classifica finale della tua lega.
            </p>
          </div>
        </section>

        <main style={s.container}>
          <div style={s.card}>
            <h2 style={s.closedTitle}>Classifica finale</h2>

            {finalStanding.length === 0 ? (
              <div style={s.muted}>Nessun dato classifica disponibile.</div>
            ) : (
              <div style={s.finalTable}>
                {finalStanding.map((row, index) => {
                  const isMine = row.user_id === app.userId;

                  return (
                    <div
                      key={`${row.user_id}-${index}`}
                      style={{
                        ...s.finalRow,
                        background: isMine ? `${theme.primary}10` : "white",
                        borderLeft: `4px solid ${isMine ? theme.primary : "transparent"}`,
                      }}
                    >
                      <b style={{ color: isMine ? theme.primary : "#111827" }}>
                        #{row.rank || index + 1}
                      </b>
                      <span>{row.team_name}</span>
                      <strong>{fmt(row.total_points)}</strong>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              style={{ ...s.primaryBtn, background: theme.primary }}
              onClick={() => router.push("/storico")}
            >
              Vedi storico giornate
            </button>
          </div>
        </main>

        <BottomNav />
      </>
    );
  }

  const hasLineup = Boolean(data.lineup?.players?.length);

  return (
    <>
      <AppBar
        league={app.leagueName}
        team={app.teamName}
        onMenuOpen={app.openDrawer}
        right={
          <button
            style={s.topBtn}
            onClick={() => router.push("/seleziona-lega")}
          >
            Leghe
          </button>
        }
      />

      <section style={{ ...s.hero, background: theme.hero }}>
        <div style={s.heroInner}>
          <CompetitionBadge
            name={app.competitionName}
            type={app.competitionType}
          />

          <div style={s.hello}>Ciao, benvenuto 👋</div>
          <h1 style={s.team}>{app.teamName}</h1>

          <div style={s.kpis}>
            <Kpi
              label="Posizione"
              value={data.stats?.rank ? `#${data.stats.rank}` : "—"}
            />
            <Kpi label="Totale" value={fmt(data.stats?.total_points)} />
            <Kpi label="Media" value={fmt(data.stats?.avg_points)} />
          </div>
        </div>
      </section>

      <main style={s.container}>
        {err && <div style={s.error}>Errore: {err}</div>}

        {data.nyx && (
          <div style={s.nyxCard}>
            <img src="/nyx-v2.png" alt="Nyx" style={s.nyxImg} />

            <div style={{ flex: 1 }}>
              <CompetitionBadge name="Nyx" type={app.competitionType} />

              <h2 style={s.nyxTitle}>{data.nyx.title}</h2>

              <p style={s.nyxText}>
                {(data.nyx.text ?? "").slice(0, 150)}
                {data.nyx.text && data.nyx.text.length > 150 ? "…" : ""}
              </p>

              <button
                style={{ ...s.primaryBtn, background: theme.primary }}
                onClick={() => router.push("/podcast")}
              >
                Leggi la puntata
              </button>
            </div>
          </div>
        )}

        <div style={{ ...s.card, borderLeft: `4px solid ${theme.primary}` }}>
          <div style={s.cardTop}>
            <div>
              <div style={s.label}>Giornata corrente</div>
              <div style={s.matchday}>{data.matchday?.number ?? "—"}</div>
            </div>

            <span
              style={{
                ...s.status,
                color: data.matchday ? theme.primary : "#6b7280",
                background: data.matchday ? `${theme.primary}14` : "#f3f4f6",
              }}
            >
              {data.matchday?.status ?? "locked"}
            </span>
          </div>

          <button
            disabled={!data.matchday}
            onClick={() => router.push("/rosa")}
            style={{
              ...s.primaryBtn,
              background: data.matchday ? theme.primary : "#d1d5db",
            }}
          >
            {hasLineup ? "Vedi rosa ✓" : "Invia rosa"}
          </button>

          {hasLineup ? (
            <div style={s.lineup}>
              {data.lineup!.players.map((p) => (
                <div key={p.role} style={s.playerRow}>
                  <b>{p.role}</b>
                  <span>{p.name}</span>
                  <strong>{signedFmt(p.points)}</strong>
                </div>
              ))}

              <div style={s.total}>
                <span>Totale giornata</span>
                <b>{fmt(data.lineup?.total_points)}</b>
              </div>
            </div>
          ) : (
            <div style={s.muted}>
              Rosa non ancora inviata per questa competizione.
            </div>
          )}
        </div>

        <div style={s.grid}>
          <Quick href="/rosa" title="Rosa" sub="Scegli i giocatori" />
          <Quick href="/live" title="Live" sub="Classifica live" />
          <Quick href="/classifica" title="Classifica" sub="Ranking" />
          <Quick href="/chat" title="Chat" sub="Lega unica" />
        </div>

        {app.isAdmin && (
          <div style={s.card}>
            <h3 style={{ marginTop: 0 }}>⚙️ Admin competizione</h3>
            <p style={s.muted}>
              Le azioni admin lavorano su{" "}
              {app.competitionName ?? "competizione attiva"}.
            </p>

            <button
              style={{ ...s.primaryBtn, background: theme.primary }}
              onClick={() => router.push("/admin")}
            >
              Apri admin
            </button>
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}

function normalizeStandings(value: any): StandingRow[] {
  if (Array.isArray(value)) return value as StandingRow[];
  if (Array.isArray(value?.rows)) return value.rows as StandingRow[];
  if (Array.isArray(value?.standings)) return value.standings as StandingRow[];
  if (Array.isArray(value?.data)) return value.data as StandingRow[];
  return [];
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={s.kpi}>
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}

function Quick({
  href,
  title,
  sub,
}: {
  href: string;
  title: string;
  sub: string;
}) {
  return (
    <a href={href} style={s.quick}>
      <b>{title}</b>
      <small>{sub}</small>
    </a>
  );
}

const s: Record<string, React.CSSProperties> = {
  topBtn: {
    border: 0,
    borderRadius: 999,
    background: "#f0fdf4",
    color: "#15803d",
    padding: "7px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
  hero: {
    color: "white",
    padding: "18px 16px 28px",
  },
  heroInner: {
    maxWidth: 520,
    margin: "0 auto",
  },
  hello: {
    marginTop: 18,
    opacity: 0.75,
    fontWeight: 700,
  },
  team: {
    fontSize: 28,
    lineHeight: 1.1,
    margin: "6px 0 18px",
  },
  closedText: {
    margin: "0",
    color: "rgba(255,255,255,0.78)",
    fontWeight: 750,
    lineHeight: 1.45,
  },
  closedTitle: {
    margin: "0 0 12px",
    color: "#111827",
    fontWeight: 1000,
    fontSize: 22,
  },
  finalTable: {
    display: "grid",
    gap: 8,
  },
  finalRow: {
    display: "grid",
    gridTemplateColumns: "44px 1fr 70px",
    gap: 8,
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
  },
  kpis: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 10,
  },
  kpi: {
    background: "rgba(255,255,255,.15)",
    border: "1px solid rgba(255,255,255,.2)",
    borderRadius: 14,
    padding: 12,
    display: "grid",
    gap: 4,
    textAlign: "center",
  },
  container: {
    maxWidth: 520,
    margin: "0 auto",
    padding: "16px 14px calc(70px + env(safe-area-inset-bottom, 0px) + 20px)",
    display: "grid",
    gap: 14,
  },
  card: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 4px 16px rgba(0,0,0,.06)",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  label: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  matchday: {
    fontSize: 34,
    fontWeight: 900,
  },
  status: {
    borderRadius: 999,
    padding: "5px 12px",
    fontWeight: 900,
    height: 30,
  },
  primaryBtn: {
    width: "100%",
    border: 0,
    color: "white",
    borderRadius: 12,
    padding: 13,
    fontWeight: 900,
    cursor: "pointer",
    marginTop: 10,
  },
  muted: {
    color: "#6b7280",
    fontWeight: 700,
    fontSize: 13,
    marginTop: 10,
  },
  lineup: {
    display: "grid",
    gap: 8,
    marginTop: 14,
  },
  playerRow: {
    display: "grid",
    gridTemplateColumns: "28px 1fr auto",
    gap: 8,
    fontSize: 14,
  },
  total: {
    display: "flex",
    justifyContent: "space-between",
    borderTop: "1px solid #e5e7eb",
    paddingTop: 10,
    marginTop: 4,
  },
  nyxCard: {
    display: "flex",
    gap: 14,
    background: "#0f172a",
    color: "white",
    borderRadius: 18,
    padding: 16,
    overflow: "hidden",
  },
  nyxImg: {
    width: 86,
    height: 86,
    objectFit: "cover",
    borderRadius: 14,
  },
  nyxTitle: {
    fontSize: 20,
    margin: "10px 0 6px",
  },
  nyxText: {
    color: "rgba(255,255,255,.72)",
    lineHeight: 1.5,
    fontWeight: 600,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  quick: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 16,
    display: "grid",
    gap: 4,
    boxShadow: "0 2px 10px rgba(0,0,0,.04)",
  },
  error: {
    padding: 12,
    borderRadius: 12,
    background: "#fff1f2",
    color: "#991b1b",
    fontWeight: 800,
  },
};