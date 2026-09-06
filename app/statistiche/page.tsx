"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import LoadingScreen from "../components/LoadingScreen";
import { useRequireApp } from "../hooks/useRequireApp";
import { supabase } from "../../lib/supabaseClient";
import { rpcJson, fmt, signedFmt } from "../../lib/rpc";

type Row = {
  player_id: string;
  player_name: string;
  team_name: string | null;
  image_url?: string | null;
  role: string;
  played_count: number;
  avg_points: number;
  total_points: number;
  best_points: number;
  worst_points: number;
};

type MatchdayOption = {
  matchday_number: number;
  status: string | null;
};

type PlayerHistoryPoint = {
  matchday_number: number;
  points: number;
};

type PlayerDetail = {
  history?: PlayerHistoryPoint[] | null;
};

type Section = "overview" | "players" | "compare";
type MetricKey = "avg" | "total" | "played" | "best" | "worst";
type SortDir = "desc" | "asc";

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

function PlayerAvatar({ row, size = 30 }: { row: Row; size?: number }) {
  const [failed, setFailed] = useState(false);

  if (row.image_url && !failed) {
    return (
      <span style={{ ...s.avatarWrap, width: size, height: size }}>
        <img
          src={row.image_url}
          alt=""
          style={s.avatarImg}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
        <span style={s.avatarRole}>{row.role}</span>
      </span>
    );
  }

  return <RoleBadge role={row.role} />;
}

async function withCatalogImages(rows: Row[]) {
  const ids = rows.map((row) => row.player_id).filter(Boolean);
  if (ids.length === 0) return rows;

  const { data: players } = await supabase
    .from("real_players")
    .select("id,image_url,real_team_id")
    .in("id", ids);

  const playerImages = new Map<string, string | null>();
  const teamIds = Array.from(new Set((players ?? []).map((p) => p.real_team_id).filter(Boolean))) as string[];

  let teamImages = new Map<string, string | null>();
  if (teamIds.length > 0) {
    const { data: teams } = await supabase
      .from("real_teams")
      .select("id,logo_url")
      .in("id", teamIds);

    teamImages = new Map((teams ?? []).map((team) => [team.id, team.logo_url ?? null]));
  }

  for (const player of players ?? []) {
    playerImages.set(player.id, player.image_url ?? teamImages.get(player.real_team_id ?? "") ?? null);
  }

  return rows.map((row) => ({
    ...row,
    image_url: row.image_url ?? playerImages.get(row.player_id) ?? null,
  }));
}

export default function Statistiche() {
  const app = useRequireApp(true);
  const router = useRouter();
  const [overallRows, setOverallRows] = useState<Row[]>([]);
  const [matchdayRows, setMatchdayRows] = useState<Row[]>([]);
  const [matchdays, setMatchdays] = useState<MatchdayOption[]>([]);
  const [selectedMatchday, setSelectedMatchday] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("overview");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("ALL");
  const [metric, setMetric] = useState<MetricKey>("avg");
  const [showAll, setShowAll] = useState(false);
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [activeCompare, setActiveCompare] = useState<"A" | "B" | null>(null);
  const [coverHistory, setCoverHistory] = useState<PlayerHistoryPoint[]>([]);

  useEffect(() => {
    if (!app.ready || !app.activeLeagueCompetitionId) return;
    let off = false;
    Promise.all([
      rpcJson<Row[]>("get_player_stats", { p_league_competition_id: app.activeLeagueCompetitionId }, [])
        .then((r) => withCatalogImages(r ?? [])),
      rpcJson<MatchdayOption[]>(
        "get_player_stats_matchdays",
        { p_league_competition_id: app.activeLeagueCompetitionId },
        []
      ).catch(() => []),
    ])
      .then(([stats, dayRows]) => {
        if (off) return;
        setOverallRows(stats);
        setMatchdayRows([]);
        setMatchdays([...(dayRows ?? [])].sort((a, b) => a.matchday_number - b.matchday_number));
      })
      .finally(() => {
        if (!off) setLoading(false);
      });
    return () => {
      off = true;
    };
  }, [app.ready, app.activeLeagueCompetitionId]);

  useEffect(() => {
    if (!app.ready || !app.activeLeagueCompetitionId || loading) return;
    if (selectedMatchday == null) return;

    let off = false;
    rpcJson<Row[]>(
      "get_player_stats_by_matchday",
      {
        p_league_competition_id: app.activeLeagueCompetitionId,
        p_matchday_number: selectedMatchday,
      },
      []
    )
      .then((r) => withCatalogImages(r ?? []))
      .then((r) => {
        if (!off) setMatchdayRows(r);
      })
      .catch(() => {
        if (!off) setMatchdayRows([]);
      });

    return () => {
      off = true;
    };
  }, [app.ready, app.activeLeagueCompetitionId, loading, selectedMatchday]);

  const rows = selectedMatchday == null ? overallRows : matchdayRows;

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
    const direction = sortDir === "desc" ? 1 : -1;
    return [...base]
      .sort((a, b) => (metricValue(b, metric) - metricValue(a, metric)) * direction || playerLabel(a).localeCompare(playerLabel(b)))
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [rows, q, role, metric, sortDir]);

  const maxMetric = useMemo(() => Math.max(1, ...filtered.map((r) => Math.abs(metricValue(r, metric)))), [filtered, metric]);
  const visibleRows = showAll ? filtered : filtered.slice(0, 24);
  const effectiveCompareA = compareA || overallRows[0]?.player_id || "";
  const effectiveCompareB = compareB || overallRows.find((r) => r.player_id !== effectiveCompareA)?.player_id || effectiveCompareA;
  const playerA = overallRows.find((r) => r.player_id === effectiveCompareA) ?? overallRows[0];
  const playerB = overallRows.find((r) => r.player_id === effectiveCompareB) ?? overallRows.find((r) => r.player_id !== playerA?.player_id) ?? overallRows[0];
  const coverPlayer = topThree[0];
  const bestAverage = topThree[0]?.avg_points ?? 0;
  const recordPoints = useMemo(() => Math.max(0, ...rows.map((r) => Number(r.best_points) || 0)), [rows]);
  const roleHot = useMemo(() => {
    const grouped = new Map<string, { role: string; total: number; count: number }>();
    for (const row of rows) {
      const points = Number(row.avg_points) || 0;
      if (points <= 0) continue;
      const item = grouped.get(row.role) ?? { role: row.role, total: 0, count: 0 };
      item.total += points;
      item.count += 1;
      grouped.set(row.role, item);
    }
    return [...grouped.values()]
      .map((item) => ({ ...item, average: item.count > 0 ? item.total / item.count : 0 }))
      .sort((a, b) => b.average - a.average)[0];
  }, [rows]);
  const teamHot = useMemo(() => {
    const grouped = new Map<string, { team: string; total: number; count: number }>();
    for (const row of rows) {
      if (!row.team_name) continue;
      const points = Number(row.total_points) || 0;
      if (points <= 0) continue;
      const item = grouped.get(row.team_name) ?? { team: row.team_name, total: 0, count: 0 };
      item.total += points;
      item.count += 1;
      grouped.set(row.team_name, item);
    }
    return [...grouped.values()].sort((a, b) => b.total - a.total || b.count - a.count)[0];
  }, [rows]);
  const coverGraph = useMemo(() => {
    if (coverHistory.length > 0) return coverHistory.slice(-6);
    if (!coverPlayer) return [];
    return [{ matchday_number: selectedMatchday ?? matchdays[0]?.matchday_number ?? 1, points: Number(coverPlayer.avg_points) || 0 }];
  }, [coverHistory, coverPlayer, matchdays, selectedMatchday]);
  const accent = app.competitionTheme.primary;

  const openPlayer = useCallback((id: string) => router.push(`/giocatore/${id}`), [router]);

  useEffect(() => {
    if (!app.ready || !app.activeLeagueCompetitionId || !coverPlayer?.player_id) return;
    let off = false;
    rpcJson<PlayerDetail | null>(
      "get_player_detail",
      {
        p_real_player_id: coverPlayer.player_id,
        p_league_competition_id: app.activeLeagueCompetitionId,
      },
      null
    )
      .then((detail) => {
        if (off) return;
        const history = (detail?.history ?? [])
          .map((point) => ({
            matchday_number: Number(point.matchday_number) || 0,
            points: Number(point.points) || 0,
          }))
          .filter((point) => point.matchday_number > 0);
        setCoverHistory(history);
      })
      .catch(() => {
        if (!off) setCoverHistory([]);
      });
    return () => {
      off = true;
    };
  }, [app.ready, app.activeLeagueCompetitionId, coverPlayer?.player_id]);

  if (!app.ready || loading) return <LoadingScreen />;

  return (
    <>
      <AppBar league={app.leagueName} team={app.teamName} onMenuOpen={app.openDrawer} />

      <main className="fc-stats-page" style={s.container}>
        <section className="fc-stats-hero" style={s.hero}>
          <div style={s.heroTop}>
            <span style={s.heroBadge}><span style={s.heroDot} />{app.competitionName}</span>
            <span className="fc-stats-status" style={s.status}>Dati live</span>
          </div>

          <div style={s.heroCopy}>
            <h1 style={s.h1}>Zona statistiche</h1>
            <p style={s.hsub}>Top performer, rischi, ruoli caldi e statistiche decisive in una sola schermata.</p>
          </div>

          <div style={s.heroKpis}>
            <Kpi label="Top media" value={fmt(bestAverage)} tone="good" />
            <Kpi label="Giornate" value={String(matchdays.length)} />
            <Kpi label="Punteggio record" value={fmt(recordPoints)} tone="warn" />
          </div>
        </section>

        <nav className="fc-stats-tabs" style={s.tabs} aria-label="Sezioni statistiche">
          <Tab active={section === "overview"} onClick={() => setSection("overview")} label="Panoramica" />
          <Tab active={section === "players"} onClick={() => setSection("players")} label="Giocatori" />
          <Tab active={section === "compare"} onClick={() => setSection("compare")} label="Confronto" />
        </nav>

        {section !== "compare" && (
          <section className="fc-stats-controls" style={s.scopeControls}>
            <div style={s.dayFilters}>
              <button
                type="button"
                className={`fc-stats-day${selectedMatchday == null ? " is-active" : ""}`}
                style={{ ...s.dayBtn, ...(selectedMatchday == null ? s.dayBtnActive : {}) }}
                onClick={() => {
                  setSelectedMatchday(null);
                  setShowAll(false);
                }}
              >
                Totale
              </button>
              {matchdays.map((md) => (
                <button
                  key={md.matchday_number}
                  type="button"
                  className={`fc-stats-day${selectedMatchday === md.matchday_number ? " is-active" : ""}`}
                  style={{ ...s.dayBtn, ...(selectedMatchday === md.matchday_number ? s.dayBtnActive : {}) }}
                  onClick={() => {
                    setSelectedMatchday(md.matchday_number);
                    setShowAll(false);
                  }}
                >
                  G{md.matchday_number}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="fc-stats-sort"
              style={s.sortBtn}
              onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
            >
              {sortDir === "desc" ? "Dal più alto" : "Dal più basso"}
            </button>
          </section>
        )}

        {section === "overview" && (
          <>
            {coverPlayer && (
              <section className="fc-stats-card fc-stats-cover" style={s.coverCard}>
                <div style={s.sectionHead}>
                  <div>
                    <h2 style={s.sectionTitle}>Uomo copertina</h2>
                    <p style={s.sectionSub}>Rendimento giornata per giornata.</p>
                  </div>
                  <button type="button" style={s.linkBtn} onClick={() => openPlayer(coverPlayer.player_id)}>Scheda</button>
                </div>

                <button type="button" style={s.coverMain} onClick={() => openPlayer(coverPlayer.player_id)}>
                  <PlayerAvatar row={coverPlayer} size={56} />
                  <span style={{ minWidth: 0 }}>
                    <b style={s.coverName}>{playerLabel(coverPlayer)}</b>
                    <small style={s.coverSub}>{playerSub(coverPlayer)}</small>
                  </span>
                  <strong style={s.coverScore}>{fmt(coverPlayer.avg_points)}</strong>
                </button>

                <MiniTrend points={coverGraph} />
              </section>
            )}

            <section style={s.insightGrid}>
              {roleHot && (
                <div className="fc-stats-card" style={{ ...s.insightTile, ...s.insightGreen }}>
                  <small style={s.insightLabel}>Ruolo caldo</small>
                  <strong style={s.insightTitle}>{ROLE_META[roleHot.role]?.label ?? roleHot.role}</strong>
                  <span style={s.insightText}>Media positiva: {fmt(roleHot.average)} punti</span>
                </div>
              )}
              {teamHot && (
                <div className="fc-stats-card" style={{ ...s.insightTile, ...s.insightOrange }}>
                  <small style={s.insightLabel}>Squadra hot</small>
                  <strong style={s.insightTitle}>{teamHot.team}</strong>
                  <span style={s.insightText}>{fmt(teamHot.total)} punti dai giocatori con statistiche</span>
                </div>
              )}
            </section>

            <section className="fc-stats-card" style={s.card}>
              <div style={s.sectionHead}>
                <div>
                  <h2 style={s.sectionTitle}>Top e flop</h2>
                  <p style={s.sectionSub}>Vista immediata prima della scelta.</p>
                </div>
                <button type="button" style={s.linkBtn} onClick={() => setSection("players")}>Database</button>
              </div>

              <div style={s.boardList}>
                {topThree.slice(0, 2).map((r, index) => (
                  <button key={r.player_id} type="button" className="fc-stats-board-row" style={s.boardRow} onClick={() => openPlayer(r.player_id)}>
                    <span style={s.boardRank}>{index + 1}</span>
                    <PlayerAvatar row={r} />
                    <span style={{ minWidth: 0 }}>
                      <b style={s.compactName}>{playerLabel(r)}</b>
                      <small style={s.compactSub}>{index === 0 ? "Top media" : "Top equilibrio"} · {r.role}</small>
                    </span>
                    <strong style={{ ...s.compactScore, color: "var(--fc-primary)" }}>{fmt(r.avg_points)}</strong>
                  </button>
                ))}
                {flopThree[0] && (
                  <button type="button" className="fc-stats-board-row" style={s.boardRow} onClick={() => openPlayer(flopThree[0].player_id)}>
                    <span style={{ ...s.boardRank, ...s.boardRankBad }}>F</span>
                    <PlayerAvatar row={flopThree[0]} />
                    <span style={{ minWidth: 0 }}>
                      <b style={s.compactName}>{playerLabel(flopThree[0])}</b>
                      <small style={s.compactSub}>Flop media · {flopThree[0].role}</small>
                    </span>
                    <strong style={{ ...s.compactScore, color: "#dc2626" }}>{fmt(flopThree[0].avg_points)}</strong>
                  </button>
                )}
                {topThree.length === 0 && <div className="fc-stats-empty" style={s.empty}>Nessun giocatore disponibile.</div>}
              </div>
            </section>

            <section className="fc-stats-card" style={s.card}>
              <div style={s.sectionHead}>
                <div>
                  <h2 style={s.sectionTitle}>Da confrontare</h2>
                  <p style={s.sectionSub}>Scelte simili, rendimento diverso.</p>
                </div>
                <button type="button" style={s.linkBtn} onClick={() => setSection("compare")}>Apri</button>
              </div>
              <div style={s.compareSuggestions}>
                {topThree[0] && topThree[1] && (
                  <button type="button" style={s.suggestionRow} onClick={() => {
                    setCompareA(topThree[0].player_id);
                    setCompareB(topThree[1].player_id);
                    setSection("compare");
                  }}>
                    <span style={s.suggestionText}>
                      <b>{playerLabel(topThree[0])} vs {playerLabel(topThree[1])}</b>
                      <small>Media, totale, best e worst</small>
                    </span>
                    <strong style={s.suggestionVs}>VS</strong>
                  </button>
                )}
                {topThree[0] && flopThree[0] && (
                  <button type="button" style={s.suggestionRow} onClick={() => {
                    setCompareA(topThree[0].player_id);
                    setCompareB(flopThree[0].player_id);
                    setSection("compare");
                  }}>
                    <span style={s.suggestionText}>
                      <b>{playerLabel(topThree[0])} vs {playerLabel(flopThree[0])}</b>
                      <small>Top performer contro rischio</small>
                    </span>
                    <strong style={s.suggestionVs}>VS</strong>
                  </button>
                )}
              </div>
            </section>
          </>
        )}

        {section === "players" && (
          <section className="fc-stats-card" style={s.card}>
            <div style={s.sectionHead}>
              <div>
                <h2 style={s.sectionTitle}>Tutti i giocatori</h2>
                <p style={s.sectionSub}>
                  {selectedMatchday == null
                    ? "Ricerca e ordina la lista completa."
                    : `Statistiche della giornata ${selectedMatchday}.`}
                </p>
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
                      <PlayerAvatar row={r} />
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
          rows={overallRows}
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
      <b style={{ color: tone === "warn" ? "#fed7aa" : "white" }}>{value}</b>
    </div>
  );
}

function MiniTrend({ points }: { points: PlayerHistoryPoint[] }) {
  const max = Math.max(1, ...points.map((point) => Math.abs(Number(point.points) || 0)));

  return (
    <div style={s.trendWrap} aria-label="Andamento punteggi giornalieri">
      {points.map((point) => {
        const value = Number(point.points) || 0;
        const height = Math.max(14, Math.min(58, (Math.abs(value) / max) * 58));
        return (
          <span key={point.matchday_number} style={s.trendItem}>
            <span
              style={{
                ...s.trendBar,
                height,
                background: value < 0 ? "linear-gradient(180deg,#f97316,#dc2626)" : "linear-gradient(180deg,#16a34a,#e07b1a)",
              }}
            />
            <small style={s.trendLabel}>G{point.matchday_number}</small>
          </span>
        );
      })}
      {points.length === 0 && <span style={s.trendEmpty}>Andamento disponibile dopo le prime statistiche.</span>}
    </div>
  );
}

function ComparePickButton({ label, row, onClick }: { label: string; row?: Row; onClick: () => void }) {
  return (
    <button type="button" className="fc-stats-picker" style={s.pickerButton} onClick={onClick}>
      <span style={s.pickerLabel}>{label}</span>
      {row ? (
        <span style={s.pickerValue}>
          <PlayerAvatar row={row} />
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
              <PlayerAvatar row={r} />
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
      <PlayerAvatar row={row} />
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
        <b style={s.compareValueLeft}>{text(a)}</b>
        <strong style={s.compareLabel}>{label}</strong>
        <b style={s.compareValueRight}>{text(b)}</b>
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
  hero: { position: "relative", overflow: "hidden", background: "radial-gradient(circle at 88% 4%,rgba(224,123,26,.95),transparent 30%), linear-gradient(140deg,#064c2a 0%,#07853f 70%,#15a85d 100%)", border: 0, borderRadius: 20, padding: 15, boxShadow: "0 16px 30px rgba(7,133,63,.22)", color: "white" },
  heroTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  heroBadge: { display: "inline-flex", alignItems: "center", gap: 7, maxWidth: "60%", borderRadius: 999, padding: "6px 10px", background: "rgba(255,255,255,.15)", color: "rgba(255,255,255,.92)", fontSize: 11.5, fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  heroDot: { width: 7, height: 7, borderRadius: "50%", background: "#e07b1a", flexShrink: 0 },
  status: { border: "1px solid rgba(255,255,255,.16)", color: "rgba(255,255,255,.92)", background: "rgba(255,255,255,.13)", borderRadius: 999, padding: "6px 9px", fontSize: 10.5, fontWeight: 950, whiteSpace: "nowrap" },
  heroCopy: { marginTop: 12 },
  eyebrow: { color: "#15803d", fontSize: 10.5, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0 },
  h1: { margin: 0, color: "white", fontSize: 30, lineHeight: 1, fontWeight: 1000, letterSpacing: 0 },
  hsub: { margin: "8px 0 0", maxWidth: 390, color: "rgba(255,255,255,.78)", fontSize: 12.5, lineHeight: 1.3, fontWeight: 800 },
  heroKpis: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 7, marginTop: 14 },
  kpi: { background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.16)", borderRadius: 14, padding: "9px 7px", display: "grid", gap: 3, minWidth: 0, textAlign: "center", color: "white" },
  tabs: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 4, background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: 4, boxShadow: "0 4px 14px rgba(15,23,42,.045)" },
  tab: { border: 0, background: "transparent", borderRadius: 10, padding: "9px 5px", color: "#64748b", fontSize: 12, fontWeight: 950, fontFamily: "inherit", cursor: "pointer" },
  tabActive: { background: "#0f172a", color: "white" },
  scopeControls: { display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 8, background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: 8, boxShadow: "0 4px 14px rgba(15,23,42,.045)" },
  dayFilters: { display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" },
  dayBtn: { flex: "0 0 auto", border: "1px solid #e5e7eb", background: "#f8fafc", color: "#64748b", borderRadius: 999, padding: "8px 10px", fontSize: 11.5, fontWeight: 950, fontFamily: "inherit", cursor: "pointer" },
  dayBtnActive: { background: "#0f172a", color: "white", borderColor: "#0f172a" },
  sortBtn: { border: "1px solid rgba(224,123,26,.30)", background: "#fff7ed", color: "#c45f0a", borderRadius: 999, padding: "8px 10px", fontSize: 11.5, fontWeight: 1000, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" },
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: 14, boxShadow: "0 8px 22px rgba(15,23,42,.055)" },
  sectionHead: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  sectionTitle: { margin: 0, color: "#0f172a", fontSize: 18, lineHeight: 1.05, fontWeight: 1000, letterSpacing: 0 },
  sectionSub: { margin: "4px 0 0", color: "#64748b", fontSize: 12, lineHeight: 1.25, fontWeight: 800 },
  linkBtn: { border: 0, background: "transparent", color: "#15803d", fontSize: 12, fontWeight: 1000, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" },
  coverCard: { background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: 14, boxShadow: "0 10px 24px rgba(15,23,42,.065)" },
  coverMain: { width: "100%", display: "grid", gridTemplateColumns: "56px minmax(0,1fr) auto", alignItems: "center", gap: 11, border: 0, background: "transparent", padding: 0, textAlign: "left", fontFamily: "inherit", cursor: "pointer" },
  coverName: { display: "block", color: "#0f172a", fontSize: 16, lineHeight: 1.08, fontWeight: 1000, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  coverSub: { display: "block", color: "#64748b", fontSize: 11.5, fontWeight: 800, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  coverScore: { color: "#15803d", fontSize: 28, lineHeight: 1, fontWeight: 1000, fontVariantNumeric: "tabular-nums" },
  trendWrap: { display: "grid", gridTemplateColumns: "repeat(6,minmax(0,1fr))", alignItems: "end", gap: 7, minHeight: 78, padding: "14px 2px 0", marginTop: 4 },
  trendItem: { minWidth: 0, height: 74, display: "grid", gridTemplateRows: "1fr auto", justifyItems: "center", alignItems: "end", gap: 4 },
  trendBar: { display: "block", width: "100%", maxWidth: 28, borderRadius: "999px 999px 5px 5px", minHeight: 14, boxShadow: "0 7px 15px rgba(21,128,61,.16)" },
  trendLabel: { color: "#64748b", fontSize: 10, fontWeight: 900 },
  trendEmpty: { gridColumn: "1 / -1", alignSelf: "center", justifySelf: "center", color: "#64748b", fontSize: 12, fontWeight: 850, textAlign: "center" },
  insightGrid: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 9 },
  insightTile: { minHeight: 112, borderRadius: 18, padding: 13, display: "grid", alignContent: "start", gap: 7, boxShadow: "0 8px 20px rgba(15,23,42,.045)" },
  insightGreen: { background: "linear-gradient(145deg,#ffffff 0%,#eaf8ef 100%)", border: "1px solid rgba(21,128,61,.18)" },
  insightOrange: { background: "linear-gradient(145deg,#ffffff 0%,#fff3e6 100%)", border: "1px solid rgba(224,123,26,.22)" },
  insightLabel: { color: "#64748b", fontSize: 10.5, fontWeight: 1000, textTransform: "uppercase", letterSpacing: 0 },
  insightTitle: { color: "#0f172a", fontSize: 19, lineHeight: 1.05, fontWeight: 1000 },
  insightText: { color: "#64748b", fontSize: 11.5, lineHeight: 1.25, fontWeight: 800 },
  boardList: { display: "grid", gap: 2 },
  boardRow: { display: "grid", gridTemplateColumns: "26px 30px minmax(0,1fr) auto", alignItems: "center", gap: 9, border: 0, borderTop: "1px solid #f1f5f9", background: "white", padding: "9px 0", textAlign: "left", fontFamily: "inherit", cursor: "pointer" },
  boardRank: { width: 26, height: 26, borderRadius: 9, background: "#eaf8ef", color: "#15803d", display: "grid", placeItems: "center", fontSize: 11.5, fontWeight: 1000 },
  boardRankBad: { background: "#fff3e6", color: "#c45f0a" },
  compareSuggestions: { display: "grid", gap: 0 },
  suggestionRow: { width: "100%", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", alignItems: "center", gap: 10, border: 0, borderTop: "1px solid #f1f5f9", background: "white", padding: "10px 0", textAlign: "left", fontFamily: "inherit", cursor: "pointer" },
  suggestionText: { minWidth: 0, display: "grid", gap: 2, color: "#0f172a", fontSize: 13, fontWeight: 950 },
  suggestionVs: { color: "#15803d", fontSize: 13, fontWeight: 1000 },
  spotlight: { display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 12, background: "linear-gradient(135deg,#0f7f3d 0%,#0b5c2f 72%,#e07b1a 170%)", border: "1px solid rgba(15,127,61,.35)", borderRadius: 18, padding: 14, color: "white", boxShadow: "0 14px 28px rgba(15,127,61,.20)" },
  spotlightMain: { minWidth: 0, display: "grid", gap: 9 },
  spotlightLabel: { color: "rgba(255,255,255,.72)", fontSize: 10.5, fontWeight: 1000, textTransform: "uppercase", letterSpacing: ".04em" },
  spotlightPlayer: { minWidth: 0, display: "grid", gridTemplateColumns: "48px 1fr", alignItems: "center", gap: 10 },
  spotlightName: { display: "block", color: "white", fontSize: 18, lineHeight: 1.05, fontWeight: 1000, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  spotlightSub: { display: "block", color: "rgba(255,255,255,.76)", fontSize: 11.5, fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 },
  spotlightScore: { display: "grid", justifyItems: "end", gap: 1, minWidth: 64 },
  spotlightScoreLabel: { color: "rgba(255,255,255,.72)", fontSize: 10.5, fontWeight: 1000, textTransform: "uppercase" },
  spotlightScoreValue: { color: "white", fontSize: 31, lineHeight: 1, fontWeight: 1000, fontVariantNumeric: "tabular-nums" },
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
  avatarWrap: { position: "relative", display: "inline-grid", placeItems: "center", borderRadius: "50%", overflow: "visible", flexShrink: 0, background: "#f1f5f9", border: "1px solid rgba(226,232,240,.95)", boxShadow: "0 2px 8px rgba(15,23,42,.10)" },
  avatarImg: { width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", display: "block" },
  avatarRole: { position: "absolute", right: -3, bottom: -3, width: 15, height: 15, borderRadius: "50%", display: "grid", placeItems: "center", background: "#0f172a", color: "white", border: "1.5px solid white", fontSize: 8.5, fontWeight: 1000, lineHeight: 1 },
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
  compareMetricTop: { display: "grid", gridTemplateColumns: "minmax(52px,1fr) minmax(98px,auto) minmax(52px,1fr)", alignItems: "center", gap: 8, color: "#0f172a", fontSize: 12.5, fontWeight: 950 },
  compareValueLeft: { color: "#15803d", fontSize: 14, fontWeight: 1000, fontVariantNumeric: "tabular-nums", textAlign: "left" },
  compareLabel: { color: "#64748b", fontSize: 11.5, fontWeight: 950, textAlign: "center", lineHeight: 1.15 },
  compareValueRight: { color: "#e07b1a", fontSize: 14, fontWeight: 1000, fontVariantNumeric: "tabular-nums", textAlign: "right" },
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
