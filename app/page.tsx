"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppBar from "./components/AppBar";
import BottomNav from "./components/BottomNav";
import LoadingScreen from "./components/LoadingScreen";
import CompetitionBadge from "./components/CompetitionBadge";
import TeamBadge, { BadgePattern } from "./components/TeamBadge";
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

type Kit = {
  primary: string;
  secondary: string;
  pattern: BadgePattern;
};

const emptyHome: HomeData = {
  matchday: null,
  lineup: null,
  stats: null,
};

const ROLE_ORDER = ["A", "C", "D", "P"];
const TOP_ROLE_ORDER = ["P", "D", "C", "A"];

const ROLE_META: Record<string, { bg: string; fg: string; label: string }> = {
  P: { bg: "#FEF3C7", fg: "#B45309", label: "P" },
  D: { bg: "#DCFCE7", fg: "#15803D", label: "D" },
  C: { bg: "#DBEAFE", fg: "#2563EB", label: "C" },
  A: { bg: "#FEE2E2", fg: "#DC2626", label: "A" },
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
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "inline-grid",
        placeItems: "center",
        background: meta.bg,
        color: meta.fg,
        fontSize: Math.max(12, size * 0.38),
        fontWeight: 1000,
        border: "2px solid rgba(255,255,255,.88)",
        boxShadow: "0 4px 10px rgba(15,23,42,.14)",
        flexShrink: 0,
      }}
    >
      {meta.label}
    </span>
  );
}

function PlayerCrest({
  team,
  colors,
  size = 40,
}: {
  team: string;
  colors: Kit | null;
  size?: number;
}) {
  if (colors) {
    return (
      <TeamBadge
        name={team}
        primary={colors.primary}
        secondary={colors.secondary}
        pattern={colors.pattern}
        showInitials={false}
        size={size}
      />
    );
  }

  return <TeamBadge name={team} showInitials={false} size={size} />;
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
  const [teamColors, setTeamColors] = useState<Record<string, Kit>>({});
  const [standings, setStandings] = useState<StandRow[]>([]);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [topRole, setTopRole] = useState<string>("A");

  const [competitionStatus, setCompetitionStatus] =
    useState<CompetitionStatus | null>(null);
  const [finalStanding, setFinalStanding] = useState<StandRow[]>([]);

  function kitOf(team?: string | null): Kit | null {
    if (!team) return null;
    return teamColors[team.trim().toLowerCase()] ?? null;
  }

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
      .rpc("get_competition_team_colors", {
        p_league_competition_id: lc,
      })
      .then(({ data }) => {
        if (off || !data) return;

        const m: Record<string, Kit> = {};

        (data as any[]).forEach((r) => {
          if (r.name && r.color_primary) {
            m[String(r.name).trim().toLowerCase()] = {
              primary: r.color_primary,
              secondary: r.color_secondary || r.color_primary,
              pattern: (r.kit_pattern || "split") as BadgePattern,
            };
          }
        });

        setTeamColors(m);
      });

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

        <section style={{ ...s.hero, background: theme.hero }}>
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

  const hasLineup = Boolean(data.lineup?.players?.length);
  const mvpLabel =
    recap?.mvp_role === "P" ? recap?.mvp_team || recap?.mvp_name : recap?.mvp_name;

  const top5 = standings.slice(0, 5);
  const meInTop = top5.some((r) => r.user_id === app.userId);
  const myRow = standings.find((r) => r.user_id === app.userId);
  const topPlayersForRole = topPlayers
    .filter((p) => p.role === topRole)
    .slice(0, 3);

  function StandLine({ row, mine }: { row: StandRow; mine: boolean }) {
    const c = memberColors[row.user_id];

    return (
      <div
        style={{
          ...s.srow,
          background: mine ? `${theme.primary}10` : "white",
          borderLeft: `4px solid ${mine ? theme.primary : "transparent"}`,
        }}
      >
        <span style={s.srank}>{cleanRank(row.rank)}</span>

        <TeamBadge
          name={row.team_name}
          primary={c?.primary ?? null}
          secondary={c?.secondary ?? null}
          size={34}
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

      <section style={{ ...s.hero, background: theme.hero }}>
        <div style={s.heroInner}>
          <CompetitionBadge
            name={app.competitionName}
            type={app.competitionType}
          />

          <div style={s.heroRow}>
            <span style={s.badgeRing}>
              <TeamBadge
                name={app.teamName}
                primary={myColors.primary}
                secondary={myColors.secondary}
                size={68}
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
              value={data.stats?.rank ? `#${data.stats.rank}` : "—"}
            />
            <Kpi label="Totale" value={`${fmt(data.stats?.total_points)} pt`} />
            <Kpi label="Media" value={`${fmt(data.stats?.avg_points)} pt`} />
          </div>
        </div>
      </section>

      <main style={s.container}>
        {err && <div style={s.error}>Errore: {err}</div>}

        <div style={s.matchdayCard}>
          <div style={s.matchdayIcon}>▦</div>

          <div style={{ flex: 1 }}>
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

        {hasLineup && (
          <section style={s.card}>
            <div style={s.sectionHeader}>
              <h2 style={s.sectionTitle}>Il tuo schieramento</h2>

              <span style={s.modulePill}>
                {lineupGroups.map((g) => g.items.length).join("-")}
              </span>
            </div>

            <div style={s.compactPitch}>
              <div style={s.pitchHalfway} />
              <div style={s.pitchCircleSmall} />

              {lineupGroups.map((g) => (
                <div key={g.role} style={s.compactPitchRow}>
                  {g.items.map((p, i) => (
                    <div key={`${p.name}-${i}`} style={s.compactPlayer}>
                      <RoleDot role={p.role} size={40} />

                      <span style={s.compactPlayerName}>
                        {p.role === "P" ? p.team || p.name : shortName(p.name)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <button
              onClick={() => router.push("/rosa")}
              style={s.secondaryBtn}
            >
              Vedi rosa completa
            </button>
          </section>
        )}

        <section style={s.card}>
          <div style={s.sectionHeader}>
            <h2 style={s.sectionTitle}>Top giocatori</h2>

            <button
              onClick={() => router.push("/statistiche")}
              style={s.textLink}
            >
              Vedi tutti →
            </button>
          </div>

          <div style={s.roleTabs}>
            {TOP_ROLE_ORDER.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setTopRole(role)}
                style={{
                  ...s.roleTab,
                  background: topRole === role ? roleColor(role).bg : "#f3f4f6",
                  color: topRole === role ? roleColor(role).fg : "#64748b",
                }}
              >
                {role}
              </button>
            ))}
          </div>

          {topPlayersForRole.length === 0 ? (
            <div style={s.topEmpty}>
              <b>Statistiche non ancora disponibili.</b>
              <span>
                I migliori giocatori compariranno qui dopo l’aggiornamento.
              </span>
            </div>
          ) : (
            <div style={s.topGrid}>
              {topPlayersForRole.map((p, i) => (
                <div key={`${p.name}-${i}`} style={s.topPlayerCard}>
                  <span style={s.topRank}>{i + 1}</span>

                  <PlayerCrest
                    team={p.team || p.name}
                    colors={kitOf(p.team)}
                    size={38}
                  />

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

        <button onClick={() => router.push("/regole")} style={s.rulesRow}>
          <span style={s.rulesIcon}>◎</span>
          <b>Regole competizione</b>
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
            <div style={s.adminIcon}>⚙️</div>

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
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  topBtn: {
    border: "1px solid #fed7aa",
    borderRadius: 999,
    background: "white",
    color: "#ea580c",
    padding: "8px 18px",
    fontWeight: 1000,
    cursor: "pointer",
  },

  hero: {
    color: "white",
    padding: "22px 18px 110px",
    marginBottom: -94,
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
    gap: 16,
    marginTop: 22,
  },

  badgeRing: {
    borderRadius: "50%",
    padding: 4,
    border: "2px solid rgba(255,255,255,.88)",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    boxShadow: "0 10px 24px rgba(0,0,0,.16)",
  },

  hello: {
    opacity: 0.82,
    fontWeight: 900,
    fontSize: 16,
  },

  team: {
    fontSize: 34,
    lineHeight: 1.04,
    margin: "4px 0 0",
    fontWeight: 1000,
    letterSpacing: "-0.04em",
  },

  kpis: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
    marginTop: 22,
  },

  kpi: {
    background: "rgba(255,255,255,.14)",
    border: "1px solid rgba(255,255,255,.22)",
    borderRadius: 18,
    padding: "15px 10px",
    display: "grid",
    gap: 5,
    textAlign: "center",
    backdropFilter: "blur(12px)",
  },

  container: {
    maxWidth: 520,
    margin: "0 auto",
    padding: "0 14px calc(76px + env(safe-area-inset-bottom, 0px) + 18px)",
    display: "grid",
    gap: 14,
  },

  card: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 10px 28px rgba(15,23,42,.08)",
  },

  matchdayCard: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 12px 30px rgba(15,23,42,.10)",
    display: "grid",
    gridTemplateColumns: "58px 1fr auto",
    gap: 14,
    alignItems: "center",
  },

  matchdayIcon: {
    width: 54,
    height: 54,
    borderRadius: "50%",
    background: "#eaf7ee",
    color: "#15803d",
    display: "grid",
    placeItems: "center",
    fontSize: 22,
    fontWeight: 1000,
  },

  label: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: ".02em",
  },

  matchday: {
    fontSize: 42,
    fontWeight: 1000,
    lineHeight: 1,
    color: "#0f172a",
  },

  status: {
    borderRadius: 999,
    padding: "7px 15px",
    fontWeight: 1000,
    fontSize: 14,
  },

  primaryBtn: {
    gridColumn: "1 / -1",
    width: "100%",
    border: 0,
    color: "white",
    borderRadius: 13,
    padding: 14,
    fontWeight: 1000,
    cursor: "pointer",
    marginTop: 2,
    boxShadow: "inset 0 -1px 0 rgba(0,0,0,.08)",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },

  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 20,
    fontWeight: 1000,
    letterSpacing: "-0.03em",
  },

  textLink: {
    border: 0,
    background: "transparent",
    color: "#15803d",
    fontWeight: 1000,
    fontSize: 13,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  standingsBox: {
    display: "grid",
    gap: 8,
  },

  srow: {
    display: "grid",
    gridTemplateColumns: "34px 34px 1fr auto",
    gap: 10,
    alignItems: "center",
    padding: "10px 10px",
    borderRadius: 14,
  },

  srank: {
    fontWeight: 1000,
    color: "#64748b",
    fontSize: 16,
    textAlign: "center",
  },

  sname: {
    fontWeight: 1000,
    fontSize: 15,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  spts: {
    fontWeight: 1000,
    color: "#0f172a",
    fontSize: 14,
  },

  dots: {
    textAlign: "center",
    color: "#94a3b8",
    fontWeight: 1000,
    padding: "2px 0",
  },

  compactPitch: {
    position: "relative",
    height: 184,
    overflow: "hidden",
    background: "linear-gradient(180deg, #74bd67, #4fae55)",
    borderRadius: 18,
    border: "4px solid #6dbf70",
    display: "grid",
    alignContent: "space-around",
    padding: "14px 18px",
    boxShadow: "inset 0 0 0 2px rgba(255,255,255,.35)",
  },

  pitchHalfway: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: 2,
    background: "rgba(255,255,255,.42)",
  },

  pitchCircleSmall: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 70,
    height: 70,
    marginLeft: -35,
    marginTop: -35,
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,.42)",
  },

  compactPitchRow: {
    position: "relative",
    zIndex: 2,
    display: "flex",
    justifyContent: "center",
    gap: 15,
    alignItems: "center",
  },

  compactPlayer: {
    display: "grid",
    justifyItems: "center",
    gap: 4,
    minWidth: 54,
  },

  compactPlayerName: {
    maxWidth: 70,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "white",
    fontWeight: 1000,
    fontSize: 10.5,
    textShadow: "0 1px 2px rgba(0,0,0,.35)",
  },

  modulePill: {
    background: "#dcfce7",
    color: "#15803d",
    borderRadius: 999,
    padding: "6px 12px",
    fontWeight: 1000,
    fontSize: 13,
  },

  secondaryBtn: {
    marginTop: 12,
    width: "100%",
    border: "1px solid #d1d5db",
    background: "white",
    borderRadius: 12,
    padding: 11,
    color: "#15803d",
    fontWeight: 1000,
    cursor: "pointer",
  },

  roleTabs: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 8,
    marginBottom: 12,
  },

  roleTab: {
    border: 0,
    borderRadius: 999,
    padding: "8px 0",
    fontWeight: 1000,
    cursor: "pointer",
  },

  topEmpty: {
    border: "1px dashed #cbd5e1",
    borderRadius: 14,
    padding: 16,
    display: "grid",
    gap: 5,
    color: "#64748b",
    textAlign: "center",
    fontWeight: 800,
    fontSize: 13,
  },

  topGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 8,
  },

  topPlayerCard: {
    display: "grid",
    gridTemplateColumns: "26px 38px 1fr auto",
    alignItems: "center",
    gap: 9,
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 10,
  },

  topRank: {
    color: "#64748b",
    fontWeight: 1000,
    textAlign: "center",
  },

  topName: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 1000,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  topSub: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
  },

  ppUp: {
    background: "#dcfce7",
    color: "#15803d",
    borderRadius: 999,
    padding: "4px 9px",
  },

  ppDown: {
    background: "#fee2e2",
    color: "#dc2626",
    borderRadius: 999,
    padding: "4px 9px",
  },

  ppFlat: {
    background: "#f1f5f9",
    color: "#475569",
    borderRadius: 999,
    padding: "4px 9px",
  },

  rulesRow: {
    width: "100%",
    border: "1px solid #e5e7eb",
    background: "white",
    borderRadius: 18,
    padding: "15px 16px",
    display: "grid",
    gridTemplateColumns: "34px 1fr auto",
    alignItems: "center",
    gap: 10,
    boxShadow: "0 6px 18px rgba(15,23,42,.06)",
    cursor: "pointer",
    color: "#0f172a",
  },

  rulesIcon: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "#f0fdf4",
    color: "#15803d",
    display: "grid",
    placeItems: "center",
    fontWeight: 1000,
  },

  rulesArrow: {
    color: "#0f172a",
    fontSize: 26,
    lineHeight: 1,
  },

  adminCard: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 10px 28px rgba(15,23,42,.08)",
    display: "flex",
    alignItems: "center",
    gap: 14,
  },

  adminIcon: {
    width: 52,
    height: 52,
    borderRadius: "50%",
    background: "#f1f5f9",
    display: "grid",
    placeItems: "center",
    fontSize: 24,
    flexShrink: 0,
  },

  adminTitle: {
    margin: 0,
    fontSize: 20,
    lineHeight: 1.05,
    color: "#0f172a",
    fontWeight: 1000,
  },

  adminText: {
    margin: "5px 0 0",
    color: "#64748b",
    fontWeight: 800,
    fontSize: 13,
    lineHeight: 1.35,
  },

  adminBtn: {
    border: "1px solid #16a34a",
    background: "white",
    color: "#15803d",
    borderRadius: 14,
    padding: "11px 15px",
    fontWeight: 1000,
    cursor: "pointer",
    flexShrink: 0,
  },

  muted: {
    color: "#6b7280",
    fontWeight: 700,
    fontSize: 13,
    marginTop: 10,
  },

  emptySmall: {
    color: "#64748b",
    fontWeight: 800,
    fontSize: 13,
    background: "#f8fafc",
    borderRadius: 14,
    padding: 14,
  },

  recapCard: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderTop: "3px solid #ea580c",
    borderRadius: 18,
    padding: 15,
    boxShadow: "0 4px 16px rgba(0,0,0,.06)",
  },

  recapRow: {
    display: "flex",
    gap: 13,
    alignItems: "center",
  },

  recapMascot: {
    width: 78,
    height: 78,
    borderRadius: 16,
    objectFit: "cover",
    flexShrink: 0,
    border: "2px solid #fff",
    boxShadow: "0 4px 12px rgba(0,0,0,.12)",
  },

  recapLabel: {
    fontSize: 10.5,
    fontWeight: 1000,
    color: "#ea580c",
    textTransform: "uppercase",
    letterSpacing: ".05em",
  },

  recapText: {
    fontSize: 13.5,
    fontWeight: 600,
    color: "#334155",
    lineHeight: 1.5,
    margin: "4px 0 0",
  },

  recapBtn: {
    width: "100%",
    marginTop: 13,
    background: "#15803d",
    color: "white",
    border: 0,
    borderRadius: 12,
    padding: 12,
    fontWeight: 1000,
    fontSize: 14,
    cursor: "pointer",
  },

  error: {
    padding: 12,
    borderRadius: 12,
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
    borderRadius: 12,
    border: "1px solid #e5e7eb",
  },
};