"use client";

import { useEffect, useState } from "react";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import LoadingScreen from "../components/LoadingScreen";
import CompetitionBadge from "../components/CompetitionBadge";
import TeamBadge from "../components/TeamBadge";
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
        fontWeight: 900,
        border: "1px solid rgba(255,255,255,.9)",
        boxShadow: "0 1px 4px rgba(15,23,42,.06)",
        flexShrink: 0,
      }}
    >
      {meta.label}
    </span>
  );
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
    if (app.userId && data.rows.some((r) => r.user_id === app.userId)) {
      setOpen((o) =>
        o[app.userId!] === undefined ? { ...o, [app.userId!]: true } : o
      );
    }
  }, [data.rows, app.userId]);

  if (!app.ready || loading) return <LoadingScreen />;

  const accent = app.competitionTheme.primary;
  const secondary = "#ea580c";

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

            <span style={{ ...s.livePill, color: secondary }}>
              <span style={{ ...s.liveDot, background: secondary }} />
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
                    size={30}
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
                            <RoleDot role={p.role} size={18} />
                          </div>

                          <div style={s.playerInfo}>
                            <div style={s.playerName}>{pLabel(p)}</div>
                            <div style={s.playerSub}>{pSub(p)}</div>
                          </div>

                          <span
                            style={{
                              ...s.playerPoints,
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
    padding: "10px 12px calc(76px + env(safe-area-inset-bottom, 0px) + 12px)",
    display: "grid",
    gap: 8,
  },

  head: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 10,
    boxShadow: "0 2px 10px rgba(15,23,42,.035)",
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
    borderRadius: 7,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    padding: "4px 7px",
    fontSize: 10,
    fontWeight: 900,
  },

  liveDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
  },

  title: {
    margin: "10px 0 2px",
    fontSize: 19,
    lineHeight: 1.05,
    letterSpacing: "-0.02em",
    fontWeight: 900,
    color: "#0f172a",
  },

  sub: {
    margin: 0,
    fontSize: 11.5,
    color: "#64748b",
    fontWeight: 750,
  },

  list: {
    display: "grid",
    gap: 6,
  },

  teamCard: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 9,
    padding: 0,
    overflow: "hidden",
    boxShadow: "0 1px 6px rgba(15,23,42,.03)",
  },

  teamTop: {
    width: "100%",
    border: 0,
    background: "transparent",
    padding: "8px 9px",
    display: "grid",
    gridTemplateColumns: "22px 30px minmax(0,1fr) auto",
    gap: 7,
    alignItems: "center",
    fontFamily: "inherit",
    cursor: "pointer",
    textAlign: "left",
  },

  rank: {
    fontSize: 13,
    fontWeight: 900,
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
    fontSize: 13,
    fontWeight: 850,
    letterSpacing: 0,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },

  youTag: {
    color: "white",
    fontSize: 9,
    fontWeight: 900,
    borderRadius: 4,
    padding: "1px 5px",
    flexShrink: 0,
  },

  toggle: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: 750,
  },

  scoreBox: {
    display: "grid",
    gridTemplateColumns: "auto 1px auto auto",
    gap: 6,
    alignItems: "center",
    whiteSpace: "nowrap",
  },

  scorePair: {
    display: "grid",
    justifyItems: "end",
    gap: 0,
  },

  liveScore: {
    fontSize: 14,
    lineHeight: 1,
    fontWeight: 900,
  },

  projected: {
    color: "#334155",
    fontSize: 14,
    lineHeight: 1,
    fontWeight: 900,
  },

  scoreSeparator: {
    width: 1,
    height: 24,
    background: "#fed7aa",
  },

  chevron: {
    color: "#64748b",
    fontSize: 15,
    lineHeight: 1,
    paddingLeft: 2,
  },

  players: {
    margin: "0 9px 9px",
    border: "1px solid #eef2f7",
    borderRadius: 7,
    overflow: "hidden",
    background: "white",
  },

  playerRow: {
    minHeight: 38,
    display: "grid",
    gridTemplateColumns: "22px 1fr auto",
    gap: 7,
    alignItems: "center",
    padding: "6px 8px",
    borderBottom: "1px solid #f1f5f9",
  },

  playerLeft: {
    position: "relative",
    width: 22,
    height: 22,
    display: "grid",
    alignItems: "center",
  },

  playerInfo: {
    minWidth: 0,
  },

  playerName: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 850,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },

  playerSub: {
    marginTop: 1,
    color: "#64748b",
    fontSize: 10,
    fontWeight: 650,
  },

  playerPoints: {
    minWidth: 36,
    textAlign: "center",
    padding: 0,
    borderRadius: 0,
    background: "transparent",
    fontSize: 12,
    fontWeight: 900,
  },

  noLineup: {
    padding: 10,
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 900,
  },

  emptyCard: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 9,
    padding: 14,
    color: "#64748b",
    fontWeight: 900,
    textAlign: "center",
    boxShadow: "0 1px 6px rgba(15,23,42,.03)",
  },

  refresh: {
    margin: "0",
    textAlign: "center",
    color: "#64748b",
    fontSize: 11.5,
    fontWeight: 700,
    padding: "2px 0",
  },

  err: {
    background: "#fff1f2",
    color: "#991b1b",
    padding: 12,
    borderRadius: 14,
    fontWeight: 800,
  },
};
