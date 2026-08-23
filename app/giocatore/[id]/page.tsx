"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import LoadingScreen from "../../components/LoadingScreen";
import CompetitionBadge from "../../components/CompetitionBadge";
import { useRequireApp } from "../../hooks/useRequireApp";
import { supabase } from "../../../lib/supabaseClient";
import { rpcJson, fmt, signedFmt } from "../../../lib/rpc";

type PlayerHistory = {
  matchday_number: number;
  points: number;
  goals?: number | null;
  assists?: number | null;
  yellow?: number | null;
  red?: number | null;
  pen_missed?: number | null;
  pen_saved?: number | null;
  goals_conceded?: number | null;
  clean_sheet?: boolean | null;
  xg?: number | null;
  xa?: number | null;
  passes_completed?: number | null;
  pass_accuracy?: number | null;
  tackles?: number | null;
  interceptions?: number | null;
  npxg?: number | null;
  saves?: number | null;
  save_pct?: number | null;
};

type PlayerDetail = {
  player_name: string;
  role: string;
  team_name: string | null;
  image_url?: string | null;
  scoring_ruleset?: string | null;
  avg_points: number;
  best_points: number;
  worst_points: number;
  history: PlayerHistory[];
} | null;

type BreakdownLine = {
  label: string;
  value: string;
  formula: string;
  points: number;
};

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

function PlayerAvatar({ data }: { data: NonNullable<PlayerDetail> }) {
  const [failed, setFailed] = useState(false);

  if (data.image_url && !failed) {
    return (
      <span style={s.avatarWrap}>
        <img
          src={data.image_url}
          alt=""
          style={s.avatarImg}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
        <span style={s.avatarRole}>{data.role}</span>
      </span>
    );
  }

  return <RoleBadge role={data.role} />;
}

function num(value: number | null | undefined) {
  return Number(value ?? 0);
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

function fmt3(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return String(round3(Number(value))).replace(".", ",");
}

function normalizePct(value: number | null | undefined) {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n <= 1 ? n * 100 : n;
}

function rulesetKind(value?: string | null) {
  const v = (value ?? "classico").toLowerCase();
  if (["non_standard", "nonstandard", "statistico"].includes(v)) return "statistico";
  if (v === "pro") return "pro";
  return "classico";
}

function buildBreakdown(data: NonNullable<PlayerDetail>, h: PlayerHistory): BreakdownLine[] {
  const lines: BreakdownLine[] = [];
  const role = data.role;

  function add(label: string, raw: number | boolean | null | undefined, formula: string, points: number) {
    if (!points) return;
    lines.push({
      label,
      value: typeof raw === "boolean" ? (raw ? "Si" : "No") : fmt3(Number(raw ?? 0)),
      formula,
      points: round3(points),
    });
  }

  add("Gol segnati", h.goals, `${num(h.goals)} x 3`, num(h.goals) * 3);
  add("Assist", h.assists, `${num(h.assists)} x 1`, num(h.assists));
  add("Ammonizioni", h.yellow, `${num(h.yellow)} x -0,5`, num(h.yellow) * -0.5);
  add("Espulsioni", h.red, `${num(h.red)} x -1`, num(h.red) * -1);
  add("Rigori sbagliati", h.pen_missed, `${num(h.pen_missed)} x -3`, num(h.pen_missed) * -3);
  add("Rigori parati", h.pen_saved, `${num(h.pen_saved)} x 3`, num(h.pen_saved) * 3);

  if ((role === "P" || role === "D") && h.clean_sheet) {
    add("Porta inviolata", h.clean_sheet, "bonus", 1);
  }

  if (role === "P") {
    add("Gol subiti", h.goals_conceded, `${num(h.goals_conceded)} x -1`, num(h.goals_conceded) * -1);
  }

  const kind = rulesetKind(data.scoring_ruleset);
  if (kind === "statistico") {
    add("Passaggi riusciti", h.passes_completed, `${num(h.passes_completed)} x 0,005`, num(h.passes_completed) * 0.005);

    const passAccuracy = normalizePct(h.pass_accuracy);
    if (num(h.passes_completed) >= 20 && num(passAccuracy) > 85) {
      add("Precisione passaggi", passAccuracy, `${fmt3(passAccuracy)}% e almeno 20 passaggi`, 0.3);
    }

    add("Tackle", h.tackles, `${num(h.tackles)} x 0,10`, num(h.tackles) * 0.1);
    add("Intercetti", h.interceptions, `${num(h.interceptions)} x 0,10`, num(h.interceptions) * 0.1);
    add("npxG", h.npxg ?? h.xg, `${fmt3(h.npxg ?? h.xg)} x 1`, num(h.npxg ?? h.xg));
    add("xA", h.xa, `${fmt3(h.xa)} x 1`, num(h.xa));

    if (role === "P") {
      const savePct = normalizePct(h.save_pct) ?? (
        num(h.saves) + num(h.goals_conceded) > 0
          ? (num(h.saves) / (num(h.saves) + num(h.goals_conceded))) * 100
          : null
      );

      if (num(savePct) > 80) add("% parate", savePct, `${fmt3(savePct)}% > 80%`, 0.5);
      if (num(savePct) > 80 && num(h.saves) >= 5) add("% parate rafforzato", savePct, `${fmt3(savePct)}% e almeno 5 parate`, 1);
    }
  }

  if (kind === "pro") {
    add("xG", h.xg, `${fmt3(h.xg)} x bonus`, num(h.xg));
    add("xA", h.xa, `${fmt3(h.xa)} x bonus`, num(h.xa));
  }

  return lines;
}

async function withCatalogImage(playerId: string, data: PlayerDetail) {
  if (!data || data.image_url) return data;

  const { data: player } = await supabase
    .from("real_players")
    .select("image_url,real_team_id")
    .eq("id", playerId)
    .maybeSingle();

  if (!player) return data;

  let logoUrl: string | null = null;
  if (player.real_team_id) {
    const { data: team } = await supabase
      .from("real_teams")
      .select("logo_url")
      .eq("id", player.real_team_id)
      .maybeSingle();

    logoUrl = team?.logo_url ?? null;
  }

  return {
    ...data,
    image_url: player.image_url ?? logoUrl,
  };
}

export default function Giocatore() {
  const app = useRequireApp(true);
  const params = useParams();
  const [data, setData] = useState<PlayerDetail>(null);
  const [loading, setLoading] = useState(true);
  const [openMatchday, setOpenMatchday] = useState<number | null>(null);

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
      .then((detail) => withCatalogImage(String(params.id), detail))
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
                <PlayerAvatar data={data} />
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
                  const open = openMatchday === h.matchday_number;
                  const breakdown = buildBreakdown(data, h);
                  const debugTotal = round3(breakdown.reduce((sum, line) => sum + line.points, 0));
                  const delta = round3(points - debugTotal);

                  return (
                    <div key={h.matchday_number} style={s.histWrap}>
                      <button
                        type="button"
                        className="fc-player-history-row"
                        style={{ ...s.hist, ...(open ? s.histOpen : {}) }}
                        onClick={() => setOpenMatchday(open ? null : h.matchday_number)}
                      >
                        <span style={s.matchday}>Giornata {h.matchday_number}</span>
                        <span style={s.histRight}>
                          <b style={{ ...s.points, color: points > 0 ? "var(--fc-primary)" : points < 0 ? "#dc2626" : "#64748b" }}>
                            {signedFmt(points)}
                          </b>
                          <span style={s.chevron}>{open ? "↑" : "↓"}</span>
                        </span>
                      </button>

                      {open && (
                        <div style={s.breakdown}>
                          <div style={s.breakdownHead}>
                            <span>Dettaglio punteggio</span>
                            <b>{signedFmt(points)}</b>
                          </div>

                          {breakdown.map((line) => (
                            <div key={`${h.matchday_number}-${line.label}`} style={s.breakdownRow}>
                              <div style={{ minWidth: 0 }}>
                                <b style={s.breakdownLabel}>{line.label}</b>
                                <span style={s.breakdownFormula}>{line.formula}</span>
                              </div>
                              <span style={s.breakdownValue}>{line.value}</span>
                              <b style={{ ...s.breakdownPoints, color: line.points > 0 ? "var(--fc-primary)" : line.points < 0 ? "#dc2626" : "#64748b" }}>
                                {signedFmt(line.points)}
                              </b>
                            </div>
                          ))}

                          {breakdown.length === 0 && (
                            <div style={s.emptySmall}>Nessuna statistica con impatto sul punteggio.</div>
                          )}

                          <div style={s.debugTotal}>
                            <span>Totale voci mostrate</span>
                            <b>{signedFmt(debugTotal)}</b>
                          </div>

                          {Math.abs(delta) >= 0.01 && (
                            <div style={s.deltaWarn}>
                              Differenza con totale ufficiale: {signedFmt(delta)}. Qui c'e probabilmente una voce non mappata o un dato importato da controllare.
                            </div>
                          )}
                        </div>
                      )}
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

      <BottomNav activePath="/rosa" />
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
  avatarWrap: { position: "relative", width: 42, height: 42, borderRadius: "50%", display: "inline-grid", placeItems: "center", background: "#f1f5f9", border: "1px solid #e5e7eb", boxShadow: "0 2px 8px rgba(15,23,42,.08)" },
  avatarImg: { width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", display: "block" },
  avatarRole: { position: "absolute", right: -3, bottom: -3, width: 17, height: 17, borderRadius: "50%", display: "grid", placeItems: "center", background: "#0f172a", color: "white", border: "1.5px solid white", fontSize: 9, fontWeight: 1000, lineHeight: 1 },
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
  histWrap: { display: "grid", gap: 7 },
  hist: { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, border: "1px solid #eef2f7", borderRadius: 12, padding: "9px 10px", background: "#fbfdfb", fontFamily: "inherit", cursor: "pointer", textAlign: "left" },
  histOpen: { borderColor: "rgba(22,163,74,.35)", background: "rgba(22,163,74,.055)" },
  matchday: { color: "#0f172a", fontSize: 13, fontWeight: 900 },
  histRight: { display: "inline-flex", alignItems: "center", gap: 8 },
  points: { fontSize: 14, fontWeight: 1000, fontVariantNumeric: "tabular-nums" },
  chevron: { color: "#94a3b8", fontSize: 14, fontWeight: 1000, lineHeight: 1 },
  breakdown: { border: "1px solid #e5e7eb", borderRadius: 14, background: "linear-gradient(180deg,#ffffff,#fbfdfb)", padding: 10, display: "grid", gap: 7, boxShadow: "0 8px 18px rgba(15,23,42,.045)" },
  breakdownHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, color: "#0f172a", fontSize: 12.5, fontWeight: 1000, padding: "0 2px 4px", borderBottom: "1px solid #eef2f7" },
  breakdownRow: { display: "grid", gridTemplateColumns: "1fr 54px 56px", alignItems: "center", gap: 8, padding: "7px 2px", borderBottom: "1px solid #f1f5f9" },
  breakdownLabel: { display: "block", color: "#0f172a", fontSize: 12.5, fontWeight: 1000, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  breakdownFormula: { display: "block", color: "#64748b", fontSize: 11, fontWeight: 800, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  breakdownValue: { justifySelf: "end", color: "#64748b", fontSize: 12, fontWeight: 900, fontVariantNumeric: "tabular-nums" },
  breakdownPoints: { justifySelf: "end", fontSize: 12.5, fontWeight: 1000, fontVariantNumeric: "tabular-nums" },
  debugTotal: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderTop: "1px solid #e5e7eb", paddingTop: 8, color: "#0f172a", fontSize: 12, fontWeight: 1000 },
  deltaWarn: { border: "1px solid #fed7aa", borderRadius: 11, background: "#fff7ed", color: "#c2410c", padding: "9px 10px", fontSize: 11.5, fontWeight: 850, lineHeight: 1.35 },
  emptySmall: { border: "1px dashed #e5e7eb", borderRadius: 11, padding: 10, color: "#64748b", fontSize: 12, fontWeight: 850, textAlign: "center" },
  empty: { border: "1px solid #e5e7eb", borderRadius: 12, padding: 13, color: "#64748b", fontSize: 13, fontWeight: 800, textAlign: "center" },
};
