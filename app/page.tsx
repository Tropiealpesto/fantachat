"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppBar from "./components/AppBar";
import BottomNav from "./components/BottomNav";
import LoadingScreen from "./components/LoadingScreen";
import CompetitionBadge from "./components/CompetitionBadge";
import { useRequireApp } from "./hooks/useRequireApp";
import { rpcJson, fmt, signedFmt } from "../lib/rpc";

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

const emptyHome: HomeData = {
  matchday: null,
  lineup: null,
  stats: null,
  nyx: null,
};

export default function Home() {
  const router = useRouter();

  // IMPORTANTE:
  // Mettiamo false qui per evitare che l'hook rimandi a seleziona-lega
  // solo perché la competizione non è ancora caricata.
  const app = useRequireApp(false);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HomeData>(emptyHome);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!app.ready) return;
    if (!app.userId) return;
    if (!app.activeLeagueId) return;

    // Se manca la competizione attiva non carichiamo la home data.
    // Verrà mostrata una card dedicata sotto.
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