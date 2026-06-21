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

type LineupPlayer = { role: string; name: string; team?: string | null; points: number | null };
type HomeData = {
  matchday?: { id: string; number: number; status: string; slot_start?: string | null; slot_end?: string | null } | null;
  lineup?: { total_points: number; players: LineupPlayer[] } | null;
  stats?: { rank: number | null; total_points: number; avg_points: number; history: { matchday_number: number; score: number }[] } | null;
};
type CompetitionStatus = {
  league_competition_id: string; league_competition_status: string; competition_id: string;
  competition_name: string; competition_visibility_status: string; competition_active: boolean;
};
type StandRow = { user_id: string; team_name: string; total_points: number; rank: number };
type TopPlayer = { name: string; role: string; team: string; points: number };
type Recap = { has_data: boolean; matchday_number?: number; leader_team?: string; leader_points?: number; mvp_name?: string; mvp_team?: string; mvp_role?: string; mvp_points?: number };
type Kit = { primary: string; secondary: string; pattern: BadgePattern };

const emptyHome: HomeData = { matchday: null, lineup: null, stats: null };
const ROLE_ORDER = ["A", "C", "D", "P"];
const TOP_ROLE_ORDER = ["P", "D", "C", "A"];

const ROLE_META: Record<string, { bg: string; fg: string; label: string }> = {
  P: { bg: "#FEF3C7", fg: "#B45309", label: "P" },
  D: { bg: "#DCFCE7", fg: "#15803D", label: "D" },
  C: { bg: "#DBEAFE", fg: "#2563EB", label: "C" },
  A: { bg: "#FEE2E2", fg: "#DC2626", label: "A" },
};

function PlayerCrest({ team, colors, size = 40 }: { team: string; colors: Kit | null; size?: number }) {
  if (colors) return <TeamBadge name={team} primary={colors.primary} secondary={colors.secondary} pattern={colors.pattern} showInitials={false} size={size} />;
  return <TeamBadge name={team} showInitials={false} size={size} />;
}

function RoleDot({ role, size = 34 }: { role: string; size?: number }) {
  const meta = ROLE_META[role] ?? { bg: "#F1F5F9", fg: "#475569", label: role };
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
        boxShadow: "0 3px 10px rgba(15,23,42,.10)",
        border: "2px solid rgba(255,255,255,.82)",
        flexShrink: 0,
      }}
    >
      {meta.label}
    </span>
  );
}

function ptsStyle(v: number | null | undefined): React.CSSProperties {
  const n = Number(v ?? 0);
  return n > 0 ? s.ppUp : n < 0 ? s.ppDown : s.ppFlat;
}

export default function Home() {
  const router = useRouter();
  const app = useRequireApp(false);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HomeData>(emptyHome);
  const [err, setErr] = useState<string | null>(null);
  const [recap, setRecap] = useState<Recap | null>(null);

  const [myColors, setMyColors] = useState<{ primary: string | null; secondary: string | null }>({ primary: null, secondary: null });
  const [memberColors, setMemberColors] = useState<Record<string, { primary: string | null; secondary: string | null }>>({});
  const [colorsLoaded, setColorsLoaded] = useState(false);
  const [teamColors, setTeamColors] = useState<Record<string, Kit>>({});
  const [standings, setStandings] = useState<StandRow[]>([]);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [topRole, setTopRole] = useState<string>("A");

  const [competitionStatus, setCompetitionStatus] = useState<CompetitionStatus | null>(null);
  const [finalStanding, setFinalStanding] = useState<StandRow[]>([]);

  function kitOf(team?: string | null): Kit | null {
    if (!team) return null;
    return teamColors[team.trim().toLowerCase()] ?? null;
  }

  useEffect(() => {
    if (!app.ready || !app.userId || !app.activeLeagueId) return;
    if (!app.activeLeagueCompetitionId) { setLoading(false); setData(emptyHome); return; }

    let cancelled = false;
    async function load() {
      setLoading(true); setErr(null);
      try {
        const { data: statusData } = await supabase.rpc("get_active_league_competition_status", { p_league_competition_id: app.activeLeagueCompetitionId });
        const normalizedStatus = statusData as CompetitionStatus | null;
        if (!cancelled) setCompetitionStatus(normalizedStatus);

        const isClosed = normalizedStatus?.league_competition_status === "completed" || normalizedStatus?.competition_visibility_status === "archived" || normalizedStatus?.competition_active === false;
        if (isClosed) {
          const st = await rpcJson<any>("get_standings", { p_league_competition_id: app.activeLeagueCompetitionId }, []);
          if (!cancelled) { setFinalStanding(normalizeStandings(st)); setData(emptyHome); }
          return;
        }

        const result = await rpcJson<HomeData>("get_home_data", { p_league_id: app.activeLeagueId, p_league_competition_id: app.activeLeagueCompetitionId }, emptyHome);
        if (!cancelled) setData(result ?? emptyHome);
      } catch (e: any) {
        if (!cancelled) { setErr(e?.message ?? String(e)); setData(emptyHome); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [app.ready, app.userId, app.activeLeagueId, app.activeLeagueCompetitionId]);

  // colori miei + mappa colori di tutti i membri (per gli stemmi della mini-classifica)
  useEffect(() => {
    if (!app.ready || !app.userId || !app.activeLeagueId) return;
    let off = false;
    supabase.rpc("get_league_members", { p_league_id: app.activeLeagueId }).then(({ data }) => {
      if (off) return;
      const arr = (data as any[] | null) ?? [];
      const mc: Record<string, { primary: string | null; secondary: string | null }> = {};
      arr.forEach((m) => { mc[m.user_id] = { primary: m.color_primary ?? null, secondary: m.color_secondary ?? null }; });
      setMemberColors(mc);
      const me = arr.find((m) => m.user_id === app.userId);
      if (me) setMyColors({ primary: me.color_primary ?? null, secondary: me.color_secondary ?? null });
      setColorsLoaded(true);
    });
    return () => { off = true; };
  }, [app.ready, app.userId, app.activeLeagueId]);

  // onboarding: chi non ha colori viene mandato una volta a /personalizza
  useEffect(() => {
    if (!colorsLoaded || !app.activeLeagueId || myColors.primary) return;
    try {
      if (typeof window !== "undefined" && !sessionStorage.getItem("fc_colors_prompted")) {
        sessionStorage.setItem("fc_colors_prompted", "1");
        router.push("/personalizza");
      }
    } catch {}
  }, [colorsLoaded, myColors.primary, app.activeLeagueId, router]);

  // colori maglia + classifica + top giocatori
  useEffect(() => {
    const lc = app.activeLeagueCompetitionId;
    if (!lc) return;
    let off = false;
    supabase.rpc("get_competition_team_colors", { p_league_competition_id: lc }).then(({ data }) => {
      if (off || !data) return;
      const m: Record<string, Kit> = {};
      (data as any[]).forEach((r) => {
        if (r.name && r.color_primary) m[String(r.name).trim().toLowerCase()] = { primary: r.color_primary, secondary: r.color_secondary || r.color_primary, pattern: (r.kit_pattern || "split") as BadgePattern };
      });
      setTeamColors(m);
    });
    supabase.rpc("get_standings", { p_league_competition_id: lc }).then(({ data }) => { if (!off && data) setStandings(data as StandRow[]); });
    supabase.rpc("get_home_top_players", { p_league_competition_id: lc, p_limit: 5 }).then(({ data }) => { if (!off && data) setTopPlayers(data as TopPlayer[]); });
    return () => { off = true; };
  }, [app.activeLeagueCompetitionId]);

  // mini riassunto Nyx
  useEffect(() => {
    if (!app.ready || !app.activeLeagueCompetitionId) return;
    let off = false;
    rpcJson<Recap>("get_home_recap", { p_league_competition_id: app.activeLeagueCompetitionId }, { has_data: false })
      .then((r) => { if (!off) setRecap(r ?? { has_data: false }); });
    return () => { off = true; };
  }, [app.ready, app.activeLeagueCompetitionId]);

  const lineupGroups = useMemo(() => {
    const players = data.lineup?.players ?? [];
    return ROLE_ORDER.map((r) => ({ role: r, items: players.filter((p) => p.role === r) })).filter((g) => g.items.length > 0);
  }, [data.lineup]);

  if (!app.ready) return <LoadingScreen />;
  if (!app.userId || !app.activeLeagueId) return <LoadingScreen />;

  const theme = app.competitionTheme;

  if (!app.activeLeagueCompetitionId) {
    return (
      <>
        <AppBar league={app.leagueName} team={app.teamName} onMenuOpen={app.openDrawer} right={<button style={s.topBtn} onClick={() => router.push("/seleziona-lega")}>Leghe</button>} />
        <main style={s.container}>
          <div style={s.card}>
            <h2 style={{ margin: 0 }}>Nessuna competizione attiva</h2>
            <p style={s.muted}>La lega è selezionata, ma non risulta ancora una competizione attiva.</p>
            {app.isAdmin ? (
              <button style={{ ...s.primaryBtn, background: "#16a34a" }} onClick={() => router.push("/admin/competizione/nuova")}>Aggiungi competizione</button>
            ) : (
              <button style={{ ...s.primaryBtn, background: "#16a34a" }} onClick={() => router.push("/seleziona-lega")}>Torna alle leghe</button>
            )}
          </div>
        </main>
        <BottomNav />
      </>
    );
  }

  if (loading) return <LoadingScreen />;

  const isClosed = competitionStatus?.league_competition_status === "completed" || competitionStatus?.competition_visibility_status === "archived" || competitionStatus?.competition_active === false;

  if (isClosed) {
    return (
      <>
        <AppBar league={app.leagueName} team={app.teamName} onMenuOpen={app.openDrawer} right={<button style={s.topBtn} onClick={() => router.push("/seleziona-lega")}>Leghe</button>} />
        <section style={{ ...s.hero, background: theme.hero }}>
          <div style={s.heroInner}>
            <CompetitionBadge name={app.competitionName} type={app.competitionType} />
            <div style={s.hello}>Archivio competizione</div>
            <h1 style={s.team}>Competizione conclusa</h1>
            <p style={s.closedText}>{app.competitionName ?? "Questa competizione"} è terminata. Qui sotto trovi la classifica finale della tua lega.</p>
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
                    <div key={`${row.user_id}-${index}`} style={{ ...s.finalRow, background: isMine ? `${theme.primary}10` : "white", borderLeft: `4px solid ${isMine ? theme.primary : "transparent"}` }}>
                      <b style={{ color: isMine ? theme.primary : "#111827" }}>#{row.rank || index + 1}</b>
                      <span>{row.team_name}</span>
                      <strong>{fmt(row.total_points)}</strong>
                    </div>
                  );
                })}
              </div>
            )}
            <button style={{ ...s.primaryBtn, background: theme.primary }} onClick={() => router.push("/storico")}>Vedi storico giornate</button>
          </div>
        </main>
        <BottomNav />
      </>
    );
  }

  const hasLineup = Boolean(data.lineup?.players?.length);
  const mvpLabel = recap?.mvp_role === "P" ? (recap?.mvp_team || recap?.mvp_name) : recap?.mvp_name;

  const meIdx = standings.findIndex((r) => r.user_id === app.userId);
  const myRow = standings.find((r) => r.user_id === app.userId);
  const nearbyRows = meIdx >= 0
    ? standings.slice(Math.max(0, meIdx - 1), Math.min(standings.length, meIdx + 2))
    : standings.slice(0, 3);

  const shownTopPlayers = (() => {
    const byRole = topPlayers.filter((p) => p.role === topRole);
    return (byRole.length ? byRole : topPlayers).slice(0, 3);
  })();

  function StandLine({ row, mine }: { row: StandRow; mine: boolean }) {
    const c = memberColors[row.user_id];
    return (
      <div style={{ ...s.srow, background: mine ? `${theme.primary}12` : "white", borderLeft: `3px solid ${mine ? theme.primary : "transparent"}` }}>
        <span style={s.srank}>{row.rank ?? "—"}</span>
        <TeamBadge name={row.team_name} primary={c?.primary ?? null} secondary={c?.secondary ?? null} size={30} />
        <span style={{ ...s.sname, color: mine ? theme.primary : "#0f172a" }}>{row.team_name}</span>
        <span style={s.spts}>{fmt(row.total_points)} pt</span>
      </div>
    );
  }

  return (
    <>
      <AppBar league={app.leagueName} team={app.teamName} onMenuOpen={app.openDrawer} right={<button style={s.topBtn} onClick={() => router.push("/seleziona-lega")}>Leghe</button>} />

      <section style={{ ...s.hero, background: theme.hero }}>
        <div style={s.heroInner}>
          <CompetitionBadge name={app.competitionName} type={app.competitionType} />
          <div style={s.heroRow}>
            <span style={s.badgeRing}><TeamBadge name={app.teamName} primary={myColors.primary} secondary={myColors.secondary} size={64} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={s.hello}>Ciao, benvenuto</div>
              <h1 style={s.team}>{app.teamName}</h1>
            </div>
          </div>
          <div style={s.kpis}>
            <Kpi label="Posizione" value={data.stats?.rank ? `#${data.stats.rank}` : "—"} />
            <Kpi label="Totale" value={fmt(data.stats?.total_points)} />
            <Kpi label="Media" value={fmt(data.stats?.avg_points)} />
          </div>
        </div>
      </section>

      <main style={s.container}>
        {err && <div style={s.error}>Errore: {err}</div>}

        {/* Giornata */}
        <div style={s.matchCard}>
          <div style={s.matchIcon}>▦</div>
          <div style={{ flex: 1 }}>
            <div style={s.label}>Giornata corrente</div>
            <div style={s.matchday}>{data.matchday?.number ?? "—"}</div>
          </div>
          <span style={{ ...s.status, color: data.matchday ? theme.primary : "#6b7280", background: data.matchday ? `${theme.primary}14` : "#f3f4f6" }}>{data.matchday?.status ?? "locked"}</span>
          <button disabled={!data.matchday} onClick={() => router.push("/rosa")} style={{ ...s.primaryBtn, background: data.matchday ? theme.primary : "#d1d5db" }}>
            {hasLineup ? "Modifica rosa" : "Invia rosa"}
          </button>
        </div>

        {/* Mini-classifica */}
        <div style={s.cardLarge}>
          <div style={s.secHeaderRow}>
            <div style={s.secHead}>La tua classifica</div>
            <button onClick={() => router.push("/classifica")} style={s.textLink}>Vedi classifica completa →</button>
          </div>
          {standings.length === 0 ? (
            <div style={s.muted}>Ancora nessuna classifica.</div>
          ) : (
            <div style={{ marginTop: 12 }}>
              {nearbyRows.map((r) => <StandLine key={r.user_id} row={r} mine={r.user_id === app.userId} />)}
            </div>
          )}
        </div>

        <div style={s.twoCols}>
          {/* Il tuo schieramento (mini campo) */}
          <div style={s.cardSmall}>
            <div style={s.secHeaderRowCompact}>
              <div style={s.secHead}>Il tuo schieramento</div>
              <span style={s.modulePill}>{lineupGroups.length ? `${lineupGroups.find((g) => g.role === "D")?.items.length ?? 0}-${lineupGroups.find((g) => g.role === "C")?.items.length ?? 0}-${lineupGroups.find((g) => g.role === "A")?.items.length ?? 0}` : "—"}</span>
            </div>
            {hasLineup ? (
              <div style={s.miniPitch}>
                <div style={s.miniPitchMidline} />
                <div style={s.miniPitchCircle} />
                {lineupGroups.map((g) => (
                  <div key={g.role} style={s.miniPitchRow}>
                    {g.items.map((p, i) => (
                      <div key={i} style={s.miniPlayer}>
                        <RoleDot role={p.role} size={34} />
                        <span>{shortName(p.role === "P" ? (p.team || p.name) : p.name)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div style={s.emptyBox}>Nessuna formazione schierata.</div>
            )}
          </div>

          {/* Top giocatori */}
          <div style={s.cardSmall}>
            <div style={s.secHeaderRowCompact}>
              <div style={s.secHead}>Top giocatori</div>
              <button onClick={() => router.push("/statistiche")} style={s.textLinkSmall}>Vedi tutti</button>
            </div>
            <div style={s.roleTabs}>
              {TOP_ROLE_ORDER.map((r) => (
                <button key={r} onClick={() => setTopRole(r)} style={{ ...s.roleTab, background: topRole === r ? theme.primary : "#f1f5f9", color: topRole === r ? "white" : "#64748b" }}>{r}</button>
              ))}
            </div>
            {shownTopPlayers.length > 0 ? (
              <div style={s.topList}>
                {shownTopPlayers.map((p, i) => (
                  <div key={`${p.name}-${i}`} style={s.topRowCompact}>
                    <span style={s.topRank}>{i + 1}</span>
                    <RoleDot role={p.role} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={s.topName}>{shortName(p.name)}</div>
                      <div style={s.topSub}>{p.team}</div>
                    </div>
                    <div style={{ ...s.ppPts, ...ptsStyle(p.points) }}>{signedFmt(p.points)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={s.emptyBox}>In attesa statistiche.</div>
            )}
          </div>
        </div>

        <button onClick={() => router.push("/regole")} style={s.ruleLink}>
          <span style={s.ruleIcon}>◎</span>
          <span>Regole competizione</span>
          <span style={{ marginLeft: "auto" }}>›</span>
        </button>

        {/* Nyx */}
        {recap?.has_data && (
          <div style={s.recapCard}>
            <div style={s.recapRow}>
              <img src="/nyx-v2.png" alt="Nyx" style={s.recapMascot} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.recapLabel}>Nyx · Giornata {recap.matchday_number}</div>
                <p style={s.recapText}>
                  La giornata va a <b>{recap.leader_team}</b> con {fmt(recap.leader_points)} punti. Migliore in campo <b>{mvpLabel}</b> ({signedFmt(recap.mvp_points)}).
                </p>
              </div>
            </div>
            <button style={s.recapBtn} onClick={() => router.push("/podcast")}>Leggi la puntata intera →</button>
          </div>
        )}

        {app.isAdmin && (
          <div style={s.adminCard}>
            <div style={s.adminIcon}>⚙</div>
            <div style={{ flex: 1 }}>
              <h3 style={s.adminTitle}>Admin competizione</h3>
              <p style={s.adminText}>Le azioni admin lavorano su {app.competitionName ?? "competizione attiva"}.</p>
            </div>
            <button style={s.adminBtn} onClick={() => router.push("/admin")}>Apri admin</button>
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}

function shortName(name?: string | null) {
  const n = String(name ?? "").trim();
  if (n.length <= 13) return n;
  return `${n.slice(0, 12)}…`;
}

function normalizeStandings(value: any): StandRow[] {
  if (Array.isArray(value)) return value as StandRow[];
  if (Array.isArray(value?.rows)) return value.rows as StandRow[];
  if (Array.isArray(value?.standings)) return value.standings as StandRow[];
  if (Array.isArray(value?.data)) return value.data as StandRow[];
  return [];
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (<div style={s.kpi}><small>{label}</small><b>{value}</b></div>);
}

const s: Record<string, React.CSSProperties> = {
  topBtn: { border: "1px solid #fed7aa", borderRadius: 999, background: "#fff7ed", color: "#ea580c", padding: "8px 17px", fontWeight: 1000, cursor: "pointer" },
  hero: { color: "white", padding: "18px 16px 92px", position: "relative", overflow: "hidden" },
  heroInner: { maxWidth: 520, margin: "0 auto", position: "relative", zIndex: 1 },
  heroRow: { display: "flex", alignItems: "center", gap: 14, marginTop: 18 },
  badgeRing: { borderRadius: "50%", padding: 4, border: "2px solid rgba(255,255,255,.86)", display: "grid", placeItems: "center", flexShrink: 0, boxShadow: "0 8px 22px rgba(0,0,0,.16)" },
  hello: { opacity: 0.82, fontWeight: 900, fontSize: 15 },
  team: { fontSize: 31, lineHeight: 1.06, margin: "4px 0 0", letterSpacing: "-.03em", fontWeight: 1000 },
  closedText: { margin: "0", color: "rgba(255,255,255,0.78)", fontWeight: 750, lineHeight: 1.45 },
  closedTitle: { margin: "0 0 12px", color: "#111827", fontWeight: 1000, fontSize: 22 },
  finalTable: { display: "grid", gap: 8 },
  finalRow: { display: "grid", gridTemplateColumns: "44px 1fr 70px", gap: 8, alignItems: "center", padding: 12, borderRadius: 12, border: "1px solid #e5e7eb" },
  kpis: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 22 },
  kpi: { background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.28)", borderRadius: 16, padding: "15px 10px", display: "grid", gap: 4, textAlign: "center", boxShadow: "inset 0 1px 0 rgba(255,255,255,.18)" },
  container: { maxWidth: 520, margin: "-74px auto 0", padding: "0 14px calc(70px + env(safe-area-inset-bottom, 0px) + 20px)", display: "grid", gap: 13, position: "relative", zIndex: 2 },
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 22, padding: 16, boxShadow: "0 10px 28px rgba(15,23,42,.08)" },
  cardLarge: { background: "white", border: "1px solid #e5e7eb", borderRadius: 22, padding: 16, boxShadow: "0 10px 28px rgba(15,23,42,.08)" },
  cardSmall: { background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: 14, boxShadow: "0 8px 22px rgba(15,23,42,.07)", minHeight: 190 },
  twoCols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  matchCard: { background: "white", border: "1px solid #e5e7eb", borderRadius: 22, padding: 16, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, boxShadow: "0 12px 30px rgba(15,23,42,.10)" },
  matchIcon: { width: 48, height: 48, borderRadius: "50%", display: "grid", placeItems: "center", background: "#eaf7ee", color: "#15803d", fontSize: 22, fontWeight: 1000 },
  label: { color: "#64748b", fontSize: 11, fontWeight: 1000, textTransform: "uppercase", letterSpacing: ".02em" },
  matchday: { fontSize: 34, fontWeight: 1000, color: "#0f172a", letterSpacing: "-.04em" },
  status: { borderRadius: 999, padding: "7px 14px", fontWeight: 1000, minHeight: 30, display: "inline-flex", alignItems: "center" },
  primaryBtn: { width: "100%", border: 0, color: "white", borderRadius: 12, padding: 13, fontWeight: 1000, cursor: "pointer", flexBasis: "100%", boxShadow: "0 8px 18px rgba(22,163,74,.18)" },
  muted: { color: "#6b7280", fontWeight: 700, fontSize: 13, marginTop: 10 },
  secHeaderRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 },
  secHeaderRowCompact: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 },
  secHead: { fontSize: 16, fontWeight: 1000, color: "#0f172a", letterSpacing: "-.02em" },
  textLink: { border: 0, background: "transparent", color: "#15803d", fontWeight: 1000, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" },
  textLinkSmall: { border: 0, background: "transparent", color: "#15803d", fontWeight: 1000, fontSize: 11.5, cursor: "pointer", whiteSpace: "nowrap" },
  srow: { display: "grid", gridTemplateColumns: "26px 30px 1fr auto", gap: 10, alignItems: "center", padding: "10px 8px", borderRadius: 13, marginBottom: 7 },
  srank: { fontWeight: 1000, color: "#64748b", fontSize: 14, textAlign: "center" },
  sname: { fontWeight: 1000, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  spts: { fontWeight: 1000, color: "#0f172a", fontSize: 13.5 },
  miniPitch: { position: "relative", overflow: "hidden", background: "linear-gradient(180deg,#6fba63,#56a84b)", borderRadius: 15, padding: "15px 8px", display: "flex", flexDirection: "column", gap: 12, border: "3px solid rgba(255,255,255,.70)", minHeight: 146 },
  miniPitchMidline: { position: "absolute", left: 0, right: 0, top: "50%", height: 2, background: "rgba(255,255,255,.35)" },
  miniPitchCircle: { position: "absolute", left: "50%", top: "50%", width: 54, height: 54, marginLeft: -27, marginTop: -27, border: "2px solid rgba(255,255,255,.35)", borderRadius: "50%" },
  miniPitchRow: { position: "relative", zIndex: 1, display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" },
  miniPlayer: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3, width: 48, color: "white", fontSize: 9.5, fontWeight: 900, textAlign: "center", textShadow: "0 1px 2px rgba(0,0,0,.28)" },
  modulePill: { fontSize: 12, fontWeight: 1000, color: "#15803d", background: "#dcfce7", padding: "5px 10px", borderRadius: 999 },
  emptyBox: { border: "1px dashed #cbd5e1", color: "#64748b", borderRadius: 14, padding: 14, fontSize: 12.5, fontWeight: 800, textAlign: "center" },
  roleTabs: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 9 },
  roleTab: { border: 0, borderRadius: 999, padding: "7px 0", fontWeight: 1000, cursor: "pointer" },
  topList: { display: "grid", gap: 4 },
  topRowCompact: { display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid #f1f5f9" },
  topRank: { width: 16, textAlign: "center", fontWeight: 1000, color: "#94a3b8", fontSize: 12 },
  topName: { fontWeight: 1000, color: "#0f172a", fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  topSub: { fontSize: 10.5, color: "#64748b", fontWeight: 750, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  ppPts: { fontSize: 11, fontWeight: 1000, borderRadius: 8, padding: "2px 8px" },
  ppUp: { background: "#dcfce7", color: "#15803d" },
  ppDown: { background: "#fee2e2", color: "#dc2626" },
  ppFlat: { background: "#f1f5f9", color: "#475569" },
  ruleLink: { background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: "14px 16px", boxShadow: "0 6px 18px rgba(15,23,42,.06)", display: "flex", alignItems: "center", gap: 12, fontWeight: 1000, color: "#0f172a", cursor: "pointer", width: "100%" },
  ruleIcon: { width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center", background: "#f0fdf4", color: "#15803d" },
  recapCard: { background: "white", border: "1px solid #e5e7eb", borderTop: "3px solid #ea580c", borderRadius: 18, padding: 15, boxShadow: "0 4px 16px rgba(0,0,0,.06)" },
  recapRow: { display: "flex", gap: 13, alignItems: "center" },
  recapMascot: { width: 78, height: 78, borderRadius: 16, objectFit: "cover", flexShrink: 0, border: "2px solid #fff", boxShadow: "0 4px 12px rgba(0,0,0,.12)" },
  recapLabel: { fontSize: 10.5, fontWeight: 1000, color: "#ea580c", textTransform: "uppercase", letterSpacing: ".05em" },
  recapText: { fontSize: 13.5, fontWeight: 600, color: "#334155", lineHeight: 1.5, margin: "4px 0 0" },
  recapBtn: { width: "100%", marginTop: 13, background: "#15803d", color: "white", border: 0, borderRadius: 12, padding: 12, fontWeight: 1000, fontSize: 14, cursor: "pointer" },
  adminCard: { background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: 16, boxShadow: "0 8px 22px rgba(15,23,42,.07)", display: "flex", alignItems: "center", gap: 12 },
  adminIcon: { width: 48, height: 48, borderRadius: "50%", display: "grid", placeItems: "center", background: "#f1f5f9", fontSize: 24, flexShrink: 0 },
  adminTitle: { margin: 0, color: "#0f172a", fontSize: 18, fontWeight: 1000 },
  adminText: { margin: "4px 0 0", color: "#64748b", fontSize: 13, fontWeight: 750, lineHeight: 1.35 },
  adminBtn: { border: "1px solid #16a34a", color: "#15803d", background: "white", borderRadius: 14, padding: "11px 16px", fontWeight: 1000, cursor: "pointer", flexShrink: 0 },
  error: { padding: 12, borderRadius: 12, background: "#fff1f2", color: "#991b1b", fontWeight: 800 },
};
