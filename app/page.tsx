"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppBar from "./components/AppBar";
import BottomNav from "./components/BottomNav";
import LoadingScreen from "./components/LoadingScreen";
import CompetitionBadge from "./components/CompetitionBadge";
import TeamBadge from "./components/TeamBadge";
import { useRequireApp } from "./hooks/useRequireApp";
import { rpcJson, fmt, signedFmt } from "../lib/rpc";
import { supabase } from "../lib/supabaseClient";

type LineupPlayer = {
  role: string;
  name: string;
  team?: string | null;
  points: number | null;
};

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
    players: LineupPlayer[];
    coach?: {
      name: string;
      team?: string | null;
      points: number | null;
    } | null;
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
};

type CompetitionStatus = {
  league_competition_id: string;
  league_competition_status: string;
  competition_id: string;
  competition_name: string;
  competition_visibility_status: string;
  competition_active: boolean;
};

type StandRow = {
  user_id: string;
  team_name: string;
  total_points: number;
  rank: number;
};

type TopPlayer = {
  name: string;
  role: string;
  team: string;
  points: number;
};

type Recap = {
  has_data: boolean;
  matchday_number?: number;
  leader_team?: string;
  leader_points?: number;
  mvp_name?: string;
  mvp_team?: string;
  mvp_role?: string;
  mvp_points?: number;
};

const emptyHome: HomeData = {
  matchday: null,
  lineup: null,
  stats: null,
};

const ROLE_ORDER = ["A", "C", "D", "P"];

const ROLE_META: Record<string, { bg: string; fg: string; label: string }> = {
  P: { bg: "#FEF3C7", fg: "#B45309", label: "P" },
  D: { bg: "#DCFCE7", fg: "#15803D", label: "D" },
  C: { bg: "#DBEAFE", fg: "#2563EB", label: "C" },
  A: { bg: "#FEE2E2", fg: "#DC2626", label: "A" },
  AL: { bg: "#F5F3FF", fg: "#7C3AED", label: "AL" },
};

function roleColor(role: string) {
  return (
    ROLE_META[role] ?? {
      bg: "#F1F5F9",
      fg: "#475569",
      label: role,
    }
  );
}

function RoleDot({ role, size = 34 }: { role: string; size?: number }) {
  const meta = roleColor(role);

  return (
    <span
      className={`fc-role-badge fc-role-${role}`}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "inline-grid",
        placeItems: "center",
        background: meta.bg,
        color: meta.fg,
        fontSize: Math.max(10, size * 0.42),
        fontWeight: 900,
        border: "1px solid rgba(255,255,255,.72)",
        boxShadow: "0 2px 5px rgba(15,23,42,.18)",
        flexShrink: 0,
      }}
    >
      {meta.label}
    </span>
  );
}

function ptsStyle(v: number | null | undefined): React.CSSProperties {
  const n = Number(v ?? 0);

  if (n > 0) return s.ppUp;
  if (n < 0) return s.ppDown;
  return s.ppFlat;
}

function shortName(name?: string | null) {
  if (!name) return "—";

  const clean = name.trim();
  const parts = clean.split(" ");

  if (parts.length <= 2) return clean;

  return `${parts[0]} ${parts[1]?.[0] ?? ""}.`;
}

function cleanRank(rank?: number | null) {
  if (!rank || rank >= 999) return "—";
  return String(rank);
}

function formatDeadline(value?: string | null) {
  if (!value) return null;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  return new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function homeHeroBackground() {
  return [
    "linear-gradient(145deg, rgba(8,83,44,.95) 0%, rgba(12,117,61,.96) 55%, rgba(20,166,87,.96) 100%)",
    "repeating-linear-gradient(155deg, rgba(255,255,255,.055) 0 1px, transparent 1px 34px)",
  ].join(", ");
}

export default function Home() {
  const router = useRouter();
  const app = useRequireApp(false);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HomeData>(emptyHome);
  const [err, setErr] = useState<string | null>(null);
  const [recap, setRecap] = useState<Recap | null>(null);

  const [myColors, setMyColors] = useState<{
    primary: string | null;
    secondary: string | null;
  }>({
    primary: null,
    secondary: null,
  });

  const [memberColors, setMemberColors] = useState<
    Record<string, { primary: string | null; secondary: string | null }>
  >({});

  const [colorsLoaded, setColorsLoaded] = useState(false);
  const [standings, setStandings] = useState<StandRow[]>([]);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);

  const [competitionStatus, setCompetitionStatus] =
    useState<CompetitionStatus | null>(null);
  const [finalStanding, setFinalStanding] = useState<StandRow[]>([]);

  useEffect(() => {
    if (!app.ready || !app.userId || !app.activeLeagueId) return;

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
          const st = await rpcJson<any>(
            "get_standings",
            {
              p_league_competition_id: app.activeLeagueCompetitionId,
            },
            []
          );

          if (!cancelled) {
            setFinalStanding(normalizeStandings(st));
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

  useEffect(() => {
    if (!app.ready || !app.userId || !app.activeLeagueId) return;

    let off = false;

    supabase
      .rpc("get_league_members", { p_league_id: app.activeLeagueId })
      .then(({ data }) => {
        if (off) return;

        const arr = (data as any[] | null) ?? [];
        const mc: Record<
          string,
          { primary: string | null; secondary: string | null }
        > = {};

        arr.forEach((m) => {
          mc[m.user_id] = {
            primary: m.color_primary ?? null,
            secondary: m.color_secondary ?? null,
          };
        });

        setMemberColors(mc);

        const me = arr.find((m) => m.user_id === app.userId);

        if (me) {
          setMyColors({
            primary: me.color_primary ?? null,
            secondary: me.color_secondary ?? null,
          });
        }

        setColorsLoaded(true);
      });

    return () => {
      off = true;
    };
  }, [app.ready, app.userId, app.activeLeagueId]);

  useEffect(() => {
    if (!colorsLoaded || !app.activeLeagueId || myColors.primary) return;

    try {
      if (
        typeof window !== "undefined" &&
        !sessionStorage.getItem("fc_colors_prompted")
      ) {
        sessionStorage.setItem("fc_colors_prompted", "1");
        router.push("/personalizza");
      }
    } catch {}
  }, [colorsLoaded, myColors.primary, app.activeLeagueId, router]);

  useEffect(() => {
    const lc = app.activeLeagueCompetitionId;
    if (!lc) return;

    let off = false;

    supabase
      .rpc("get_standings", { p_league_competition_id: lc })
      .then(({ data }) => {
        if (!off && data) {
          setStandings(normalizeStandings(data));
        }
      });

    supabase
      .rpc("get_home_top_players", {
        p_league_competition_id: lc,
        p_limit: 12,
      })
      .then(({ data }) => {
        if (!off && data) {
          setTopPlayers(data as TopPlayer[]);
        }
      });

    return () => {
      off = true;
    };
  }, [app.activeLeagueCompetitionId]);

  useEffect(() => {
    if (!app.ready || !app.activeLeagueCompetitionId) return;

    let off = false;

    rpcJson<Recap>(
      "get_home_recap",
      { p_league_competition_id: app.activeLeagueCompetitionId },
      { has_data: false }
    ).then((r) => {
      if (!off) setRecap(r ?? { has_data: false });
    });

    return () => {
      off = true;
    };
  }, [app.ready, app.activeLeagueCompetitionId]);

  const lineupGroups = useMemo(() => {
    const players = data.lineup?.players ?? [];

    return ROLE_ORDER.map((r) => ({
      role: r,
      items: players.filter((p) => p.role === r),
    })).filter((g) => g.items.length > 0);
  }, [data.lineup]);

  if (!app.ready) return <LoadingScreen />;
  if (!app.userId || !app.activeLeagueId) return <LoadingScreen />;

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
              La lega è selezionata, ma non risulta ancora una competizione
              attiva.
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

        <section style={{ ...s.hero, background: homeHeroBackground() }}>
          <div style={s.heroInner}>
            <CompetitionBadge
              name={app.competitionName}
              type={app.competitionType}
            />

            <div style={s.hello}>Archivio competizione</div>
            <h1 style={s.team}>Competizione conclusa</h1>

            <p style={s.closedText}>
              {app.competitionName ?? "Questa competizione"} è terminata. Qui
              sotto trovi la classifica finale della tua lega.
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
                        borderLeft: `4px solid ${
                          isMine ? theme.primary : "transparent"
                        }`,
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

  const hasLineup = Boolean(data.lineup?.players?.length || data.lineup?.coach);
  const mvpLabel =
    recap?.mvp_role === "P" ? recap?.mvp_team || recap?.mvp_name : recap?.mvp_name;

  const top5 = standings.slice(0, 5);
  const meInTop = top5.some((r) => r.user_id === app.userId);
  const myRow = standings.find((r) => r.user_id === app.userId);
  const lineupPlayers = data.lineup?.players ?? [];
  const lineupCoach = data.lineup?.coach ?? null;
  const lineupModule = lineupGroups.map((g) => g.items.length).join("-");
  const lineupPoints = data.lineup?.total_points ?? 0;
  const scoredLineupPlayers = lineupPlayers.filter(
    (p) => typeof p.points === "number"
  );
  const lineupAverage =
    scoredLineupPlayers.length > 0
      ? scoredLineupPlayers.reduce((sum, p) => sum + Number(p.points ?? 0), 0) /
        scoredLineupPlayers.length
      : null;
  const bestLineupPlayer = [...scoredLineupPlayers].sort(
    (a, b) => Number(b.points ?? 0) - Number(a.points ?? 0)
  )[0];
  const playerStatRows =
    topPlayers.length > 0
      ? [...topPlayers].sort((a, b) => b.points - a.points).slice(0, 3)
      : lineupPlayers.slice(0, 3).map((p) => ({
          name: p.name,
          role: p.role,
          team: p.team ?? "",
          points: Number(p.points ?? 0),
        }));
  const matchdayDeadline = formatDeadline(data.matchday?.slot_end);

  function StandLine({ row, mine }: { row: StandRow; mine: boolean }) {
    const c = memberColors[row.user_id];

    return (
      <div
        style={{
          ...s.srow,
          background: mine ? `${theme.primary}0d` : "transparent",
          borderLeft: `2px solid ${mine ? theme.primary : "transparent"}`,
        }}
      >
        <span style={s.srank}>{cleanRank(row.rank)}</span>

        <TeamBadge
          name={row.team_name}
          primary={c?.primary ?? null}
          secondary={c?.secondary ?? null}
          size={25}
        />

        <span
          style={{
            ...s.sname,
            color: mine ? theme.primary : "#0f172a",
          }}
        >
          {row.team_name}
        </span>

        <span style={s.spts}>{fmt(row.total_points)} pt</span>
      </div>
    );
  }

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

      <section style={{ ...s.hero, background: homeHeroBackground() }}>
        <div style={s.heroInner}>
          <div style={s.competitionLine}>
            <span style={s.competitionDot} />
            <span>{app.competitionName ?? app.competitionType}</span>
          </div>

          <div style={s.heroRow}>
            <span style={s.badgeRing}>
              <TeamBadge
                name={app.teamName}
                primary={myColors.primary}
                secondary={myColors.secondary}
                size={50}
              />
            </span>

            <div style={{ minWidth: 0 }}>
              <div style={s.hello}>Ciao, benvenuto</div>
              <h1 style={s.team}>{app.teamName}</h1>
            </div>
          </div>

          <div style={s.kpis}>
            <Kpi
              label="Posizione"
              value={
                data.stats?.rank && data.stats.rank < 999
                  ? `#${data.stats.rank}`
                  : "—"
              }
            />
            <Kpi label="Totale" value={`${fmt(data.stats?.total_points)} pt`} />
            <Kpi label="Media" value={`${fmt(data.stats?.avg_points)} pt`} />
          </div>
        </div>
      </section>

      <main style={s.container}>
        {err && <div style={s.error}>Errore: {err}</div>}

        <div style={s.matchdayCard}>
          <div style={s.matchdayIcon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="4" y="5" width="16" height="15" rx="2" />
              <path d="M8 3v4M16 3v4M4 10h16" />
            </svg>
          </div>

          <div style={{ flex: 1 }}>
            <div style={s.label}>Giornata corrente</div>
            <div style={s.matchday}>{data.matchday?.number ?? "—"}</div>
            {matchdayDeadline && (
              <div style={s.deadline}>Chiude {matchdayDeadline}</div>
            )}
          </div>

          <span
            style={{
              ...s.status,
              color: data.matchday ? theme.primary : "#6b7280",
              background: "transparent",
            }}
          >
            {data.matchday?.status ?? "locked"}
          </span>

          <button
            disabled={!data.matchday}
            onClick={() => router.push("/rosa")}
            style={{
              ...s.primaryBtn,
              background: data.matchday ? theme.primary : "#d1d5db",
            }}
          >
            {hasLineup ? "Modifica rosa" : "Invia rosa"}
          </button>
        </div>

        <section style={s.card}>
          <div style={s.sectionHeader}>
            <h2 style={s.sectionTitle}>La tua classifica</h2>

            <button
              onClick={() => router.push("/classifica")}
              style={s.textLink}
            >
              Vedi classifica completa →
            </button>
          </div>

          {standings.length === 0 ? (
            <div style={s.emptySmall}>Ancora nessuna classifica.</div>
          ) : (
            <div style={s.standingsBox}>
              {top5.map((r) => (
                <StandLine key={r.user_id} row={r} mine={r.user_id === app.userId} />
              ))}

              {!meInTop && myRow && (
                <>
                  <div style={s.dots}>· · ·</div>
                  <StandLine row={myRow} mine />
                </>
              )}
            </div>
          )}
        </section>

        <div
          style={{
            display: "grid",
            gap: 10,
            alignItems: "start",
            gridTemplateColumns: "1fr",
          }}
        >
          {hasLineup && (
          <section style={{ ...s.card, padding: 14 }}>
            <div style={s.sectionHeader}>
              <h2 style={s.sectionTitleSm}>Il tuo schieramento</h2>

              <span style={s.modulePill}>
                {lineupModule}
              </span>
            </div>

            <div style={s.lineupGrid}>
              <div style={s.lineupPitchWrap}>
                <div style={s.compactPitch}>
                  <div style={s.pitchShadow} />
                  <div style={s.pitchBase} />
                  <div style={s.pitchPlane}>
                    <div style={s.pitchOuterLine} />
                    <div style={s.pitchPenaltyTop} />
                    <div style={s.pitchPenaltyBottom} />
                    <div style={s.pitchGoalTop} />
                    <div style={s.pitchGoalBottom} />
                    <div style={s.pitchHalfway} />
                    <div style={s.pitchCircleSmall} />
                  </div>

                  <div style={s.pitchPlayers}>
                    {lineupGroups.map((g) => (
                      <div key={g.role} style={s.compactPitchRow}>
                        {g.items.map((p, i) => (
                          <div key={`${p.name}-${i}`} style={s.compactPlayer}>
                            <RoleDot role={p.role} size={16} />

                            <span style={s.compactPlayerName}>
                              {p.role === "P"
                                ? p.team || p.name
                                : (p.name || "").trim().split(" ")[0] ||
                                  shortName(p.name)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={s.lineupStats}>
                <div style={s.statLine}>
                  <span>Titolari</span>
                  <strong style={s.statValue}>{lineupPlayers.length}</strong>
                </div>
                {lineupCoach && (
                  <div style={s.statLine}>
                    <span>Allenatore</span>
                    <strong style={s.statValue}>
                      {shortName(lineupCoach.name)}
                    </strong>
                  </div>
                )}
                <div style={s.statLine}>
                  <span>Punti live</span>
                  <strong style={s.statValue}>{fmt(lineupPoints)}</strong>
                </div>
                <div style={s.statLine}>
                  <span>Media rosa</span>
                  <strong style={s.statValue}>
                    {lineupAverage === null ? "—" : fmt(lineupAverage)}
                  </strong>
                </div>
                <div style={s.statLine}>
                  <span>Top ruolo</span>
                  <strong style={s.statValue}>
                    {bestLineupPlayer ? shortName(bestLineupPlayer.name) : "—"}
                  </strong>
                </div>
              </div>
            </div>

            <button
              onClick={() => router.push("/rosa")}
              style={s.secondaryBtn}
            >
              Vedi rosa completa
            </button>
          </section>
        )}

        <section style={{ ...s.card, padding: 14 }}>
          <div style={s.sectionHeader}>
            <h2 style={s.sectionTitleSm}>Statistiche giocatori</h2>

            <button
              onClick={() => router.push("/statistiche")}
              style={s.textLink}
            >
              Vedi tutti →
            </button>
          </div>

          {playerStatRows.length === 0 ? (
            <div style={s.topEmpty}>
              <b>Statistiche non ancora disponibili.</b>
              <span>
                I migliori giocatori compariranno qui dopo l’aggiornamento.
              </span>
            </div>
          ) : (
            <div style={s.topGrid}>
              {playerStatRows.map((p, i) => (
                <div key={`${p.name}-${i}`} style={s.topPlayerCard}>
                  <span
                    style={{
                      ...s.roleMini,
                      background: roleColor(p.role).bg,
                      color: roleColor(p.role).fg,
                    }}
                  >
                    {p.role}
                  </span>

                  <div style={{ minWidth: 0 }}>
                    <div style={s.topName}>{shortName(p.name)}</div>
                    <div style={s.topSub}>{p.team}</div>
                  </div>

                  <strong style={ptsStyle(p.points)}>
                    {signedFmt(p.points)}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </section>
        </div>

        <button onClick={() => router.push("/regole")} style={s.rulesRow}>
          <span style={s.rulesIcon} aria-hidden="true">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3 4 7v6c0 4 3.4 7 8 8 4.6-1 8-4 8-8V7l-8-4Z" />
              <path d="m9 12 2 2 4-5" />
            </svg>
          </span>
          <b style={s.rulesText}>Regole competizione</b>
          <span style={s.rulesArrow}>›</span>
        </button>

        {recap?.has_data && (
          <div style={s.recapCard}>
            <div style={s.recapRow}>
              <img src="/nyx-v2.png" alt="Nyx" style={s.recapMascot} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.recapLabel}>
                  Nyx · Giornata {recap.matchday_number}
                </div>

                <p style={s.recapText}>
                  La giornata va a <b>{recap.leader_team}</b> con{" "}
                  {fmt(recap.leader_points)} punti. Migliore in campo{" "}
                  <b>{mvpLabel}</b> ({signedFmt(recap.mvp_points)}).
                </p>
              </div>
            </div>

            <button style={s.recapBtn} onClick={() => router.push("/podcast")}>
              Leggi la puntata intera →
            </button>
          </div>
        )}

        {app.isAdmin && (
          <div style={s.adminCard}>
            <div style={s.adminIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.05.05a2.1 2.1 0 0 1-2.97 2.97l-.05-.05a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.09 1.65V21a2.1 2.1 0 0 1-4.2 0v-.08a1.8 1.8 0 0 0-1.08-1.65 1.8 1.8 0 0 0-2 .36l-.05.05A2.1 2.1 0 0 1 3.4 16.7l.05-.05a1.8 1.8 0 0 0 .36-2 1.8 1.8 0 0 0-1.65-1.09H2.1a2.1 2.1 0 0 1 0-4.2h.08a1.8 1.8 0 0 0 1.65-1.08 1.8 1.8 0 0 0-.36-2l-.05-.05A2.1 2.1 0 0 1 6.38 3.25l.05.05a1.8 1.8 0 0 0 2 .36A1.8 1.8 0 0 0 9.5 2.1V2a2.1 2.1 0 0 1 4.2 0v.08a1.8 1.8 0 0 0 1.09 1.65 1.8 1.8 0 0 0 2-.36l.05-.05a2.1 2.1 0 0 1 2.97 2.97l-.05.05a1.8 1.8 0 0 0-.36 2 1.8 1.8 0 0 0 1.65 1.08h.08a2.1 2.1 0 0 1 0 4.2h-.08A1.8 1.8 0 0 0 19.4 15Z" />
              </svg>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={s.adminTitle}>Admin competizione</h3>

              <p style={s.adminText}>
                Gestisci giornate e formazioni di{" "}
                {app.competitionName ?? "questa competizione"}.
              </p>
            </div>

            <button style={s.adminBtn} onClick={() => router.push("/admin")}>
              Apri
            </button>
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}

function normalizeStandings(value: any): StandRow[] {
  if (Array.isArray(value)) return value as StandRow[];
  if (Array.isArray(value?.rows)) return value.rows as StandRow[];
  if (Array.isArray(value?.standings)) return value.standings as StandRow[];
  if (Array.isArray(value?.data)) return value.data as StandRow[];
  return [];
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={s.kpi}>
      <small style={s.kpiLabel}>{label}</small>
      <b style={s.kpiValue}>{value}</b>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  topBtn: {
    border: "1px solid #f4c99d",
    borderRadius: 10,
    background: "white",
    color: "#e07b1a",
    padding: "7px 16px",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  },

  // hero più compatto e card "Giornata" non più coperta
  hero: {
    color: "white",
    padding: "18px 16px 28px",
    marginBottom: 0,
    position: "relative",
    overflow: "hidden",
  },

  heroInner: {
    maxWidth: 520,
    margin: "0 auto",
  },

  heroRow: {
    display: "flex",
    alignItems: "center",
    gap: 13,
    marginTop: 16,
  },

  competitionLine: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    color: "rgba(255,255,255,.88)",
    fontSize: 12,
    fontWeight: 750,
    lineHeight: 1,
  },

  competitionDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#e07b1a",
    boxShadow: "0 0 0 4px rgba(255,255,255,.16)",
  },

  badgeRing: {
    borderRadius: "50%",
    padding: 2,
    border: "1px solid rgba(255,255,255,.78)",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    boxShadow: "0 7px 16px rgba(0,0,0,.12)",
  },

  hello: {
    opacity: 0.86,
    fontWeight: 700,
    fontSize: 12,
  },

  team: {
    fontSize: 26,
    lineHeight: 1.05,
    margin: "4px 0 0",
    fontWeight: 900,
    letterSpacing: "-0.03em",
  },

  kpis: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
    marginTop: 18,
  },

  kpi: {
    background: "rgba(255,255,255,.12)",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: 9,
    padding: "10px 7px",
    display: "grid",
    gap: 4,
    textAlign: "center",
    backdropFilter: "blur(12px)",
    boxShadow: "none",
  },

  kpiLabel: {
    fontSize: 9.5,
    fontWeight: 700,
    opacity: 0.9,
    textTransform: "uppercase",
    letterSpacing: ".02em",
  },

  kpiValue: {
    fontSize: 19,
    fontWeight: 900,
    lineHeight: 1,
  },

  container: {
    maxWidth: 520,
    margin: "0 auto",
    padding: "12px 14px calc(72px + env(safe-area-inset-bottom, 0px) + 14px)",
    display: "grid",
    gap: 10,
    background: "#f4f7f4",
  },

  card: {
    background: "white",
    border: "1px solid rgba(226,232,240,.92)",
    borderRadius: 11,
    padding: 14,
    boxShadow: "0 3px 12px rgba(15,23,42,.035)",
  },

  matchdayCard: {
    background: "white",
    border: "1px solid rgba(226,232,240,.92)",
    borderRadius: 11,
    padding: 14,
    boxShadow: "0 3px 12px rgba(15,23,42,.035)",
    display: "grid",
    gridTemplateColumns: "34px 1fr auto",
    gap: 10,
    alignItems: "center",
  },

  matchdayIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    background: "#eef7f0",
    color: "#15803d",
    display: "grid",
    placeItems: "center",
    fontSize: 17,
    fontWeight: 850,
  },

  label: {
    color: "#64748b",
    fontSize: 9.5,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: ".02em",
  },

  deadline: {
    marginTop: 3,
    color: "#e07b1a",
    fontSize: 10.5,
    fontWeight: 800,
  },

  matchday: {
    fontSize: 26,
    fontWeight: 900,
    lineHeight: 1,
    color: "#0f172a",
  },

  status: {
    borderRadius: 999,
    padding: 0,
    fontWeight: 700,
    fontSize: 11,
  },

  primaryBtn: {
    gridColumn: "1 / -1",
    width: "100%",
    border: 0,
    color: "white",
    borderRadius: 9,
    padding: 11,
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
    marginTop: 2,
    boxShadow: "0 5px 12px rgba(15,23,42,.09), inset 0 -1px 0 rgba(0,0,0,.08)",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    rowGap: 4,
    marginBottom: 9,
  },

  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: "-0.01em",
  },

  sectionTitleSm: {
    margin: 0,
    color: "#0f172a",
    fontSize: 14.5,
    fontWeight: 800,
    letterSpacing: "-0.01em",
    lineHeight: 1.12,
  },

  textLink: {
    border: 0,
    background: "transparent",
    color: "#15803d",
    fontWeight: 800,
    fontSize: 11.5,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  standingsBox: {
    display: "grid",
    gap: 5,
  },

  srow: {
    display: "grid",
    gridTemplateColumns: "26px 25px 1fr auto",
    gap: 8,
    alignItems: "center",
    padding: "8px 7px",
    borderRadius: 7,
    borderBottom: "1px solid #f1f5f9",
  },

  srank: {
    fontWeight: 800,
    color: "#64748b",
    fontSize: 12.5,
    textAlign: "center",
  },

  sname: {
    fontWeight: 800,
    fontSize: 12.5,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  spts: {
    fontWeight: 800,
    color: "#0f172a",
    fontSize: 12.5,
  },

  dots: {
    textAlign: "center",
    color: "#94a3b8",
    fontWeight: 1000,
    padding: "2px 0",
  },

  compactPitch: {
    position: "relative",
    height: 142,
    overflow: "hidden",
    borderRadius: 8,
    border: "1px solid #b8d0bf",
    background: "#1f6f36",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,.16)",
  },

  pitchShadow: {
    display: "none",
  },

  pitchBase: {
    display: "none",
  },

  pitchPlane: {
    position: "absolute",
    left: 6,
    right: 6,
    top: 6,
    bottom: 6,
    overflow: "hidden",
    borderRadius: 5,
    background:
      "repeating-linear-gradient(180deg, #2a7f43 0 17px, #23743c 17px 34px)",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,.18)",
  },

  pitchOuterLine: {
    position: "absolute",
    left: 6,
    right: 6,
    top: 6,
    bottom: 6,
    border: "1px solid rgba(255,255,255,.46)",
  },

  pitchPenaltyTop: {
    position: "absolute",
    left: "30%",
    right: "30%",
    top: 6,
    height: "17%",
    border: "1px solid rgba(255,255,255,.42)",
    borderTop: 0,
  },

  pitchPenaltyBottom: {
    position: "absolute",
    left: "23%",
    right: "23%",
    bottom: 6,
    height: "19%",
    border: "1px solid rgba(255,255,255,.46)",
    borderBottom: 0,
  },

  pitchGoalTop: {
    position: "absolute",
    left: "42%",
    right: "42%",
    top: 6,
    height: "6%",
    border: "1px solid rgba(255,255,255,.36)",
    borderTop: 0,
  },

  pitchGoalBottom: {
    position: "absolute",
    left: "39%",
    right: "39%",
    bottom: 6,
    height: "8%",
    border: "1px solid rgba(255,255,255,.42)",
    borderBottom: 0,
  },

  pitchPlayers: {
    position: "absolute",
    left: 8,
    right: 8,
    top: 9,
    bottom: 9,
    display: "grid",
    alignContent: "space-around",
    padding: "5px 5px",
    zIndex: 2,
  },

  pitchHalfway: {
    position: "absolute",
    left: 6,
    right: 6,
    top: "50%",
    height: 1,
    background: "rgba(255,255,255,.42)",
  },

  pitchCircleSmall: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 42,
    height: 42,
    marginLeft: -21,
    marginTop: -21,
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,.38)",
  },

  compactPitchRow: {
    position: "relative",
    zIndex: 2,
    display: "flex",
    justifyContent: "center",
    gap: 4,
    alignItems: "center",
  },

  compactPlayer: {
    display: "grid",
    justifyItems: "center",
    gap: 1,
    minWidth: 26,
  },

  compactPlayerName: {
    display: "block",
    maxWidth: 42,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "white",
    fontWeight: 800,
    fontSize: 7.5,
    textShadow: "0 1px 2px rgba(0,0,0,.45)",
  },

  modulePill: {
    background: "transparent",
    color: "#15803d",
    borderRadius: 0,
    padding: 0,
    fontWeight: 800,
    fontSize: 10.5,
    whiteSpace: "nowrap",
    flexShrink: 0,
  },

  lineupGrid: {
    display: "grid",
    gridTemplateColumns: "44% 1fr",
    gap: 12,
    alignItems: "stretch",
  },

  lineupPitchWrap: {
    minWidth: 0,
    display: "grid",
    alignItems: "center",
  },

  lineupStats: {
    minWidth: 0,
    display: "grid",
    alignContent: "center",
    gap: 6,
    padding: "2px 0",
  },

  statLine: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 8,
    alignItems: "baseline",
    paddingBottom: 6,
    borderBottom: "1px solid #eef2f7",
    color: "#64748b",
    fontSize: 11.5,
    fontWeight: 700,
  },

  statValue: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 850,
    textAlign: "right",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  secondaryBtn: {
    marginTop: 10,
    width: "100%",
    border: "1px solid #e1e7e3",
    background: "#fbfdfb",
    borderRadius: 8,
    padding: 8,
    color: "#15803d",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
  },

  roleTabs: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 3,
    marginBottom: 10,
    padding: 3,
    borderRadius: 8,
    background: "#f6f8f6",
    border: "1px solid #edf2ee",
  },

  roleTab: {
    border: "1px solid transparent",
    borderRadius: 6,
    padding: "5px 0",
    fontWeight: 800,
    fontSize: 11.5,
    cursor: "pointer",
  },

  topEmpty: {
    border: "1px solid #eef2f7",
    borderRadius: 8,
    padding: "11px 12px",
    display: "grid",
    gap: 3,
    color: "#64748b",
    textAlign: "left",
    fontWeight: 700,
    fontSize: 11.5,
    background: "#fbfdfb",
  },

  topGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 7,
  },

  topPlayerCard: {
    display: "grid",
    gridTemplateColumns: "20px 1fr auto",
    alignItems: "center",
    gap: 8,
    border: 0,
    borderRadius: 0,
    padding: "8px 0",
    background: "transparent",
    borderBottom: "1px solid #f1f5f9",
  },

  roleMini: {
    width: 18,
    height: 18,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    background: "#f8fafc",
    color: "#64748b",
    border: "1px solid #e5e7eb",
    fontSize: 10,
    fontWeight: 900,
  },

  topRank: {
    color: "#64748b",
    fontWeight: 800,
    fontSize: 12,
    textAlign: "center",
  },

  topName: {
    color: "#0f172a",
    fontSize: 12.5,
    fontWeight: 850,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  topSub: {
    color: "#64748b",
    fontSize: 10.5,
    fontWeight: 700,
  },

  ppUp: {
    color: "#15803d",
    background: "transparent",
    borderRadius: 0,
    padding: 0,
    fontSize: 12,
    fontWeight: 850,
  },

  ppDown: {
    color: "#dc2626",
    background: "transparent",
    borderRadius: 0,
    padding: 0,
    fontSize: 12,
    fontWeight: 850,
  },

  ppFlat: {
    color: "#475569",
    background: "transparent",
    borderRadius: 0,
    padding: 0,
    fontSize: 12,
    fontWeight: 850,
  },

  rulesRow: {
    width: "100%",
    border: "1px solid rgba(226,232,240,.9)",
    background: "rgba(255,255,255,.72)",
    borderRadius: 8,
    padding: "10px 12px",
    display: "grid",
    gridTemplateColumns: "22px 1fr auto",
    alignItems: "center",
    gap: 8,
    boxShadow: "none",
    cursor: "pointer",
    color: "#0f172a",
  },

  rulesIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    background: "transparent",
    color: "#15803d",
    display: "grid",
    placeItems: "center",
    fontWeight: 850,
  },

  rulesText: {
    fontSize: 12.5,
    fontWeight: 750,
    color: "#0f172a",
  },

  rulesArrow: {
    color: "#64748b",
    fontSize: 18,
    lineHeight: 1,
  },

  adminCard: {
    background: "rgba(255,255,255,.78)",
    border: "1px solid rgba(226,232,240,.9)",
    borderRadius: 8,
    padding: 12,
    boxShadow: "none",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  adminIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    background: "#f6f8f6",
    color: "#64748b",
    display: "grid",
    placeItems: "center",
    fontSize: 16,
    flexShrink: 0,
  },

  adminTitle: {
    margin: 0,
    fontSize: 13.5,
    lineHeight: 1.05,
    color: "#0f172a",
    fontWeight: 850,
  },

  adminText: {
    margin: "4px 0 0",
    color: "#64748b",
    fontWeight: 650,
    fontSize: 11.5,
    lineHeight: 1.35,
  },

  adminBtn: {
    border: "1px solid #16a34a",
    background: "white",
    color: "#15803d",
    borderRadius: 8,
    padding: "7px 11px",
    fontWeight: 850,
    fontSize: 12,
    cursor: "pointer",
    flexShrink: 0,
  },

  muted: {
    color: "#6b7280",
    fontWeight: 650,
    fontSize: 12,
    marginTop: 10,
  },

  emptySmall: {
    color: "#64748b",
    fontWeight: 700,
    fontSize: 12,
    background: "#f8fafc",
    borderRadius: 16,
    padding: 14,
  },

  recapCard: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderTop: "3px solid #e07b1a",
    borderRadius: 18,
    padding: 14,
    boxShadow: "0 8px 22px rgba(15,23,42,.08)",
  },

  recapRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
  },

  recapMascot: {
    width: 66,
    height: 66,
    borderRadius: 14,
    objectFit: "cover",
    flexShrink: 0,
    border: "2px solid #fff",
    boxShadow: "0 4px 12px rgba(0,0,0,.12)",
  },

  recapLabel: {
    fontSize: 10,
    fontWeight: 1000,
    color: "#e07b1a",
    textTransform: "uppercase",
    letterSpacing: ".05em",
  },

  recapText: {
    fontSize: 13,
    fontWeight: 600,
    color: "#334155",
    lineHeight: 1.5,
    margin: "4px 0 0",
  },

  recapBtn: {
    width: "100%",
    marginTop: 12,
    background: "#15803d",
    color: "white",
    border: 0,
    borderRadius: 14,
    padding: 11,
    fontWeight: 1000,
    fontSize: 13.5,
    cursor: "pointer",
  },

  error: {
    padding: 12,
    borderRadius: 14,
    background: "#fff1f2",
    color: "#991b1b",
    fontWeight: 800,
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
    borderRadius: 14,
    border: "1px solid #e5e7eb",
  },
};
