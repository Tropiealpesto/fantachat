"use client";

import { useEffect, useState } from "react";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import LoadingScreen from "../components/LoadingScreen";
import CompetitionBadge from "../components/CompetitionBadge";
import TeamBadge, { BadgePattern } from "../components/TeamBadge";
import { useRequireApp } from "../hooks/useRequireApp";
import { rpcJson, fmt, signedFmt } from "../../lib/rpc";
import { supabase } from "../../lib/supabaseClient";

type LivePlayer = {
  role: string;
  name: string;
  team: string;
  points: number;
};

type LiveRow = {
  user_id: string;
  team_name: string;
  live_score: number;
  projected_total: number;
  players: LivePlayer[];
  rank: number;
};

type LiveData = {
  matchday?: {
    id: string;
    number: number;
    status: string;
  } | null;
  rows: LiveRow[];
};

type Kit = {
  primary: string;
  secondary: string;
  pattern: BadgePattern;
};

const empty: LiveData = {
  matchday: null,
  rows: [],
};

const ROLE_META: Record<string, { bg: string; fg: string; label: string }> = {
  P: { bg: "#FEF3C7", fg: "#B45309", label: "P" },
  D: { bg: "#DCFCE7", fg: "#15803D", label: "D" },
  C: { bg: "#DBEAFE", fg: "#2563EB", label: "C" },
  A: { bg: "#FEE2E2", fg: "#DC2626", label: "A" },
};

function pLabel(p: LivePlayer) {
  return p.role === "P" ? p.team || p.name : p.name;
}

function pSub(p: LivePlayer) {
  return p.role === "P" ? "Portiere" : `${p.role} · ${p.team}`;
}

function liveValue(v: number) {
  return signedFmt(v);
}

function liveColor(v: number) {
  if (v > 0) return "#15803d";
  if (v < 0) return "#dc2626";
  return "#64748b";
}

function liveBg(v: number) {
  if (v > 0) return "#dcfce7";
  if (v < 0) return "#fee2e2";
  return "#f1f5f9";
}

function RoleDot({ role, size = 26 }: { role: string; size?: number }) {
  const meta =
    ROLE_META[role] ?? {
      bg: "#f1f5f9",
      fg: "#475569",
      label: role,
    };

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
        fontSize: Math.max(10, size * 0.38),
        fontWeight: 1000,
        border: "2px solid rgba(255,255,255,.9)",
        boxShadow: "0 3px 8px rgba(15,23,42,.10)",
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
  size = 36,
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

export default function LivePage() {
  const app = useRequireApp(true);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LiveData>(empty);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [memberColors, setMemberColors] = useState<
    Record<string, { primary: string | null; secondary: string | null }>
  >({});
  const [teamColors, setTeamColors] = useState<Record<string, Kit>>({});

  function kitOf(team?: string | null): Kit | null {
    if (!team) return null;
    return teamColors[team.trim().toLowerCase()] ?? null;
  }

  useEffect(() => {
    if (!app.ready || !app.activeLeagueCompetitionId) return;

    let off = false;

    async function load() {
      try {
        const r = await rpcJson<LiveData>(
          "get_live_data",
          { p_league_competition_id: app.activeLeagueCompetitionId },
          empty
        );

        if (!off) {
          setData(r ?? empty);
          setErr(null);
        }
      } catch (e: any) {
        if (!off) setErr(e.message);
      } finally {
        if (!off) setLoading(false);
      }
    }

    load();

    const t = setInterval(load, 15000);

    return () => {
      off = true;
      clearInterval(t);
    };
  }, [app.ready, app.activeLeagueCompetitionId]);

  useEffect(() => {
    if (!app.ready || !app.activeLeagueId) return;

    let off = false;

    supabase
      .rpc("get_league_members", { p_league_id: app.activeLeagueId })
      .then(({ data }) => {
        if (off) return;

        const mc: Record<
          string,
          { primary: string | null; secondary: string | null }
        > = {};

        ((data as any[] | null) ?? []).forEach((m) => {
          mc[m.user_id] = {
            primary: m.color_primary ?? null,
            secondary: m.color_secondary ?? null,
          };
        });

        setMemberColors(mc);
      });

    return () => {
      off = true;
    };
  }, [app.ready, app.activeLeagueId]);

  useEffect(() => {
    const lc = app.activeLeagueCompetitionId;
    if (!lc) return;

    let off = false;

    supabase
      .rpc("get_competition_team_colors", { p_league_competition_id: lc })
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

    return () => {
      off = true;
    };
  }, [app.activeLeagueCompetitionId]);

  useEffect(() => {
    if (app.userId && data.rows.some((r) => r.user_id === app.userId)) {
      setOpen((o) =>
        o[app.userId!] === undefined ? { ...o, [app.userId!]: true } : o
      );
    }
  }, [data.rows, app.userId]);

  if (!app.ready || loading) return <LoadingScreen />;

  const accent = app.competitionTheme.primary;

  return (
    <>
      <AppBar
        league={app.leagueName}
        team={app.teamName}
        onMenuOpen={app.openDrawer}
      />

      <main style={s.container}>
        <section style={s.head}>
          <div style={s.headTop}>
            <CompetitionBadge
              name={app.competitionName}
              type={app.competitionType}
            />

            <span style={{ ...s.livePill, color: accent }}>
              <span style={{ ...s.liveDot, background: accent }} />
              LIVE
            </span>
          </div>

          <h1 style={s.title}>Classifica live</h1>

          <p style={s.sub}>
            {data.matchday
              ? `Giornata ${data.matchday.number} · ${
                  data.matchday.status === "open"
                    ? "in corso"
                    : data.matchday.status
                }`
              : "Nessuna giornata attiva"}
          </p>

          <div style={s.divider} />

          <div style={s.legend}>
            <span>
              <span style={{ ...s.legendDot, background: accent }} />
              <b>Live</b> = punti di oggi
            </span>

            <span>
              <span style={{ ...s.legendDot, background: "#94a3b8" }} />
              <b>Classifica</b> = totale aggiornato
            </span>
          </div>

          <p style={s.note}>
            I punteggi cambiano quando vengono inserite nuove statistiche.
          </p>
        </section>

        {err && <div style={s.err}>{err}</div>}

        <section style={s.list}>
          {data.rows.map((r) => {
            const own = r.user_id === app.userId;
            const isOpen = !!open[r.user_id];
            const c = memberColors[r.user_id];

            return (
              <article
                key={r.user_id}
                style={{
                  ...s.teamCard,
                  ...(own ? { borderColor: accent, background: "#f3fbf5" } : {}),
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpen((o) => ({ ...o, [r.user_id]: !o[r.user_id] }))
                  }
                  style={s.teamTop}
                >
                  <div style={{ ...s.rank, color: own ? accent : "#64748b" }}>
                    {r.rank}
                  </div>

                  <TeamBadge
                    name={r.team_name}
                    primary={c?.primary ?? null}
                    secondary={c?.secondary ?? null}
                    size={46}
                  />

                  <div style={s.teamInfo}>
                    <div style={s.nameRow}>
                      <span style={s.teamName}>{r.team_name}</span>
                      {own && <span style={{ ...s.youTag, background: accent }}>TU</span>}
                    </div>

                    <div style={{ ...s.toggle, color: own ? accent : "#94a3b8" }}>
                      {isOpen ? "▾ nascondi giocatori" : "▸ mostra giocatori"}
                    </div>
                  </div>

                  <div style={s.scoreBox}>
                    <div style={s.scorePair}>
                      <strong
                        style={{
                          ...s.liveScore,
                          color: liveColor(r.live_score),
                        }}
                      >
                        {liveValue(r.live_score)}
                      </strong>
                      <small>live</small>
                    </div>

                    <div style={s.scoreSeparator} />

                    <div style={s.scorePair}>
                      <strong style={s.projected}>{fmt(r.projected_total)}</strong>
                      <small>in classifica</small>
                    </div>

                    <span style={s.chevron}>{isOpen ? "⌃" : "⌄"}</span>
                  </div>
                </button>

                {isOpen && (
                  <div style={s.players}>
                    {r.players.length === 0 ? (
                      <div style={s.noLineup}>Nessuna formazione schierata.</div>
                    ) : (
                      r.players.map((p, i) => (
                        <div key={`${p.name}-${i}`} style={s.playerRow}>
                          <div style={s.playerLeft}>
                            <PlayerCrest
                              team={p.team || p.name}
                              colors={kitOf(p.team)}
                              size={36}
                            />

                            <RoleDot role={p.role} size={24} />
                          </div>

                          <div style={s.playerInfo}>
                            <div style={s.playerName}>{pLabel(p)}</div>
                            <div style={s.playerSub}>{pSub(p)}</div>
                          </div>

                          <span
                            style={{
                              ...s.playerPoints,
                              background: liveBg(p.points),
                              color: liveColor(p.points),
                            }}
                          >
                            {liveValue(p.points)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </article>
            );
          })}

          {!data.rows.length && (
            <div style={s.emptyCard}>
              Nessun dato live disponibile per questa giornata.
            </div>
          )}
        </section>

        <p style={s.refresh}>
          Si aggiorna automaticamente ogni 15 secondi
        </p>
      </main>

      <BottomNav />
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 520,
    margin: "0 auto",
    padding: "16px 14px calc(76px + env(safe-area-inset-bottom, 0px) + 18px)",
    display: "grid",
    gap: 14,
  },

  head: {
    background: "white",
    border: "1px solid #dbe4dd",
    borderRadius: 8,
    padding: 18,
    boxShadow: "0 12px 28px rgba(19,35,26,.08)",
  },

  headTop: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  livePill: {
    marginLeft: "auto",
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    borderRadius: 8,
    background: "#f8fafc",
    border: "1px solid #dbe4dd",
    padding: "7px 12px",
    fontSize: 12,
    fontWeight: 1000,
  },

  liveDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
  },

  title: {
    margin: "20px 0 4px",
    fontSize: 34,
    lineHeight: 1.05,
    letterSpacing: "-0.05em",
    fontWeight: 1000,
    color: "#0f172a",
  },

  sub: {
    margin: 0,
    fontSize: 17,
    color: "#15803d",
    fontWeight: 1000,
  },

  divider: {
    height: 1,
    background: "#dbe4dd",
    margin: "18px 0 14px",
  },

  legend: {
    display: "grid",
    gap: 8,
    color: "#475569",
    fontSize: 13,
    fontWeight: 850,
  },

  legendDot: {
    width: 9,
    height: 9,
    borderRadius: "50%",
    display: "inline-block",
    marginRight: 8,
  },

  note: {
    margin: "12px 0 0",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 750,
    lineHeight: 1.4,
  },

  list: {
    display: "grid",
    gap: 12,
  },

  teamCard: {
    background: "white",
    border: "1px solid #dbe4dd",
    borderRadius: 8,
    padding: 0,
    overflow: "hidden",
    boxShadow: "0 12px 28px rgba(19,35,26,.08)",
  },

  teamTop: {
    width: "100%",
    border: 0,
    background: "transparent",
    padding: "16px 14px",
    display: "grid",
    gridTemplateColumns: "32px 46px 1fr auto",
    gap: 12,
    alignItems: "center",
    fontFamily: "inherit",
    cursor: "pointer",
    textAlign: "left",
  },

  rank: {
    fontSize: 22,
    fontWeight: 1000,
    textAlign: "center",
  },

  teamInfo: {
    minWidth: 0,
  },

  nameRow: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    minWidth: 0,
  },

  teamName: {
    color: "#0f172a",
    fontSize: 19,
    fontWeight: 1000,
    letterSpacing: "-0.02em",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },

  youTag: {
    color: "white",
    fontSize: 10,
    fontWeight: 1000,
    borderRadius: 7,
    padding: "2px 6px",
    flexShrink: 0,
  },

  toggle: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: 900,
  },

  scoreBox: {
    display: "grid",
    gridTemplateColumns: "auto 1px auto auto",
    gap: 10,
    alignItems: "center",
    whiteSpace: "nowrap",
  },

  scorePair: {
    display: "grid",
    justifyItems: "end",
    gap: 1,
  },

  liveScore: {
    fontSize: 25,
    lineHeight: 1,
    fontWeight: 1000,
  },

  projected: {
    color: "#334155",
    fontSize: 25,
    lineHeight: 1,
    fontWeight: 1000,
  },

  scoreSeparator: {
    width: 1,
    height: 38,
    background: "#e5e7eb",
  },

  chevron: {
    color: "#64748b",
    fontSize: 22,
    lineHeight: 1,
    paddingLeft: 2,
  },

  players: {
    margin: "0 14px 14px",
    border: "1px solid #dbe4dd",
    borderRadius: 8,
    overflow: "hidden",
    background: "white",
  },

  playerRow: {
    minHeight: 62,
    display: "grid",
    gridTemplateColumns: "52px 1fr auto",
    gap: 10,
    alignItems: "center",
    padding: "10px 12px",
    borderBottom: "1px solid #f1f5f9",
  },

  playerLeft: {
    position: "relative",
    width: 52,
    height: 42,
    display: "grid",
    alignItems: "center",
  },

  playerInfo: {
    minWidth: 0,
  },

  playerName: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 1000,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },

  playerSub: {
    marginTop: 2,
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
  },

  playerPoints: {
    minWidth: 42,
    textAlign: "center",
    padding: "5px 9px",
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 1000,
  },

  noLineup: {
    padding: 14,
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 900,
  },

  emptyCard: {
    background: "white",
    border: "1px solid #dbe4dd",
    borderRadius: 8,
    padding: 18,
    color: "#64748b",
    fontWeight: 900,
    textAlign: "center",
    boxShadow: "0 8px 18px rgba(19,35,26,.06)",
  },

  refresh: {
    margin: "0",
    textAlign: "center",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 850,
    padding: "4px 0 2px",
  },

  err: {
    background: "#fff1f2",
    color: "#991b1b",
    padding: 12,
    borderRadius: 8,
    fontWeight: 800,
  },
};
