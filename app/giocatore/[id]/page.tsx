"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import LoadingScreen from "../../components/LoadingScreen";
import CompetitionBadge from "../../components/CompetitionBadge";
import { useRequireApp } from "../../hooks/useRequireApp";
import { rpcJson, fmt, signedFmt } from "../../../lib/rpc";

type PlayerDetail = {
  player_name: string;
  role: string;
  team_name: string | null;
  avg_points: number;
  best_points: number;
  worst_points: number;
  history: { matchday_number: number; points: number }[];
} | null;

const ROLE_LABEL: Record<string, string> = {
  P: "Portiere",
  D: "Difensore",
  C: "Centrocampista",
  A: "Attaccante",
};

const ROLE_META: Record<string, { bg: string; fg: string }> = {
  P: { bg: "#FEF3C7", fg: "#B45309" },
  D: { bg: "#DCFCE7", fg: "#15803D" },
  C: { bg: "#DBEAFE", fg: "#2563EB" },
  A: { bg: "#FEE2E2", fg: "#DC2626" },
};

function playerLabel(data: NonNullable<PlayerDetail>) {
  return data.role === "P" ? (data.team_name || data.player_name) : data.player_name;
}

function RoleBadge({ role }: { role: string }) {
  const c = ROLE_META[role] ?? { bg: "#f1f5f9", fg: "#475569" };
  return (
    <span className={`fc-role-badge fc-role-${role}`} style={{ ...s.roleBadge, background: c.bg, color: c.fg }}>
      {role}
    </span>
  );
}

export default function Giocatore() {
  const app = useRequireApp(true);
  const params = useParams();
  const [data, setData] = useState<PlayerDetail>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!app.ready || !params?.id || !app.activeLeagueCompetitionId) return;
    rpcJson<PlayerDetail>(
      "get_player_detail",
      {
        p_real_player_id: params.id,
        p_league_competition_id: app.activeLeagueCompetitionId,
      },
      null
    )
      .then(setData)
      .finally(() => setLoading(false));
  }, [app.ready, params?.id, app.activeLeagueCompetitionId]);

  const trend = useMemo(() => {
    if (!data?.history?.length) return "Nessun dato storico";
    const positives = data.history.filter((h) => Number(h.points) > 0).length;
    return `${positives}/${data.history.length} giornate positive`;
  }, [data]);

  if (!app.ready || loading) return <LoadingScreen />;

  return (
    <>
      <AppBar league={app.leagueName} team={app.teamName} onMenuOpen={app.openDrawer} />

      <main className="fc-player-page" style={s.container}>
        {!data ? (
          <div className="fc-player-card" style={s.card}>Giocatore non trovato.</div>
        ) : (
          <>
            <section className="fc-player-hero" style={s.hero}>
              <CompetitionBadge name={app.competitionName} type={app.competitionType} />

              <div style={s.identity}>
                <RoleBadge role={data.role} />
                <div style={{ minWidth: 0 }}>
                  <h1 style={s.title}>{playerLabel(data)}</h1>
                  <p style={s.subtitle}>
                    {ROLE_LABEL[data.role] ?? data.role}
                    {data.team_name ? ` · ${data.team_name}` : ""}
                  </p>
                </div>
              </div>

              <div style={s.kpis}>
                <Kpi label="Media" value={fmt(data.avg_points)} />
                <Kpi label="Best" value={signedFmt(data.best_points)} positive />
                <Kpi label="Worst" value={signedFmt(data.worst_points)} negative />
              </div>
            </section>

            <section className="fc-player-card" style={s.card}>
              <div style={s.sectionHead}>
                <div>
                  <h2 style={s.sectionTitle}>Storico voti</h2>
                  <p style={s.sectionSub}>{trend}</p>
                </div>
                <span className="fc-player-count" style={s.count}>{data.history.length}</span>
              </div>

              <div style={s.history}>
                {data.history.map((h) => {
                  const points = Number(h.points);
                  return (
                    <div key={h.matchday_number} className="fc-player-history-row" style={s.hist}>
                      <span style={s.matchday}>Giornata {h.matchday_number}</span>
                      <b style={{ ...s.points, color: points > 0 ? "var(--fc-primary)" : points < 0 ? "#dc2626" : "#64748b" }}>
                        {signedFmt(points)}
                      </b>
                    </div>
                  );
                })}

                {data.history.length === 0 && (
                  <div className="fc-player-empty" style={s.empty}>Nessun voto disponibile.</div>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      <BottomNav />
    </>
  );
}

function Kpi({ label, value, positive, negative }: { label: string; value: string; positive?: boolean; negative?: boolean }) {
  return (
    <div className="fc-player-kpi" style={s.kpi}>
      <small>{label}</small>
      <b style={{ color: positive ? "var(--fc-primary)" : negative ? "#dc2626" : "var(--fc-text)" }}>{value}</b>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 520, margin: "0 auto", padding: "14px 14px 100px", display: "grid", gap: 10 },
  hero: { background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: 14, boxShadow: "0 8px 22px rgba(15,23,42,.06)" },
  identity: { display: "grid", gridTemplateColumns: "42px 1fr", alignItems: "center", gap: 11, marginTop: 14 },
  roleBadge: { width: 42, height: 42, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 15, fontWeight: 1000, border: "1px solid rgba(255,255,255,.9)", boxShadow: "0 2px 8px rgba(15,23,42,.08)" },
  title: { margin: 0, color: "#0f172a", fontSize: 23, lineHeight: 1.05, fontWeight: 1000, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis" },
  subtitle: { margin: "4px 0 0", color: "#64748b", fontSize: 12.5, fontWeight: 800 },
  kpis: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 7, marginTop: 14 },
  kpi: { minWidth: 0, background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: "9px 7px", display: "grid", gap: 3, textAlign: "center" },
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 14, boxShadow: "0 4px 14px rgba(15,23,42,.045)" },
  sectionHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 },
  sectionTitle: { margin: 0, color: "#0f172a", fontSize: 17, fontWeight: 1000, letterSpacing: "-0.02em" },
  sectionSub: { margin: "3px 0 0", color: "#64748b", fontSize: 12, fontWeight: 800 },
  count: { width: 34, height: 30, borderRadius: 10, background: "#f1f5f9", color: "#64748b", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 1000 },
  history: { display: "grid", gap: 6 },
  hist: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, border: "1px solid #eef2f7", borderRadius: 12, padding: "9px 10px", background: "#fbfdfb" },
  matchday: { color: "#0f172a", fontSize: 13, fontWeight: 900 },
  points: { fontSize: 14, fontWeight: 1000, fontVariantNumeric: "tabular-nums" },
  empty: { border: "1px solid #e5e7eb", borderRadius: 12, padding: 13, color: "#64748b", fontSize: 13, fontWeight: 800, textAlign: "center" },
};
