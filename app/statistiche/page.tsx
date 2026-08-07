"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import LoadingScreen from "../components/LoadingScreen";
import CompetitionBadge from "../components/CompetitionBadge";
import { useRequireApp } from "../hooks/useRequireApp";
import { rpcJson, fmt, signedFmt } from "../../lib/rpc";

type Row = {
  player_id: string;
  player_name: string;
  team_name: string | null;
  role: string;
  played_count: number;
  avg_points: number;
  total_points: number;
  best_points: number;
  worst_points: number;
};

type Section = "overview" | "players" | "compare";
type MetricKey = "avg" | "total" | "played" | "best" | "worst";

const ROLES = [
  { k: "ALL", label: "Tutti" },
  { k: "P", label: "P" },
  { k: "D", label: "D" },
  { k: "C", label: "C" },
  { k: "A", label: "A" },
];

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "avg", label: "Media" },
  { key: "total", label: "Totale" },
  { key: "played", label: "Partite" },
  { key: "best", label: "Best" },
  { key: "worst", label: "Worst" },
];

const ROLE_META: Record<string, { bg: string; fg: string; label: string }> = {
  P: { bg: "#FEF3C7", fg: "#B45309", label: "Portiere" },
  D: { bg: "#DCFCE7", fg: "#15803D", label: "Difensore" },
  C: { bg: "#DBEAFE", fg: "#2563EB", label: "Centrocampista" },
  A: { bg: "#FEE2E2", fg: "#DC2626", label: "Attaccante" },
};

function playerLabel(r: Row) {
  return r.role === "P" ? r.team_name || r.player_name : r.player_name;
}

function playerSub(r: Row) {
  const role = ROLE_META[r.role]?.label ?? r.role;
  return r.team_name ? `${role} - ${r.team_name}` : role;
}

function metricValue(r: Row, key: MetricKey) {
  if (key === "avg") return Number(r.avg_points) || 0;
  if (key === "total") return Number(r.total_points) || 0;
  if (key === "played") return Number(r.played_count) || 0;
  if (key === "best") return Number(r.best_points) || 0;
  return Number(r.worst_points) || 0;
}

function metricText(r: Row, key: MetricKey) {
  if (key === "played") return String(Number(r.played_count) || 0);
  if (key === "best" || key === "worst") return signedFmt(metricValue(r, key));
  return fmt(metricValue(r, key));
}

function RoleBadge({ role }: { role: string }) {
  const c = ROLE_META[role] ?? { bg: "#f1f5f9", fg: "#475569" };
  return (
    <span className={`fc-role-badge fc-role-${role}`} style={{ ...s.roleBadge, background: c.bg, color: c.fg }}>
      {role}
    </span>
  );
}

export default function Statistiche() {
  const app = useRequireApp(true);
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("overview");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("ALL");
  const [metric, setMetric] = useState<MetricKey>("avg");
  const [showAll, setShowAll] = useState(false);
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [activeCompare, setActiveCompare] = useState<"A" | "B" | null>(null);

  useEffect(() => {
    if (!app.ready || !app.activeLeagueCompetitionId) return;
    rpcJson<Row[]>("get_player_stats", { p_league_competition_id: app.activeLeagueCompetitionId }, [])
      .then((r) => setRows(r ?? []))
      .finally(() => setLoading(false));
  }, [app.ready, app.activeLeagueCompetitionId]);

  const topThree = useMemo(
    () =>
      [...rows]
        .sort((a, b) => Number(b.avg_points) - Number(a.avg_points) || playerLabel(a).localeCompare(playerLabel(b)))
        .slice(0, 3),
    [rows]
  );

  const flopThree = useMemo(
    () =>
      [...rows]
        .sort((a, b) => Number(a.avg_points) - Number(b.avg_points) || playerLabel(a).localeCompare(playerLabel(b)))
        .slice(0, 3),
    [rows]
  );

  const roleCounts = useMemo(() => {
    return rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.role] = (acc[r.role] ?? 0) + 1;
      return acc;
    }, {});
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = rows
      .filter((r) => role === "ALL" || r.role === role)
      .filter((r) => {
        if (!needle) return true;
        return `${r.player_name} ${r.team_name ?? ""} ${r.role}`.toLowerCase().includes(needle);
      });
    return [...base]
      .sort((a, b) => metricValue(b, metric) - metricValue(a, metric) || playerLabel(a).localeCompare(playerLabel(b)))
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [rows, q, role, metric]);

  const maxMetric = useMemo(() => Math.max(1, ...filtered.map((r) => Math.abs(metricValue(r, metric)))), [filtered, metric]);
  const visibleRows = showAll ? filtered : filtered.slice(0, 24);
  const effectiveCompareA = compareA || rows[0]?.player_id || "";
  const effectiveCompareB = compareB || rows.find((r) => r.player_id !== effectiveCompareA)?.player_id || effectiveCompareA;
  const playerA = rows.find((r) => r.player_id === effectiveCompareA) ?? rows[0];
  const playerB = rows.find((r) => r.player_id === effectiveCompareB) ?? rows.find((r) => r.player_id !== playerA?.player_id) ?? rows[0];
  const bestAverage = topThree[0]?.avg_points ?? 0;
  const worstAverage = flopThree[0]?.avg_points ?? 0;
  const accent = app.competitionTheme.primary;

  const openPlayer = useCallback((id: string) => router.push(`/giocatore/${id}`), [router]);

  if (!app.ready || loading) return <LoadingScreen />;

  return (
    <>
      <AppBar league={app.leagueName} team={app.teamName} onMenuOpen={app.openDrawer} />

      <main className="fc-stats-page" style={s.container}>
        <section className="fc-stats-hero" style={s.hero}>
          <div style={s.heroTop}>
            <CompetitionBadge name={app.competitionName} type={app.competitionType} />
            <span className="fc-stats-status" style={s.status}>Live data</span>
          </div>

          <div style={s.heroCopy}>
            <span className="fc-stats-eyebrow" style={s.eyebrow}>Zona statistiche</span>
            <h1 style={s.h1}>Numeri che pesano.</h1>
            <p style={s.hsub}>Top, flop, confronto e ricerca completa dei giocatori della competizione.</p>
          </div>

          <div style={s.heroKpis}>
            <Kpi label="Giocatori" value={String(rows.length)} />
            <Kpi label="Top media" value={fmt(bestAverage)} tone="good" />
            <Kpi label="Flop media" value={fmt(worstAverage)} tone="warn" />
          </div>
        </section>

        <nav className="fc-stats-tabs" style={s.tabs} aria-label="Sezioni statistiche">
          <Tab active={section === "overview"} onClick={() => setSection("overview")} label="Panoramica" />
          <Tab active={section === "players"} onClick={() => setSection("players")} label="Giocatori" />
          <Tab active={section === "compare"} onClick={() => setSection("compare")} label="Confronto" />
        </nav>

        {section === "overview" && (
          <>
            <section className="fc-stats-card fc-stats-impact" style={s.card}>
              <div style={s.sectionHead}>
                <div>
                  <h2 style={s.sectionTitle}>Top 3 del momento</h2>
                  <p style={s.sectionSub}>Media punti più alta nella competizione.</p>
                </div>
                <button type="button" style={s.linkBtn} onClick={() => setSection("players")}>Vedi tutti</button>
              </div>

              <div style={s.podium}>
                {topThree.map((r, index) => (
                  <button
                    key={r.player_id}
                    type="button"
                    className={`fc-stats-podium-card ${index === 0 ? "is-first" : ""}`}
                    style={{ ...s.podiumCard, ...(index === 0 ? s.podiumFirst : {}) }}
                    onClick={() => openPlayer(r.player_id)}
                  >
                    <span style={{ ...s.podiumRank, ...(index === 0 ? { background: "#e07b1a", color: "white" } : {}) }}>
                      #{index + 1}
                    </span>
                    <RoleBadge role={r.role} />
                    <span style={s.podiumName}>{playerLabel(r)}</span>
                    <span style={s.podiumMeta}>{playerSub(r)}</span>
                    <strong style={s.podiumScore}>{fmt(r.avg_points)}</strong>
                    <small style={s.podiumSmall}>media</small>
                  </button>
                ))}
                {topThree.length === 0 && <div className="fc-stats-empty" style={s.empty}>Nessun giocatore disponibile.</div>}
              </div>
            </section>

            <section className="fc-stats-card" style={s.card}>
              <div style={s.sectionHead}>
                <div>
                  <h2 style={s.sectionTitle}>Flop 3</h2>
                  <p style={s.sectionSub}>Prestazioni da valutare prima di schierare la rosa.</p>
                </div>
              </div>

              <div style={s.compactList}>
                {flopThree.map((r, index) => (
                  <button key={r.player_id} type="button" className="fc-stats-compact-row" style={s.compactRow} onClick={() => openPlayer(r.player_id)}>
                    <span style={s.flopRank}>{index + 1}</span>
                    <RoleBadge role={r.role} />
                    <span style={s.compactNameWrap}>
                      <b style={s.compactName}>{playerLabel(r)}</b>
                      <small style={s.compactSub}>{playerSub(r)}</small>
                    </span>
                    <strong style={{ ...s.compactScore, color: "#dc2626" }}>{fmt(r.avg_points)}</strong>
                  </button>
                ))}
              </div>
            </section>

            <section className="fc-stats-actions" style={s.actions}>
              <button type="button" className="fc-stats-action" style={s.actionCard} onClick={() => setSection("compare")}>
                <span style={s.actionIcon}>vs</span>
                <span>
                  <b>Confronta due giocatori</b>
                  <small>Media, totale, partite, best e worst.</small>
                </span>
              </button>
              <button type="button" className="fc-stats-action" style={s.actionCard} onClick={() => setSection("players")}>
                <span style={s.actionIcon}>#</span>
                <span>
                  <b>Apri database</b>
                  <small>Filtra per nome, squadra, ruolo o metrica.</small>
                </span>
              </button>
            </section>
          </>
        )}

        {section === "players" && (
          <section className="fc-stats-card" style={s.card}>
            <div style={s.sectionHead}>
              <div>
                <h2 style={s.sectionTitle}>Tutti i giocatori</h2>
                <p style={s.sectionSub}>Ricerca e ordina la lista completa.</p>
              </div>
              <span className="fc-stats-count" style={s.count}>{filtered.length}</span>
            </div>

            <input
              className="fc-stats-input"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setShowAll(false);
              }}
              placeholder="Nome, squadra o ruolo"
              style={s.search}
            />

            <div style={s.roleFilters}>
              {ROLES.map((r) => {
                const active = role === r.k;
                const count = r.k === "ALL" ? rows.length : roleCounts[r.k] ?? 0;
                return (
                  <button
                    key={r.k}
                    type="button"
                    className={`fc-stats-filter${active ? " is-active" : ""}`}
                    style={{ ...s.filter, ...(active ? { background: accent, color: "white", borderColor: accent } : {}) }}
                    onClick={() => {
                      setRole(r.k);
                      setShowAll(false);
                    }}
                  >
                    {r.label} <span>{count}</span>
                  </button>
                );
              })}
            </div>

            <div style={s.metricFilters}>
              {METRICS.map((m) => {
                const active = metric === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    className={`fc-stats-metric${active ? " is-active" : ""}`}
                    style={{ ...s.metricBtn, ...(active ? { background: "#0f172a", color: "white", borderColor: "#0f172a" } : {}) }}
                    onClick={() => setMetric(m.key)}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            <div style={s.playerRows}>
              {visibleRows.map((r) => {
                const value = metricValue(r, metric);
                const width = Math.max(4, Math.min(100, (Math.abs(value) / maxMetric) * 100));
                return (
                  <button key={r.player_id} type="button" className="fc-stats-player-row" style={s.playerRow} onClick={() => openPlayer(r.player_id)}>
                    <div style={s.playerMain}>
                      <span style={s.listRank}>{r.rank}</span>
                      <RoleBadge role={r.role} />
                      <span style={s.playerText}>
                        <b style={s.playerName}>{playerLabel(r)}</b>
                        <small style={s.playerSub}>{playerSub(r)}</small>
                      </span>
                      <strong style={{ ...s.playerScore, color: value < 0 ? "#dc2626" : accent }}>{metricText(r, metric)}</strong>
                    </div>
                    <span style={s.bar}>
                      <span style={{ ...s.barFill, width: `${width}%`, background: value < 0 ? "#dc2626" : "linear-gradient(90deg,#15803d,#e07b1a)" }} />
                    </span>
                  </button>
                );
              })}
              {visibleRows.length === 0 && <div className="fc-stats-empty" style={s.empty}>Nessun giocatore trovato.</div>}
            </div>

            {!showAll && filtered.length > visibleRows.length && (
              <button type="button" style={s.showAll} onClick={() => setShowAll(true)}>
                Mostra tutti i giocatori ({filtered.length})
              </button>
            )}
          </section>
        )}

        {section === "compare" && (
          <section className="fc-stats-card" style={s.card}>
            <div style={s.sectionHead}>
              <div>
                <h2 style={s.sectionTitle}>Confronto giocatori</h2>
                <p style={s.sectionSub}>Dati complessivi della competizione, non della singola giornata.</p>
              </div>
            </div>

            <div style={s.comparePickers}>
              <ComparePickButton label="Giocatore A" row={playerA} onClick={() => setActiveCompare("A")} />
              <ComparePickButton label="Giocatore B" row={playerB} onClick={() => setActiveCompare("B")} />
            </div>

            {playerA && playerB ? (
              <>
                <div style={s.compareHeads}>
                  <PlayerMini row={playerA} />
                  <PlayerMini row={playerB} />
                </div>

                <div style={s.compareStats}>
                  <CompareMetric label="Partite giocate" a={metricValue(playerA, "played")} b={metricValue(playerB, "played")} />
                  <CompareMetric label="Media punti" a={metricValue(playerA, "avg")} b={metricValue(playerB, "avg")} />
                  <CompareMetric label="Punti totali" a={metricValue(playerA, "total")} b={metricValue(playerB, "total")} />
                  <CompareMetric label="Miglior giornata" a={metricValue(playerA, "best")} b={metricValue(playerB, "best")} signed />
                  <CompareMetric label="Peggior giornata" a={metricValue(playerA, "worst")} b={metricValue(playerB, "worst")} signed />
                </div>
              </>
            ) : (
              <div className="fc-stats-empty" style={s.empty}>Servono almeno due giocatori disponibili.</div>
            )}
          </section>
        )}
      </main>

      {activeCompare && (
        <ComparePlayerSheet
          title={activeCompare === "A" ? "Scegli giocatore A" : "Scegli giocatore B"}
          rows={rows}
          currentId={activeCompare === "A" ? playerA?.player_id ?? "" : playerB?.player_id ?? ""}
          onClose={() => setActiveCompare(null)}
          onSelect={(id) => {
            if (activeCompare === "A") setCompareA(id);
            else setCompareB(id);
            setActiveCompare(null);
          }}
        />
      )}

      <BottomNav activePath="/rosa" />
    </>
  );
}

function Tab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className={`fc-stats-tab${active ? " is-active" : ""}`} style={{ ...s.tab, ...(active ? s.tabActive : {}) }} onClick={onClick}>
      {label}
    </button>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  return (
    <div className="fc-stats-kpi" style={s.kpi}>
      <small>{label}</small>
      <b style={{ color: tone === "good" ? "var(--fc-primary)" : tone === "warn" ? "#e07b1a" : "#0f172a" }}>{value}</b>
    </div>
  );
}

function ComparePickButton({ label, row, onClick }: { label: string; row?: Row; onClick: () => void }) {
  return (
    <button type="button" className="fc-stats-picker" style={s.pickerButton} onClick={onClick}>
      <span style={s.pickerLabel}>{label}</span>
      {row ? (
        <span style={s.pickerValue}>
          <RoleBadge role={row.role} />
          <span style={s.playerText}>
            <b style={s.playerName}>{playerLabel(row)}</b>
            <small style={s.playerSub}>{playerSub(row)}</small>
          </span>
        </span>
      ) : (
        <span style={s.pickerHint}>Scegli giocatore</span>
      )}
      <span style={s.pickerChevron}>›</span>
    </button>
  );
}

function ComparePlayerSheet(props: {
  title: string;
  rows: Row[];
  currentId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState("");

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = props.rows.filter((r) => {
      if (!needle) return true;
      return `${r.player_name} ${r.team_name ?? ""} ${r.role}`.toLowerCase().includes(needle);
    });
    return [...base]
      .sort((a, b) => Number(b.avg_points) - Number(a.avg_points) || playerLabel(a).localeCompare(playerLabel(b)))
      .slice(0, needle ? 24 : 16);
  }, [q, props.rows]);

  return (
    <div className="fc-stats-sheet-layer" style={s.sheetLayer}>
      <button type="button" aria-label="Chiudi selezione" style={s.sheetBackdrop} onClick={props.onClose} />

      <div className="fc-stats-sheet" style={s.sheet}>
        <div style={s.sheetHandle} />

        <div style={s.sheetHead}>
          <div>
            <h2 style={s.sheetTitle}>{props.title}</h2>
            <p style={s.sectionSub}>Cerca per nome, squadra o ruolo.</p>
          </div>
          <button type="button" onClick={props.onClose} style={s.closeBtn}>×</button>
        </div>

        <div style={s.searchWrap}>
          <span style={s.searchIcon}>⌕</span>
          <input
            className="fc-stats-input"
            value={q}
            autoFocus
            onChange={(e) => setQ(e.target.value)}
            placeholder="Scrivi il nome del giocatore"
            style={s.sheetSearch}
          />
        </div>

        <div className="fc-stats-sheet-list" style={s.resultList}>
          {matches.map((r) => (
            <button
              key={r.player_id}
              type="button"
              className="fc-stats-sheet-row"
              style={{ ...s.resultRow, ...(r.player_id === props.currentId ? s.resultRowActive : {}) }}
              onClick={() => props.onSelect(r.player_id)}
            >
              <RoleBadge role={r.role} />
              <span style={s.resultText}>
                <b>{playerLabel(r)}</b>
                <small>{playerSub(r)}</small>
              </span>
              <span style={s.resultMetric}>{fmt(r.avg_points)}</span>
            </button>
          ))}
          {matches.length === 0 && <div className="fc-stats-empty" style={s.empty}>Nessun giocatore trovato.</div>}
        </div>
      </div>
    </div>
  );
}

function PlayerMini({ row }: { row: Row }) {
  return (
    <div className="fc-stats-mini" style={s.playerMini}>
      <RoleBadge role={row.role} />
      <span style={{ minWidth: 0 }}>
        <b style={s.miniName}>{playerLabel(row)}</b>
        <small style={s.miniSub}>{playerSub(row)}</small>
      </span>
    </div>
  );
}

function CompareMetric({ label, a, b, signed }: { label: string; a: number; b: number; signed?: boolean }) {
  const max = Math.max(1, Math.abs(a), Math.abs(b));
  const aWidth = Math.max(4, Math.min(100, (Math.abs(a) / max) * 100));
  const bWidth = Math.max(4, Math.min(100, (Math.abs(b) / max) * 100));
  const text = (v: number) => (signed ? signedFmt(v) : fmt(v));

  return (
    <div className="fc-stats-compare-metric" style={s.compareMetric}>
      <div style={s.compareMetricTop}>
        <strong>{label}</strong>
        <span>
          <b>{text(a)}</b>
          <i>{text(b)}</i>
        </span>
      </div>
      <div style={s.duelBars}>
        <span style={s.duelTrack}><span style={{ ...s.duelFillA, width: `${aWidth}%` }} /></span>
        <span style={s.duelTrack}><span style={{ ...s.duelFillB, width: `${bWidth}%` }} /></span>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 520, margin: "0 auto", padding: "12px 14px calc(86px + env(safe-area-inset-bottom, 0px))", display: "grid", gap: 10 },
  hero: { position: "relative", overflow: "hidden", background: "linear-gradient(135deg,#ffffff 0%,#fbfdfb 46%,#fff7ed 100%)", border: "1px solid #e5e7eb", borderRadius: 18, padding: 14, boxShadow: "0 12px 30px rgba(15,23,42,.07)" },
  heroTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  status: { border: "1px solid rgba(224,123,26,.28)", color: "#c45f0a", background: "#fff7ed", borderRadius: 999, padding: "7px 10px", fontSize: 11, fontWeight: 950 },
  heroCopy: { marginTop: 18 },
  eyebrow: { color: "#15803d", fontSize: 11, fontWeight: 1000, textTransform: "uppercase", letterSpacing: ".06em" },
  h1: { margin: "4px 0 0", color: "#0f172a", fontSize: 34, lineHeight: .94, fontWeight: 1000, letterSpacing: "-0.03em" },
  hsub: { margin: "9px 0 0", maxWidth: 380, color: "#64748b", fontSize: 13, lineHeight: 1.35, fontWeight: 800 },
  heroKpis: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8, marginTop: 15 },
  kpi: { background: "rgba(255,255,255,.82)", border: "1px solid #e5e7eb", borderRadius: 13, padding: "10px 8px", display: "grid", gap: 3, minWidth: 0 },
  tabs: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 4, background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: 4, boxShadow: "0 4px 14px rgba(15,23,42,.045)" },
  tab: { border: 0, background: "transparent", borderRadius: 10, padding: "9px 5px", color: "#64748b", fontSize: 12, fontWeight: 950, fontFamily: "inherit", cursor: "pointer" },
  tabActive: { background: "#0f172a", color: "white" },
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: 14, boxShadow: "0 8px 22px rgba(15,23,42,.055)" },
  sectionHead: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  sectionTitle: { margin: 0, color: "#0f172a", fontSize: 18, lineHeight: 1.05, fontWeight: 1000, letterSpacing: "-0.02em" },
  sectionSub: { margin: "4px 0 0", color: "#64748b", fontSize: 12, lineHeight: 1.25, fontWeight: 800 },
  linkBtn: { border: 0, background: "transparent", color: "#15803d", fontSize: 12, fontWeight: 1000, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" },
  podium: { display: "grid", gridTemplateColumns: "1.12fr .94fr .94fr", gap: 8, alignItems: "stretch" },
  podiumCard: { minWidth: 0, border: "1px solid #e5e7eb", background: "#fbfdfb", borderRadius: 15, padding: 10, display: "grid", justifyItems: "start", gap: 7, textAlign: "left", fontFamily: "inherit", cursor: "pointer", boxShadow: "0 4px 12px rgba(15,23,42,.04)" },
  podiumFirst: { background: "linear-gradient(160deg,#0f7f3d,#0b5c2f)", borderColor: "rgba(15,127,61,.42)", color: "white", boxShadow: "0 12px 28px rgba(15,127,61,.22)" },
  podiumRank: { borderRadius: 999, background: "#f1f5f9", color: "#64748b", padding: "4px 7px", fontSize: 10.5, fontWeight: 1000 },
  podiumName: { maxWidth: "100%", color: "inherit", fontSize: 13, fontWeight: 1000, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  podiumMeta: { maxWidth: "100%", color: "currentColor", opacity: .72, fontSize: 10.5, fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  podiumScore: { color: "inherit", fontSize: 24, lineHeight: .9, fontWeight: 1000, fontVariantNumeric: "tabular-nums" },
  podiumSmall: { color: "currentColor", opacity: .74, fontSize: 10, fontWeight: 900, textTransform: "uppercase" },
  compactList: { display: "grid", gap: 6 },
  compactRow: { display: "grid", gridTemplateColumns: "28px 30px 1fr auto", alignItems: "center", gap: 9, border: "1px solid #eef2f7", background: "#fbfdfb", borderRadius: 13, padding: "8px 9px", textAlign: "left", fontFamily: "inherit", cursor: "pointer" },
  flopRank: { width: 28, height: 28, borderRadius: 9, background: "#fff7ed", color: "#c45f0a", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 1000 },
  compactNameWrap: { minWidth: 0, display: "grid", gap: 1 },
  compactName: { color: "#0f172a", fontSize: 13, fontWeight: 1000, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  compactSub: { color: "#64748b", fontSize: 10.5, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  compactScore: { fontSize: 16, fontWeight: 1000, fontVariantNumeric: "tabular-nums" },
  actions: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 },
  actionCard: { display: "grid", gridTemplateColumns: "34px 1fr", alignItems: "center", gap: 9, border: "1px solid #e5e7eb", background: "white", borderRadius: 16, padding: 12, textAlign: "left", fontFamily: "inherit", cursor: "pointer", boxShadow: "0 4px 14px rgba(15,23,42,.045)" },
  actionIcon: { width: 34, height: 34, borderRadius: 11, display: "grid", placeItems: "center", background: "#f0fdf4", color: "#15803d", fontSize: 13, fontWeight: 1000 },
  count: { minWidth: 34, height: 30, borderRadius: 10, background: "#f1f5f9", color: "#64748b", display: "grid", placeItems: "center", padding: "0 8px", fontSize: 12, fontWeight: 1000 },
  search: { width: "100%", height: 42, border: "1px solid #e5e7eb", borderRadius: 12, padding: "0 12px", fontSize: 13, fontWeight: 800, fontFamily: "inherit", outline: "none", background: "#fff", marginBottom: 9 },
  roleFilters: { display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 5, marginBottom: 8 },
  filter: { border: "1px solid #e5e7eb", background: "#fff", color: "#64748b", borderRadius: 10, padding: "7px 4px", fontSize: 11.5, fontWeight: 950, fontFamily: "inherit", cursor: "pointer" },
  metricFilters: { display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 5, marginBottom: 10 },
  metricBtn: { border: "1px solid #e5e7eb", background: "#f8fafc", color: "#64748b", borderRadius: 10, padding: "7px 3px", fontSize: 11.5, fontWeight: 950, fontFamily: "inherit", cursor: "pointer" },
  playerRows: { display: "grid", gap: 7 },
  playerRow: { border: "1px solid #e5e7eb", background: "#fff", borderRadius: 13, padding: 9, textAlign: "left", fontFamily: "inherit", cursor: "pointer" },
  playerMain: { display: "grid", gridTemplateColumns: "24px 30px 1fr auto", gap: 8, alignItems: "center" },
  listRank: { width: 24, color: "#94a3b8", fontSize: 12, fontWeight: 1000, textAlign: "center" },
  roleBadge: { width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 11.5, fontWeight: 1000, border: "1px solid rgba(255,255,255,.9)", boxShadow: "0 1px 4px rgba(15,23,42,.08)" },
  playerText: { minWidth: 0, display: "grid", gap: 1 },
  playerName: { color: "#0f172a", fontSize: 13, fontWeight: 1000, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  playerSub: { color: "#64748b", fontSize: 10.5, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  playerScore: { fontSize: 15, fontWeight: 1000, fontVariantNumeric: "tabular-nums" },
  bar: { display: "block", height: 3, borderRadius: 3, overflow: "hidden", background: "#eef2f7", marginTop: 8 },
  barFill: { display: "block", height: "100%", borderRadius: 3 },
  showAll: { width: "100%", border: "1px solid #e5e7eb", background: "white", color: "#15803d", borderRadius: 12, padding: 10, marginTop: 8, fontSize: 12.5, fontWeight: 1000, fontFamily: "inherit", cursor: "pointer" },
  comparePickers: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 },
  pickerButton: { position: "relative", display: "grid", gap: 8, minWidth: 0, border: "1px solid #e5e7eb", background: "#fbfdfb", borderRadius: 14, padding: 10, textAlign: "left", fontFamily: "inherit", cursor: "pointer" },
  pickerLabel: { color: "#94a3b8", fontSize: 10.5, fontWeight: 1000, textTransform: "uppercase", letterSpacing: ".04em" },
  pickerValue: { minWidth: 0, display: "grid", gridTemplateColumns: "30px 1fr", alignItems: "center", gap: 8 },
  pickerHint: { color: "#64748b", fontSize: 12.5, fontWeight: 850 },
  pickerChevron: { position: "absolute", right: 10, top: 9, color: "#94a3b8", fontSize: 22, lineHeight: 1 },
  compareHeads: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 },
  playerMini: { minWidth: 0, display: "grid", gridTemplateColumns: "30px 1fr", alignItems: "center", gap: 8, border: "1px solid #e5e7eb", background: "#fbfdfb", borderRadius: 13, padding: 9 },
  miniName: { display: "block", color: "#0f172a", fontSize: 12.5, fontWeight: 1000, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  miniSub: { display: "block", color: "#64748b", fontSize: 10.5, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  compareStats: { display: "grid", gap: 7 },
  compareMetric: { border: "1px solid #e5e7eb", background: "#fff", borderRadius: 13, padding: 10 },
  compareMetricTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, color: "#0f172a", fontSize: 12.5, fontWeight: 950 },
  duelBars: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 },
  duelTrack: { height: 5, borderRadius: 999, background: "#eef2f7", overflow: "hidden" },
  duelFillA: { display: "block", height: "100%", borderRadius: 999, background: "#15803d" },
  duelFillB: { display: "block", height: "100%", borderRadius: 999, background: "#e07b1a" },
  empty: { border: "1px dashed #cbd5e1", borderRadius: 13, padding: 14, color: "#64748b", fontSize: 13, fontWeight: 850, textAlign: "center" },
  sheetLayer: { position: "fixed", inset: 0, zIndex: 160, display: "grid", alignItems: "end", justifyItems: "center", pointerEvents: "none" },
  sheetBackdrop: { position: "absolute", inset: 0, border: 0, background: "rgba(13,24,18,.28)", pointerEvents: "auto" },
  sheet: { position: "relative", zIndex: 2, width: "100%", maxWidth: 520, height: "64vh", background: "white", borderRadius: "18px 18px 0 0", padding: "10px 12px calc(14px + env(safe-area-inset-bottom, 0px))", boxShadow: "0 -16px 34px rgba(15,23,42,.18)", display: "grid", gridTemplateRows: "auto auto auto 1fr", gap: 10, pointerEvents: "auto" },
  sheetHandle: { width: 40, height: 4, borderRadius: 999, background: "#cbd5e1", justifySelf: "center" },
  sheetHead: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  sheetTitle: { margin: 0, color: "#0f172a", fontSize: 18, fontWeight: 1000, letterSpacing: "-0.02em" },
  closeBtn: { width: 32, height: 32, border: "1px solid #e5e7eb", borderRadius: 10, background: "white", color: "#64748b", fontSize: 22, lineHeight: 1, fontFamily: "inherit", cursor: "pointer" },
  searchWrap: { position: "relative" },
  searchIcon: { position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 18, pointerEvents: "none" },
  sheetSearch: { width: "100%", height: 42, borderRadius: 10, border: "1px solid #cbd5e1", padding: "0 12px 0 36px", fontFamily: "inherit", fontSize: 13, fontWeight: 800, outline: "none" },
  resultList: { overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 12 },
  resultRow: { width: "100%", display: "grid", gridTemplateColumns: "34px minmax(0, 1fr) auto", alignItems: "center", gap: 10, minHeight: 58, padding: "8px 10px", border: 0, borderBottom: "1px solid #f1f5f9", background: "white", textAlign: "left", fontFamily: "inherit", cursor: "pointer" },
  resultRowActive: { background: "#f0fdf4" },
  resultText: { minWidth: 0, display: "grid", gap: 2, color: "#0f172a", fontSize: 13 },
  resultMetric: { color: "#15803d", fontSize: 13, fontWeight: 1000, fontVariantNumeric: "tabular-nums" },
};
