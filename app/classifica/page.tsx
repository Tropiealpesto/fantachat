"use client";

import { useEffect, useMemo, useState } from "react";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import LoadingScreen from "../components/LoadingScreen";
import CompetitionBadge from "../components/CompetitionBadge";
import TeamBadge from "../components/TeamBadge";
import { useRequireApp } from "../hooks/useRequireApp";
import { rpcJson, fmt } from "../../lib/rpc";

type Row = {
  user_id: string;
  team_name: string;
  total_points: number;
  p_total: number;
  d_total: number;
  c_total: number;
  a_total: number;
  rank: number;
};

function normalizeRows(value: unknown): Row[] {
  if (Array.isArray(value)) return value as Row[];

  const anyValue = value as any;

  if (Array.isArray(anyValue?.rows)) return anyValue.rows as Row[];
  if (Array.isArray(anyValue?.standings)) return anyValue.standings as Row[];
  if (Array.isArray(anyValue?.data)) return anyValue.data as Row[];
  if (Array.isArray(anyValue?.items)) return anyValue.items as Row[];

  return [];
}

function cleanRank(rank?: number | null, fallback?: number) {
  if (!rank || rank >= 999) return fallback ? String(fallback) : "—";
  return String(rank);
}

function gapText(value: number | null, prefix: string) {
  if (value === null) return "—";
  if (value === 0) return "pari";
  return `${prefix}${fmt(Math.abs(value))} pt`;
}

function roleValue(v?: number | null) {
  return fmt(v ?? 0);
}

export default function Classifica() {
  const app = useRequireApp(false);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!app.ready) return;

    if (!app.activeLeagueId || !app.activeLeagueCompetitionId) {
      setRows([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);

      try {
        const result = await rpcJson<unknown>(
          "get_standings",
          {
            p_league_competition_id: app.activeLeagueCompetitionId,
          },
          []
        );

        if (!cancelled) {
          setRows(normalizeRows(result));
        }
      } catch (e: any) {
        if (!cancelled) {
          setRows([]);
          setErr(e?.message ?? String(e));
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
  }, [app.ready, app.activeLeagueId, app.activeLeagueCompetitionId]);

  const theme = app.competitionTheme;

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const ar = a.rank || 999;
      const br = b.rank || 999;

      if (ar !== br) return ar - br;
      return (b.total_points ?? 0) - (a.total_points ?? 0);
    });
  }, [rows]);

  const myIndex = sortedRows.findIndex((r) => r.user_id === app.userId);
  const myRow = myIndex >= 0 ? sortedRows[myIndex] : null;
  const leader = sortedRows[0] ?? null;
  const above = myIndex > 0 ? sortedRows[myIndex - 1] : null;
  const below =
    myIndex >= 0 && myIndex < sortedRows.length - 1
      ? sortedRows[myIndex + 1]
      : null;

  const gapFromLeader =
    myRow && leader ? (leader.total_points ?? 0) - (myRow.total_points ?? 0) : null;

  const gapFromAbove =
    myRow && above ? (above.total_points ?? 0) - (myRow.total_points ?? 0) : null;

  const gapToBelow =
    myRow && below ? (myRow.total_points ?? 0) - (below.total_points ?? 0) : null;

  const bestRole = useMemo(() => {
    if (!rows.length) return null;

    const roles = [
      { key: "P", label: "Portieri", field: "p_total" as const },
      { key: "D", label: "Difensori", field: "d_total" as const },
      { key: "C", label: "Centrocampisti", field: "c_total" as const },
      { key: "A", label: "Attaccanti", field: "a_total" as const },
    ];

    return roles
      .map((role) => {
        const top = [...rows].sort(
          (a, b) => Number(b[role.field] ?? 0) - Number(a[role.field] ?? 0)
        )[0];

        return {
          role: role.key,
          label: role.label,
          team: top?.team_name ?? "—",
          value: Number(top?.[role.field] ?? 0),
        };
      })
      .sort((a, b) => b.value - a.value)[0];
  }, [rows]);

  if (!app.ready || loading) return <LoadingScreen />;

  return (
    <>
      <AppBar
        league={app.leagueName}
        team={app.teamName}
        onMenuOpen={app.openDrawer}
      />

      <main style={s.container}>
        <section style={s.head}>
          <CompetitionBadge
            name={app.competitionName}
            type={app.competitionType}
          />

          <div style={s.titleRow}>
            <div>
              <h1 style={s.title}>Classifica</h1>
              <p style={s.subtitle}>
                Ranking generale della competizione
              </p>
            </div>

            {myRow && (
              <div style={{ ...s.positionBox, background: `${theme.primary}12` }}>
                <span style={{ color: theme.primary }}>
                  #{cleanRank(myRow.rank, myIndex + 1)}
                </span>
                <small>posizione</small>
              </div>
            )}
          </div>

          {myRow && (
            <div style={s.summaryGrid}>
              <SummaryItem
                label="Dal 1°"
                value={
                  gapFromLeader === 0
                    ? "pari"
                    : gapText(gapFromLeader, "-")
                }
              />
              <SummaryItem
                label="Da chi precede"
                value={
                  above
                    ? gapText(gapFromAbove, "-")
                    : "sei davanti"
                }
              />
              <SummaryItem
                label="Su chi segue"
                value={
                  below
                    ? gapText(gapToBelow, "+")
                    : "ultimo dato"
                }
              />
            </div>
          )}
        </section>

        {!app.activeLeagueCompetitionId && (
          <div style={s.err}>
            Nessuna competizione attiva selezionata.
          </div>
        )}

        {err && <div style={s.err}>Errore: {err}</div>}

        <section style={s.card}>
          <div style={s.sectionHeader}>
            <h2 style={s.sectionTitle}>Generale</h2>

            <span style={s.smallHint}>
              {rows.length} squadre
            </span>
          </div>

          <div style={s.leaderboard}>
            {sortedRows.map((r, index) => {
              const isMine = r.user_id === app.userId;
              const podium = index < 3;

              return (
                <article
                  key={`${r.user_id ?? "user"}-${r.rank ?? index}-${index}`}
                  style={{
                    ...s.row,
                    background: isMine ? `${theme.primary}10` : "white",
                    borderColor: isMine
                      ? `${theme.primary}55`
                      : podium
                        ? "#fde68a"
                        : "#e5e7eb",
                    boxShadow: isMine
                      ? `0 10px 26px ${theme.primary}18`
                      : "0 4px 14px rgba(15,23,42,.04)",
                  }}
                >
                  <div
                    style={{
                      ...s.rank,
                      color: isMine
                        ? theme.primary
                        : podium
                          ? "#b45309"
                          : "#64748b",
                      background: isMine
                        ? `${theme.primary}12`
                        : podium
                          ? "#fef3c7"
                          : "#f8fafc",
                    }}
                  >
                    {cleanRank(r.rank, index + 1)}
                  </div>

                  <TeamBadge name={r.team_name} size={42} />

                  <div style={s.teamBlock}>
                    <div style={s.teamTop}>
                      <span
                        style={{
                          ...s.teamName,
                          color: isMine ? theme.primary : "#0f172a",
                        }}
                      >
                        {r.team_name}
                      </span>

                      {isMine && (
                        <span
                          style={{
                            ...s.you,
                            background: theme.primary,
                          }}
                        >
                          TU
                        </span>
                      )}
                    </div>

                    <div style={s.roleLine}>
                      <RoleStat label="P" value={r.p_total} />
                      <RoleStat label="D" value={r.d_total} />
                      <RoleStat label="C" value={r.c_total} />
                      <RoleStat label="A" value={r.a_total} />
                    </div>
                  </div>

                  <div style={s.totalBox}>
                    <strong
                      style={{
                        color: isMine ? theme.primary : "#0f172a",
                      }}
                    >
                      {fmt(r.total_points)}
                    </strong>
                    <small>pt</small>
                  </div>
                </article>
              );
            })}

            {rows.length === 0 && !err && (
              <div style={s.empty}>
                Nessun dato classifica disponibile.
              </div>
            )}
          </div>
        </section>

        {bestRole && (
          <section style={s.trendCard}>
            <div style={s.trendIcon}>↗</div>

            <div style={{ minWidth: 0 }}>
              <h3 style={s.trendTitle}>Insight competizione</h3>
              <p style={s.trendText}>
                Miglior reparto: <b>{bestRole.label}</b> di{" "}
                <b>{bestRole.team}</b> con {fmt(bestRole.value)} punti.
              </p>
            </div>
          </section>
        )}
      </main>

      <BottomNav />
    </>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={s.summaryItem}>
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}

function RoleStat({ label, value }: { label: string; value?: number | null }) {
  return (
    <span style={s.roleStat}>
      <b>{label}</b>
      {roleValue(value)}
    </span>
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

  titleRow: {
    marginTop: 20,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 14,
  },

  title: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.05,
    fontWeight: 1000,
    letterSpacing: "-0.05em",
    color: "#0f172a",
  },

  subtitle: {
    margin: "5px 0 0",
    color: "#64748b",
    fontWeight: 800,
    fontSize: 14,
  },

  positionBox: {
    minWidth: 86,
    borderRadius: 8,
    padding: "10px 12px",
    display: "grid",
    justifyItems: "center",
    gap: 2,
    flexShrink: 0,
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 9,
    marginTop: 16,
  },

  summaryItem: {
    background: "#f8fafc",
    border: "1px solid #dbe4dd",
    borderRadius: 8,
    padding: "10px 8px",
    display: "grid",
    gap: 4,
    textAlign: "center",
  },

  card: {
    background: "white",
    border: "1px solid #dbe4dd",
    borderRadius: 8,
    padding: 16,
    boxShadow: "0 12px 28px rgba(19,35,26,.08)",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },

  sectionTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 1000,
    letterSpacing: "-0.04em",
    color: "#0f172a",
  },

  smallHint: {
    background: "#f1f5f9",
    color: "#64748b",
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 1000,
  },

  leaderboard: {
    display: "grid",
    gap: 9,
  },

  row: {
    display: "grid",
    gridTemplateColumns: "38px 42px 1fr auto",
    gap: 10,
    alignItems: "center",
    border: "1px solid #dbe4dd",
    borderRadius: 8,
    padding: 12,
  },

  rank: {
    width: 38,
    height: 38,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    fontWeight: 1000,
    fontSize: 15,
    flexShrink: 0,
  },

  teamBlock: {
    minWidth: 0,
    display: "grid",
    gap: 6,
  },

  teamTop: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    minWidth: 0,
  },

  teamName: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontWeight: 1000,
    fontSize: 16,
    letterSpacing: "-0.02em",
  },

  you: {
    color: "white",
    borderRadius: 7,
    padding: "2px 6px",
    fontSize: 10,
    fontWeight: 1000,
    flexShrink: 0,
  },

  roleLine: {
    display: "flex",
    flexWrap: "wrap",
    gap: 5,
  },

  roleStat: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    background: "#f8fafc",
    border: "1px solid #dbe4dd",
    borderRadius: 8,
    padding: "4px 7px",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 900,
  },

  totalBox: {
    display: "grid",
    justifyItems: "end",
    gap: 0,
    minWidth: 52,
  },

  empty: {
    padding: 18,
    color: "#64748b",
    fontWeight: 900,
    textAlign: "center",
    background: "#f8fafc",
    borderRadius: 8,
  },

  trendCard: {
    background: "white",
    border: "1px solid #dbe4dd",
    borderRadius: 8,
    padding: 16,
    boxShadow: "0 12px 28px rgba(19,35,26,.08)",
    display: "grid",
    gridTemplateColumns: "46px 1fr",
    alignItems: "center",
    gap: 12,
  },

  trendIcon: {
    width: 46,
    height: 46,
    borderRadius: 8,
    background: "#f0fdf4",
    color: "#15803d",
    display: "grid",
    placeItems: "center",
    fontWeight: 1000,
    fontSize: 22,
  },

  trendTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 1000,
    letterSpacing: "-0.03em",
  },

  trendText: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.4,
  },

  err: {
    background: "#fff1f2",
    color: "#991b1b",
    padding: 12,
    borderRadius: 8,
    fontWeight: 800,
  },
};
