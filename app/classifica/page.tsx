"use client";

import { useEffect, useState } from "react";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import LoadingScreen from "../components/LoadingScreen";
import CompetitionBadge from "../components/CompetitionBadge";
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

  if (!app.ready || loading) return <LoadingScreen />;

  const theme = app.competitionTheme;

  return (
    <>
      <AppBar
        league={app.leagueName}
        team={app.teamName}
        onMenuOpen={app.openDrawer}
      />

      <main style={s.container}>
        <div style={s.head}>
          <CompetitionBadge
            name={app.competitionName}
            type={app.competitionType}
          />
          <h1 style={s.title}>Classifica</h1>
          <p style={s.subtitle}>Classifica aggregata da Supabase</p>
        </div>

        {!app.activeLeagueCompetitionId && (
          <div style={s.err}>
            Nessuna competizione attiva selezionata.
          </div>
        )}

        {err && <div style={s.err}>Errore: {err}</div>}

        <div style={s.table}>
          <div style={s.tableHeader}>
            <span>#</span>
            <span>Squadra</span>
            <span>Tot</span>
            <span>P</span>
            <span>D</span>
            <span>C</span>
            <span>A</span>
          </div>

          {rows.map((r, index) => {
            const isMine = r.user_id === app.userId;

            return (
              <div
                key={`${r.user_id ?? "user"}-${r.rank ?? index}-${index}`}
                style={{
                  ...s.row,
                  borderLeft: `4px solid ${isMine ? theme.primary : "transparent"}`,
                  background: isMine ? `${theme.primary}10` : "white",
                }}
              >
                <b style={{ color: isMine ? theme.primary : "#111827" }}>
                  #{r.rank || index + 1}
                </b>

                <span style={s.teamName}>
                  {r.team_name}
                  {isMine && <small style={s.you}>Tu</small>}
                </span>

                <strong style={{ color: isMine ? theme.primary : "#111827" }}>
                  {fmt(r.total_points)}
                </strong>

                <small>{fmt(r.p_total)}</small>
                <small>{fmt(r.d_total)}</small>
                <small>{fmt(r.c_total)}</small>
                <small>{fmt(r.a_total)}</small>
              </div>
            );
          })}

          {rows.length === 0 && !err && (
            <div style={s.empty}>Nessun dato classifica disponibile.</div>
          )}
        </div>
      </main>

      <BottomNav />
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 520,
    margin: "0 auto",
    padding: "16px 14px 100px",
  },
  head: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 16,
  },
  title: {
    margin: "12px 0 4px",
    fontSize: 24,
    fontWeight: 900,
    color: "#111827",
  },
  subtitle: {
    margin: 0,
    color: "#6b7280",
    fontWeight: 700,
  },
  table: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    overflow: "hidden",
    marginTop: 14,
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "42px 1fr 54px 34px 34px 34px 34px",
    gap: 6,
    padding: "10px 12px",
    background: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
    color: "#6b7280",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "42px 1fr 54px 34px 34px 34px 34px",
    gap: 6,
    alignItems: "center",
    padding: 12,
    borderBottom: "1px solid #f3f4f6",
    fontSize: 13,
  },
  teamName: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontWeight: 800,
    color: "#111827",
  },
  you: {
    marginLeft: 6,
    fontSize: 10,
    color: "#16a34a",
    fontWeight: 900,
  },
  empty: {
    padding: 16,
    color: "#6b7280",
    fontWeight: 800,
  },
  err: {
    background: "#fff1f2",
    color: "#991b1b",
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    fontWeight: 800,
  },
};