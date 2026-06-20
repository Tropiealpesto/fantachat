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

function PlayerCrest({ team, colors, size = 40 }: { team: string; colors: Kit | null; size?: number }) {
  if (colors) return <TeamBadge name={team} primary={colors.primary} secondary={colors.secondary} pattern={colors.pattern} showInitials={false} size={size} />;
  return <TeamBadge name={team} showInitials={false} size={size} />;
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

  const top5 = standings.slice(0, 5);
  const meInTop = top5.some((r) => r.user_id === app.userId);
  const myRow = standings.find((r) => r.user_id === app.userId);

  function StandLine({ row, mine }: { row: StandRow; mine: boolean }) {
    const c = memberColors[row.user_id];
    return (
      <div style={{ ...s.srow, background: mine ? `${theme.primary}12` : "white", borderLeft: `3px solid ${mine ? theme.primary : "transparent"}` }}>
        <span style={s.srank}>{row.rank ?? "—"}</span>
        <TeamBadge name={row.team_name} primary={c?.primary ?? null} secondary={c?.secondary ?? null} size={30} />
        <span style={{ ...s.sname, color: mine ? theme.primary : "#0f172a" }}>{row.team_name}</span>
        <span style={s.spts}>{fmt(row.total_points)}</span>
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
        <div style={{ ...s.card, borderLeft: `4px solid ${theme.primary}` }}>
          <div style={s.cardTop}>
            <div>
              <div style={s.label}>Giornata corrente</div>
              <div style={s.matchday}>{data.matchday?.number ?? "—"}</div>
            </div>
            <span style={{ ...s.status, color: data.matchday ? theme.primary : "#6b7280", background: data.matchday ? `${theme.primary}14` : "#f3f4f6" }}>{data.matchday?.status ?? "locked"}</span>
          </div>
          <button disabled={!data.matchday} onClick={() => router.push("/rosa")} style={{ ...s.primaryBtn, background: data.matchday ? theme.primary : "#d1d5db" }}>
            {hasLineup ? "Modifica rosa" : "Invia rosa"}
          </button>
        </div>

        {/* Il tuo schieramento (campo) */}
        {hasLineup && (
          <div style={s.card}>
            <div style={s.secHead}>Il tuo schieramento</div>
            <div style={s.pitch}>
              <div style={s.pitchLine} />
              <div style={s.pitchCircle} />
              {lineupGroups.map((g) => (
                <div key={g.role} style={s.pitchRow}>
                  {g.items.map((p, i) => (
                    <div key={i} style={s.pp}>
                      <PlayerCrest team={p.team || p.name} colors={kitOf(p.team)} size={46} />
                      <div style={s.ppName}>{p.role === "P" ? (p.team || p.name) : p.name}</div>
                      <div style={{ ...s.ppPts, ...ptsStyle(p.points) }}>{signedFmt(p.points)}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div style={s.pitchTot}><span>Totale giornata</span><b>{fmt(data.lineup?.total_points)}</b></div>
          </div>
        )}

        {/* Mini-classifica */}
        <div style={s.card}>
          <div style={s.secHead}>La tua classifica</div>
          {standings.length === 0 ? (
            <div style={s.muted}>Ancora nessuna classifica.</div>
          ) : (
            <>
              {top5.map((r) => <StandLine key={r.user_id} row={r} mine={r.user_id === app.userId} />)}
              {!meInTop && myRow && (<><div style={s.dots}>· · ·</div><StandLine row={myRow} mine /></>)}
            </>
          )}
          <button onClick={() => router.push("/classifica")} style={s.linkBtn}>Classifica completa →</button>
        </div>

        {/* Top giocatori */}
        {topPlayers.length > 0 && (
          <div style={s.card}>
            <div style={s.secHead}>Top giocatori · giornata</div>
            <div style={{ marginTop: 6 }}>
              {topPlayers.map((p, i) => (
                <div key={i} style={{ ...s.topRow, borderTop: i === 0 ? "none" : "1px solid #f1f5f9" }}>
                  <span style={s.topRank}>{i + 1}</span>
                  <PlayerCrest team={p.team || p.name} colors={kitOf(p.team)} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.topName}>{p.role === "P" ? (p.team || p.name) : p.name}</div>
                    <div style={s.topSub}>{p.role} · {p.team}</div>
                  </div>
                  <div style={{ ...s.ppPts, ...ptsStyle(p.points) }}>{signedFmt(p.points)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

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

        <div style={s.grid}>
          <Quick href="/rosa" title="Rosa" sub="Scegli i giocatori" />
          <Quick href="/live" title="Live" sub="Classifica live" />
          <Quick href="/chat" title="Chat" sub="Lega unica" />
          <Quick href="/statistiche" title="Statistiche" sub="Giocatori" />
        </div>

        {app.isAdmin && (
          <div style={s.card}>
            <h3 style={{ marginTop: 0 }}>Admin competizione</h3>
            <p style={s.muted}>Le azioni admin lavorano su {app.competitionName ?? "competizione attiva"}.</p>
            <button style={{ ...s.primaryBtn, background: theme.primary }} onClick={() => router.push("/admin")}>Apri admin</button>
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
  return (<div style={s.kpi}><small>{label}</small><b>{value}</b></div>);
}
function Quick({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (<a href={href} style={s.quick}><b>{title}</b><small>{sub}</small></a>);
}

const s: Record<string, React.CSSProperties> = {
  topBtn: { border: 0, borderRadius: 999, background: "#f0fdf4", color: "#15803d", padding: "7px 14px", fontWeight: 800, cursor: "pointer" },
  hero: { color: "white", padding: "18px 16px 28px" },
  heroInner: { maxWidth: 520, margin: "0 auto" },
  heroRow: { display: "flex", alignItems: "center", gap: 14, marginTop: 16 },
  badgeRing: { borderRadius: "50%", padding: 3, border: "2px solid rgba(255,255,255,.85)", display: "grid", placeItems: "center", flexShrink: 0 },
  hello: { opacity: 0.78, fontWeight: 700 },
  team: { fontSize: 28, lineHeight: 1.1, margin: "4px 0 0" },
  closedText: { margin: "0", color: "rgba(255,255,255,0.78)", fontWeight: 750, lineHeight: 1.45 },
  closedTitle: { margin: "0 0 12px", color: "#111827", fontWeight: 1000, fontSize: 22 },
  finalTable: { display: "grid", gap: 8 },
  finalRow: { display: "grid", gridTemplateColumns: "44px 1fr 70px", gap: 8, alignItems: "center", padding: 12, borderRadius: 12, border: "1px solid #e5e7eb" },
  kpis: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 18 },
  kpi: { background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 14, padding: 12, display: "grid", gap: 4, textAlign: "center" },
  container: { maxWidth: 520, margin: "0 auto", padding: "16px 14px calc(70px + env(safe-area-inset-bottom, 0px) + 20px)", display: "grid", gap: 14 },
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: 16, boxShadow: "0 4px 16px rgba(0,0,0,.06)" },
  cardTop: { display: "flex", justifyContent: "space-between", marginBottom: 12 },
  label: { color: "#6b7280", fontSize: 11, fontWeight: 900, textTransform: "uppercase" },
  matchday: { fontSize: 34, fontWeight: 900 },
  status: { borderRadius: 999, padding: "5px 12px", fontWeight: 900, height: 30 },
  primaryBtn: { width: "100%", border: 0, color: "white", borderRadius: 12, padding: 13, fontWeight: 900, cursor: "pointer", marginTop: 10 },
  muted: { color: "#6b7280", fontWeight: 700, fontSize: 13, marginTop: 10 },
  secHead: { fontSize: 15, fontWeight: 1000, color: "#0f172a", marginBottom: 4 },
  pitch: { position: "relative", overflow: "hidden", background: "linear-gradient(180deg,#16a34a,#13853a)", borderRadius: 16, padding: "20px 10px", display: "flex", flexDirection: "column", gap: 16, marginTop: 10 },
  pitchLine: { position: "absolute", left: 0, right: 0, top: "50%", height: 2, background: "rgba(255,255,255,.25)" },
  pitchCircle: { position: "absolute", left: "50%", top: "50%", width: 84, height: 84, marginLeft: -42, marginTop: -42, border: "2px solid rgba(255,255,255,.25)", borderRadius: "50%" },
  pitchRow: { position: "relative", zIndex: 1, display: "flex", justifyContent: "center", gap: 18, flexWrap: "wrap" },
  pp: { display: "flex", flexDirection: "column", alignItems: "center", gap: 5, width: 80 },
  ppName: { color: "#fff", fontSize: 11.5, fontWeight: 900, textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 80, textShadow: "0 1px 2px rgba(0,0,0,.35)" },
  ppPts: { fontSize: 11, fontWeight: 1000, borderRadius: 8, padding: "2px 9px" },
  ppUp: { background: "#dcfce7", color: "#15803d" },
  ppDown: { background: "#fee2e2", color: "#dc2626" },
  ppFlat: { background: "#f1f5f9", color: "#475569" },
  pitchTot: { display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 14, fontWeight: 900, color: "#0f172a" },
  srow: { display: "grid", gridTemplateColumns: "26px 30px 1fr auto", gap: 10, alignItems: "center", padding: "8px 8px", borderRadius: 12, marginBottom: 6 },
  srank: { fontWeight: 1000, color: "#64748b", fontSize: 14, textAlign: "center" },
  sname: { fontWeight: 900, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  spts: { fontWeight: 1000, color: "#0f172a", fontSize: 14 },
  dots: { textAlign: "center", color: "#94a3b8", fontWeight: 1000, padding: "2px 0 6px" },
  linkBtn: { marginTop: 8, width: "100%", background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: 12, padding: 11, fontWeight: 1000, fontSize: 13, cursor: "pointer" },
  topRow: { display: "flex", alignItems: "center", gap: 10, padding: "9px 4px" },
  topRank: { width: 20, textAlign: "center", fontWeight: 1000, color: "#94a3b8", fontSize: 13 },
  topName: { fontWeight: 1000, color: "#0f172a", fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  topSub: { fontSize: 11.5, color: "#64748b", fontWeight: 700 },
  recapCard: { background: "white", border: "1px solid #e5e7eb", borderTop: "3px solid #ea580c", borderRadius: 18, padding: 15, boxShadow: "0 4px 16px rgba(0,0,0,.06)" },
  recapRow: { display: "flex", gap: 13, alignItems: "center" },
  recapMascot: { width: 78, height: 78, borderRadius: 16, objectFit: "cover", flexShrink: 0, border: "2px solid #fff", boxShadow: "0 4px 12px rgba(0,0,0,.12)" },
  recapLabel: { fontSize: 10.5, fontWeight: 1000, color: "#ea580c", textTransform: "uppercase", letterSpacing: ".05em" },
  recapText: { fontSize: 13.5, fontWeight: 600, color: "#334155", lineHeight: 1.5, margin: "4px 0 0" },
  recapBtn: { width: "100%", marginTop: 13, background: "#15803d", color: "white", border: 0, borderRadius: 12, padding: 12, fontWeight: 1000, fontSize: 14, cursor: "pointer" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  quick: { background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, display: "grid", gap: 4, boxShadow: "0 2px 10px rgba(0,0,0,.04)" },
  error: { padding: 12, borderRadius: 12, background: "#fff1f2", color: "#991b1b", fontWeight: 800 },
};