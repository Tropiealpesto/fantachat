"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "./components/AppBar";
import BottomNav from "./components/BottomNav";
import SeasonBarChart from "./components/SeasonBarChart";
import { useApp } from "./components/AppContext";
import LoadingScreen from "./components/LoadingScreen";

// ─── TIPI ─────────────────────────────────────────────────────────────────────

type HistoryItem = {
  matchday_number: number;
  score: number;
};

type SeasonStats = {
  rank: number;
  total: number;
  avg: number;
  history: HistoryItem[];
};

type CurrentLineup = {
  gk_name: string | null;
  def_name: string | null;
  mid_name: string | null;
  fwd_name: string | null;
  gk_points: number | null;
  def_points: number | null;
  mid_points: number | null;
  fwd_points: number | null;
  total_points: number;
};

type NyxContent = {
  id: string;
  text: string | null;
  audio_url: string | null;
  matchday_number: number;
  title?: string;
};

type CurrentMatchday = {
  id: string;
  number: number;
  status: string;
  slot_start: string | null;
  slot_end: string | null;
};

export type CompetitionTheme = {
  slug: string;
  // Hero
  heroGrad: string;
  heroOverlayImg: string;
  heroOverlaySize: string;
  heroChampLogo: boolean;      // logo UCL nell'hero
  heroChampChartLogo: boolean; // logo UCL nel chart
  heroWorldCircles: boolean;   // cerchi colorati mondiali
  // Brand
  primary: string;
  primaryDark: string;
  logoFanta: string;
  logoChat: string;
  // Pill status
  pillBg: string;
  pillBorder: string;
  pillColor: string;
  pillDot: string;
  // Nyx card
  nyxBg: string;
  nyxBtn: string;
  nyxBadgeBg: string;
  nyxBadgeBorder: string;
  nyxBadgeColor: string;
  // Totale row
  totalColor: string;
  totalBg: string;
  // Nav attivo
  navColor: string;
  // Subtitle appbar
  competitionLabel: string;
  // Quick links colori
  qlRosaBg: string;   qlRosaColor: string;
  qlLiveBg: string;   qlLiveColor: string;
  qlClassBg: string;  qlClassColor: string;
  qlStorBg: string;   qlStorColor: string;
};

// ─── TEMI COMPETIZIONE ────────────────────────────────────────────────────────

export const THEMES: Record<string, CompetitionTheme> = {

  "serie-a": {
    slug: "serie-a",
    heroGrad: "linear-gradient(160deg,#14532d,#16a34a)",
    heroOverlayImg: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
    heroOverlaySize: "20px 20px",
    heroChampLogo: false,
    heroChampChartLogo: false,
    heroWorldCircles: false,
    primary: "#16a34a",
    primaryDark: "#15803d",
    logoFanta: "#16a34a",
    logoChat: "#f97316",
    pillBg: "rgba(22,163,74,0.10)",
    pillBorder: "rgba(22,163,74,0.30)",
    pillColor: "#15803d",
    pillDot: "#16a34a",
    nyxBg: "radial-gradient(ellipse at 85% 15%, rgba(234,88,12,0.35) 0%, transparent 55%), radial-gradient(ellipse at 10% 85%, rgba(21,128,61,0.2) 0%, transparent 50%)",
    nyxBtn: "#ea580c",
    nyxBadgeBg: "rgba(234,88,12,0.22)",
    nyxBadgeBorder: "rgba(234,88,12,0.4)",
    nyxBadgeColor: "#fb923c",
    totalColor: "#15803d",
    totalBg: "rgba(22,163,74,0.08)",
    navColor: "#16a34a",
    competitionLabel: "Serie A 25/26",
    qlRosaBg: "#dcfce7",  qlRosaColor: "#15803d",
    qlLiveBg: "#fff7ed",  qlLiveColor: "#ea580c",
    qlClassBg: "#dcfce7", qlClassColor: "#15803d",
    qlStorBg: "#eff6ff",  qlStorColor: "#1d4ed8",
  },

  "champions-league": {
    slug: "champions-league",
    heroGrad: "linear-gradient(160deg,#050d1a,#0a1f4e,#1a4fd6)",
    heroOverlayImg: "radial-gradient(circle, rgba(250,204,21,0.07) 1px, transparent 1px)",
    heroOverlaySize: "18px 18px",
    heroChampLogo: true,
    heroChampChartLogo: true,
    heroWorldCircles: false,
    primary: "#1a4fd6",
    primaryDark: "#0a1f4e",
    logoFanta: "#1a4fd6",
    logoChat: "#facc15",
    pillBg: "rgba(26,79,214,0.12)",
    pillBorder: "rgba(26,79,214,0.35)",
    pillColor: "#1e3a8a",
    pillDot: "#1a4fd6",
    nyxBg: "radial-gradient(ellipse at 85% 15%, rgba(250,204,21,0.28) 0%, transparent 55%), radial-gradient(ellipse at 10% 85%, rgba(26,79,214,0.35) 0%, transparent 50%)",
    nyxBtn: "#1a4fd6",
    nyxBadgeBg: "rgba(250,204,21,0.18)",
    nyxBadgeBorder: "rgba(250,204,21,0.5)",
    nyxBadgeColor: "#facc15",
    totalColor: "#1a4fd6",
    totalBg: "rgba(26,79,214,0.08)",
    navColor: "#1a4fd6",
    competitionLabel: "Champions 25/26",
    qlRosaBg: "#eff6ff",  qlRosaColor: "#1a4fd6",
    qlLiveBg: "#fefce8",  qlLiveColor: "#ca8a04",
    qlClassBg: "#eff6ff", qlClassColor: "#1a4fd6",
    qlStorBg: "#f0f9ff",  qlStorColor: "#0284c7",
  },

  "mondiale-2026": {
    slug: "mondiale-2026",
    heroGrad: "linear-gradient(135deg,#dc2626 0%,#2563eb 30%,#facc15 60%,#16a34a 80%,#ea580c 100%)",
    heroOverlayImg: "none",
    heroOverlaySize: "0",
    heroChampLogo: false,
    heroChampChartLogo: false,
    heroWorldCircles: true,
    primary: "#dc2626",
    primaryDark: "#991b1b",
    logoFanta: "#dc2626",
    logoChat: "#2563eb",
    pillBg: "rgba(220,38,38,0.10)",
    pillBorder: "rgba(220,38,38,0.35)",
    pillColor: "#991b1b",
    pillDot: "#dc2626",
    nyxBg: "radial-gradient(ellipse at 80% 10%, rgba(234,88,12,0.35) 0%, transparent 50%), radial-gradient(ellipse at 20% 90%, rgba(37,99,235,0.35) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(220,38,38,0.15) 0%, transparent 60%)",
    nyxBtn: "linear-gradient(135deg,#dc2626,#ea580c)",
    nyxBadgeBg: "rgba(250,204,21,0.20)",
    nyxBadgeBorder: "rgba(250,204,21,0.50)",
    nyxBadgeColor: "#ca8a04",
    totalColor: "#dc2626",
    totalBg: "rgba(220,38,38,0.07)",
    navColor: "#dc2626",
    competitionLabel: "Mondiale 2026",
    qlRosaBg: "#fee2e2",  qlRosaColor: "#dc2626",
    qlLiveBg: "#dbeafe",  qlLiveColor: "#2563eb",
    qlClassBg: "#fef9c3", qlClassColor: "#ca8a04",
    qlStorBg: "#dcfce7",  qlStorColor: "#16a34a",
  },
};

export const DEFAULT_THEME = THEMES["serie-a"];

// ─── COMPONENTE PRINCIPALE ────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamId, teamName, role, openDrawer, competitionSlug } = useApp();

  const [loading, setLoading] = useState(true);
  const [matchday, setMatchday] = useState<CurrentMatchday | null>(null);
  const [lineup, setLineup] = useState<CurrentLineup | null>(null);
  const [stats, setStats] = useState<SeasonStats | null>(null);
  const [nyx, setNyx] = useState<NyxContent | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const theme: CompetitionTheme = THEMES[competitionSlug ?? ""] ?? DEFAULT_THEME;

  useEffect(() => {
    if (!ready) return;
    if (!userId) { router.replace("/login"); return; }
    if (!activeLeagueId || !teamId) { router.replace("/seleziona-lega"); return; }

    let cancelled = false;

    async function run() {
      setErr(null);
      setLoading(true);
      try {
        // 1) Season id dalla lega
        const seasonId = await getSeasonId(activeLeagueId!);

        // 2) Giornata aperta
        const { data: md } = await supabase
          .from("matchdays")
          .select("id, number, status, slot_start, slot_end")
          .eq("season_id", seasonId)
          .eq("status", "open")
          .order("number", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled) return;
        setMatchday(md ?? null);

        // 3) Rosa corrente
        if (md?.id) {
          const lu = await fetchCurrentLineup(activeLeagueId!, userId!, md.id);
          if (!cancelled) setLineup(lu);
        }

        // 4) Statistiche stagione
        const seasonStats = await fetchSeasonStats(activeLeagueId!, userId!);
        if (!cancelled) setStats(seasonStats);

        // 5) Nyx — ultimo contenuto
        const { data: nyxData } = await supabase
          .from("nyx_content")
          .select("id, text, audio_url, matchday_id, matchdays!inner(number)")
          .eq("league_id", activeLeagueId!)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!cancelled && nyxData) {
          setNyx({
            id: (nyxData as any).id,
            text: (nyxData as any).text,
            audio_url: (nyxData as any).audio_url,
            matchday_number: (nyxData as any).matchdays?.number ?? 0,
          });
        }

        if (!cancelled) setLoading(false);
      } catch (e: any) {
        if (!cancelled) { setErr(e?.message || String(e)); setLoading(false); }
      }
    }

    run();
    return () => { cancelled = true; };
  }, [ready, userId, activeLeagueId, teamId, router]);

  if (!ready || loading) return <LoadingScreen />;

  const hasLineup = !!lineup?.gk_name;

  return (
    <>
      <AppBar
        league={leagueName}
        team={teamName}
        onMenuOpen={openDrawer}
        right={
          <button style={s.legheBtn} onClick={() => router.push("/seleziona-lega")}>
            Leghe
          </button>
        }
      />

      {/* ── HERO ── */}
      <div style={{ ...s.hero, background: theme.heroGrad }}>
        {/* overlay puntini */}
        {theme.heroOverlayImg !== "none" && (
          <div style={{
            ...s.heroOverlay,
            backgroundImage: theme.heroOverlayImg,
            backgroundSize: theme.heroOverlaySize,
          }} />
        )}

        {/* logo Champions nell'hero */}
        {theme.heroChampLogo && (
          <div style={s.champLogoHero}>
            <ChampionsLogo size={160} opacity={0.08} />
          </div>
        )}

        {/* cerchi colorati Mondiale */}
        {theme.heroWorldCircles && <WorldCircles />}

        <div style={s.heroBody}>
          <div style={s.heroGreeting}>Ciao, benvenuto 👋</div>
          <div style={s.heroTeam}>{teamName}</div>

          {/* KPI */}
          <div style={s.kpiRow}>
            <KpiCard label="Posizione" value={stats?.rank ? `${stats.rank}` : "—"} highlight />
            <KpiCard label="Totale" value={stats ? fmt(stats.total) : "—"} />
            <KpiCard label="Media" value={stats ? fmt(stats.avg) : "—"} />
          </div>

          {/* Chart */}
          <div style={s.chartCard}>
            {/* logo Champions nel chart */}
            {theme.heroChampChartLogo && (
              <div style={s.champLogoChart}>
                <ChampionsLogo size={90} opacity={0.07} />
              </div>
            )}
            <div style={s.chartHeader}>
              <span style={s.chartTitle}>Andamento stagione</span>
              <div style={s.legend}>
                <span style={s.legendItem}><span style={{ ...s.legendDot, background: "#4ade80" }} />Pos</span>
                <span style={s.legendItem}><span style={{ ...s.legendDot, background: "#fb923c" }} />Neg</span>
              </div>
            </div>
            <SeasonBarChart history={stats?.history ?? []} totalMatchdays={38} />
          </div>
        </div>
      </div>

      {/* ── MAIN ── */}
      <main style={s.container}>
        {err && <div style={s.errorCard}>Errore: {err}</div>}

        {/* NYX */}
        {nyx && (
          <div style={s.nyxCard}>
            <div style={{ ...s.nyxBg, background: theme.nyxBg }} />
            <div style={s.nyxInner}>
              <div style={s.nyxHeaderRow}>
                <div style={{
                  ...s.nyxBadge,
                  background: theme.nyxBadgeBg,
                  border: `1px solid ${theme.nyxBadgeBorder}`,
                  color: theme.nyxBadgeColor,
                }}>
                  🎙 Podcast · Nyx
                </div>
                <div style={s.nyxEp}>Giornata {nyx.matchday_number}</div>
              </div>
              <div style={s.nyxContentRow}>
                <img src="/nyx-v2.png" alt="Nyx" style={s.nyxAvatar} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s.nyxTitle}>
                    {nyx.title ?? `Nyx si sbilancia sulla giornata ${nyx.matchday_number}`}
                  </div>
                  <div style={s.nyxText}>
                    {nyx.text ? nyx.text.slice(0, 140) + "..." : ""}
                  </div>
                </div>
              </div>
              {nyx.audio_url && (
                <audio controls src={nyx.audio_url} style={s.audio} />
              )}
              <button
                style={{ ...s.nyxBtn, background: theme.nyxBtn }}
                onClick={() => router.push("/podcast")}
              >
                <span style={s.playIcon}>▶</span>
                Leggi la puntata intera
              </button>
            </div>
          </div>
        )}

        {/* GIORNATA */}
        <div style={{ ...s.giornataCard, borderLeft: `4px solid ${theme.primary}` }}>
          <div style={s.giornataTop}>
            <div>
              <div style={s.sectionLabel}>Giornata corrente</div>
              <div style={s.giornataNum}>
                {matchday?.number ?? "—"}
                <span style={s.giornataTotal}> / 38</span>
              </div>
            </div>
            <div style={{
              ...s.pill,
              background: matchday ? theme.pillBg : "#f3f4f6",
              border: `1px solid ${matchday ? theme.pillBorder : "#e5e7eb"}`,
              color: matchday ? theme.pillColor : "#6b7280",
            }}>
              <span style={{ ...s.pillDot, background: matchday ? theme.pillDot : "#9ca3af" }} />
              {matchday ? "OPEN" : "LOCKED"}
            </div>
          </div>

          {matchday?.slot_start && matchday?.slot_end && (
            <div style={s.slotBadge}>
              🕐 Slot: {formatSlot(matchday.slot_start, matchday.slot_end)}
            </div>
          )}

          <button
            style={{
              ...s.inviaBtn,
              background: matchday
                ? `linear-gradient(135deg,${theme.primary},${theme.primaryDark})`
                : "#e5e7eb",
              color: matchday ? "white" : "#9ca3af",
              opacity: matchday ? 1 : 0.7,
              cursor: matchday ? "pointer" : "not-allowed",
              boxShadow: matchday ? `0 4px 14px ${theme.primary}55` : "none",
            }}
            onClick={() => router.push("/rosa")}
            disabled={!matchday}
          >
            {hasLineup ? "Vedi Rosa ✓" : "Invia Rosa"}
          </button>

          {!hasLineup && matchday && (
            <div style={s.noRosa}>⚠️ Rosa non inviata per questa giornata.</div>
          )}

          {hasLineup && lineup && (
            <div style={s.lineupBody}>
              <LineupRow role="P" name={lineup.gk_name}  points={lineup.gk_points} />
              <LineupRow role="D" name={lineup.def_name} points={lineup.def_points} />
              <LineupRow role="C" name={lineup.mid_name} points={lineup.mid_points} />
              <LineupRow role="A" name={lineup.fwd_name} points={lineup.fwd_points} />
              <div style={{
                ...s.totalRow,
                background: theme.totalBg,
              }}>
                <span style={s.totalLabel}>Totale giornata</span>
                <span style={{ ...s.totalVal, color: theme.totalColor }}>
                  {fmt(lineup.total_points)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* QUICK LINKS */}
        <div style={s.quickGrid}>
          <QuickCard href="/rosa"       icon="👥" title="Rosa"       sub="Scegli i 4 giocatori"      bg={theme.qlRosaBg}  color={theme.qlRosaColor} />
          <QuickCard href="/live"       icon="⚡" title="Live"       sub="Campionato in diretta"      bg={theme.qlLiveBg}  color={theme.qlLiveColor} />
          <QuickCard href="/classifica" icon="🏆" title="Classifica" sub="Ranking campionato"         bg={theme.qlClassBg} color={theme.qlClassColor} />
          <QuickCard href="/storico"    icon="🗓️" title="Storico"    sub="Rivedi le giornate passate" bg={theme.qlStorBg}  color={theme.qlStorColor} />
        </div>

        {/* ADMIN */}
        {role === "admin" && <AdminCard theme={theme} />}
      </main>

      <BottomNav />
    </>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function ChampionsLogo({ size, opacity }: { size: number; opacity: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ opacity }}>
      <polygon
        points="50,2 56,38 88,20 68,48 98,50 68,52 88,80 56,62 50,98 44,62 12,80 32,52 2,50 32,48 12,20 44,38"
        fill="white"
      />
      <circle cx="50" cy="50" r="18" fill="none" stroke="white" strokeWidth="3" />
      <text x="50" y="55" textAnchor="middle" fill="white" fontSize="10" fontFamily="sans-serif" fontWeight="bold">UCL</text>
    </svg>
  );
}

function WorldCircles() {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 80, height: 80, borderRadius: "50%", background: "#dc2626", opacity: 0.25, top: -20, left: -20 }} />
      <div style={{ position: "absolute", width: 60, height: 60, borderRadius: "50%", background: "#2563eb", opacity: 0.25, top: 10, left: 60 }} />
      <div style={{ position: "absolute", width: 70, height: 70, borderRadius: "50%", background: "#facc15", opacity: 0.25, top: -15, right: 20 }} />
      <div style={{ position: "absolute", width: 50, height: 50, borderRadius: "50%", background: "#16a34a", opacity: 0.25, bottom: 10, left: 20 }} />
      <div style={{ position: "absolute", width: 65, height: 65, borderRadius: "50%", background: "#ea580c", opacity: 0.25, bottom: -10, right: 30 }} />
    </div>
  );
}

function KpiCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={s.kpiCard}>
      <div style={s.kpiLabel}>{label}</div>
      <div style={{ ...s.kpiValue, color: highlight ? "#fbbf24" : "#fff" }}>{value}</div>
    </div>
  );
}

function LineupRow({ role, name, points }: { role: string; name: string | null; points: number | null }) {
  const hasPoints = typeof points === "number" && Number.isFinite(points);
  const color = hasPoints
    ? (points! > 0 ? "#15803d" : points! < 0 ? "#c2410c" : "#6b7280")
    : "#6b7280";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontWeight: 600, fontSize: 14 }}>
      <span style={{ width: 22, color: "#9ca3af", fontWeight: 700 }}>{role}</span>
      <span style={{ flex: 1, color: "#111827" }}>{name ?? "—"}</span>
      <span style={{ color, fontWeight: 700 }}>{hasPoints ? fmt(points as number) : "—"}</span>
    </div>
  );
}

function QuickCard({ href, icon, title, sub, bg, color }: {
  href: string; icon: string; title: string; sub: string; bg: string; color: string;
}) {
  return (
    <a href={href} style={s.quickCard}>
      <div style={{ ...s.quickIcon, background: bg, color }}>{icon}</div>
      <div style={s.quickTitle}>{title}</div>
      <div style={s.quickSub}>{sub}</div>
    </a>
  );
}

function AdminCard({ theme }: { theme: CompetitionTheme }) {
  return (
    <div style={{ ...s.adminCard, borderLeft: `4px solid ${theme.primary}` }}>
      <div style={s.adminTitle}>⚙️ Admin</div>
      <div style={s.adminSectionLabel}>Admin Lega</div>
      <div style={s.adminBtns}>
        <a style={s.adminBtn} href="/admin/giornata">📅 Giornata</a>
        <a style={s.adminBtn} href="/admin/regole">📋 Regole Lega</a>
        <a style={s.adminBtn} href="/admin/podcast">🎙 Podcast</a>
      </div>
    </div>
  );
}

// ─── DATA FETCHING ────────────────────────────────────────────────────────────

async function getSeasonId(leagueId: string): Promise<string> {
  const { data } = await supabase
    .from("leagues")
    .select("season_id")
    .eq("id", leagueId)
    .single();
  return data?.season_id ?? "";
}

async function fetchCurrentLineup(
  leagueId: string,
  userId: string,
  matchdayId: string
): Promise<CurrentLineup | null> {
  const { data: lineupRow } = await supabase
    .from("lineups")
    .select("id")
    .eq("league_id", leagueId)
    .eq("matchday_id", matchdayId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!lineupRow) return null;

  const { data: players } = await supabase
    .from("lineup_players")
    .select(`
      role,
      real_players!inner(name),
      scores!left(points)
    `)
    .eq("lineup_id", lineupRow.id);

  if (!players || players.length === 0) return null;

  const byRole: Record<string, { name: string; points: number | null }> = {};
  for (const p of players as any[]) {
    byRole[p.role] = {
      name: p.real_players?.name ?? "—",
      points: p.scores?.[0]?.points ?? null,
    };
  }

  const gk  = byRole["P"] ?? { name: null, points: null };
  const def = byRole["D"] ?? { name: null, points: null };
  const mid = byRole["C"] ?? { name: null, points: null };
  const fwd = byRole["A"] ?? { name: null, points: null };

  const total = [gk, def, mid, fwd].reduce((sum, p) => sum + (p.points ?? 0), 0);

  return {
    gk_name: gk.name, def_name: def.name, mid_name: mid.name, fwd_name: fwd.name,
    gk_points: gk.points, def_points: def.points, mid_points: mid.points, fwd_points: fwd.points,
    total_points: total,
  };
}

async function fetchSeasonStats(leagueId: string, userId: string): Promise<SeasonStats> {
  const { data: allStandings } = await supabase
    .from("standings")
    .select("user_id, total_points")
    .eq("league_id", leagueId)
    .order("total_points", { ascending: false });

  const rank = (allStandings ?? []).findIndex((s: any) => s.user_id === userId) + 1;
  const myStanding = (allStandings ?? []).find((s: any) => s.user_id === userId);
  const total = Number(myStanding?.total_points ?? 0);

  // Storico per giornata
  const { data: scoreRows } = await supabase
    .from("scores")
    .select(`
      points,
      lineup_players!inner(
        lineups!inner(
          matchday_id,
          matchdays!inner(number)
        )
      )
    `)
    .eq("lineup_players.lineups.league_id", leagueId)
    .eq("lineup_players.lineups.user_id", userId);

  const byMatchday: Record<number, number> = {};
  for (const row of (scoreRows ?? []) as any[]) {
    const num = row.lineup_players?.lineups?.matchdays?.number;
    if (!num) continue;
    byMatchday[num] = (byMatchday[num] ?? 0) + Number(row.points ?? 0);
  }

  const history: HistoryItem[] = Object.entries(byMatchday)
    .map(([num, score]) => ({ matchday_number: Number(num), score }))
    .sort((a, b) => a.matchday_number - b.matchday_number);

  const played = history.length;
  const avg = played > 0 ? total / played : 0;

  return { rank, total, avg, history };
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (!Number.isFinite(n)) return "—";
  return String(Math.round(n * 10) / 10).replace(".", ",");
}

function formatSlot(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const days = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${days[start.getDay()]} ${pad(start.getHours())}:${pad(start.getMinutes())}–${pad(end.getHours())}:${pad(end.getMinutes())}`;
}

// ─── STILI ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  legheBtn: {
    background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.35)",
    color: "#fff", fontSize: 13, fontWeight: 600, padding: "7px 16px",
    borderRadius: 50, cursor: "pointer",
  },
  hero: {
    padding: "16px 0 28px", position: "relative", overflow: "hidden",
  },
  heroOverlay: {
    position: "absolute", inset: 0, pointerEvents: "none",
  },
  champLogoHero: {
    position: "absolute", right: -10, top: -10, pointerEvents: "none",
  },
  champLogoChart: {
    position: "absolute", right: -8, bottom: -8, pointerEvents: "none",
  },
  heroBody: {
    padding: "16px 16px 0", position: "relative", zIndex: 2,
  },
  heroGreeting: { fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: 500, marginBottom: 4 },
  heroTeam: { fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: -0.5, marginBottom: 20 },

  kpiRow: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 },
  kpiCard: {
    background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: 12, padding: "14px 10px", textAlign: "center",
  },
  kpiLabel: { fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", color: "rgba(255,255,255,0.6)", marginBottom: 6 },
  kpiValue: { fontSize: 26, fontWeight: 800, lineHeight: 1 },

  chartCard: {
    background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 12, padding: "14px 14px 10px", position: "relative", overflow: "hidden",
  },
  chartHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, position: "relative", zIndex: 1 },
  chartTitle: { fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)", textTransform: "uppercase", letterSpacing: "0.6px" },
  legend: { display: "flex", gap: 10 },
  legendItem: { display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "rgba(255,255,255,0.55)", fontWeight: 500 },
  legendDot: { display: "inline-block", width: 7, height: 7, borderRadius: "50%" },

  container: {
    padding: "16px 16px calc(64px + env(safe-area-inset-bottom, 0px) + 20px)",
    display: "flex", flexDirection: "column", gap: 14,
    maxWidth: 420, margin: "0 auto",
  },
  errorCard: {
    padding: 14, borderRadius: 14, border: "1px solid #fecaca",
    background: "#fff1f2", color: "#991b1b", fontWeight: 700, fontSize: 14,
  },

  nyxCard: { borderRadius: 18, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.14)", position: "relative", background: "#0f172a" },
  nyxBg: { position: "absolute", inset: 0, pointerEvents: "none" },
  nyxInner: { position: "relative", zIndex: 2, padding: "20px 18px 18px" },
  nyxHeaderRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  nyxBadge: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", padding: "4px 10px", borderRadius: 50 },
  nyxEp: { fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 500 },
  nyxContentRow: { display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 16 },
  nyxAvatar: { width: 72, height: 72, borderRadius: 14, flexShrink: 0, objectFit: "cover", border: "2px solid rgba(255,255,255,0.08)" },
  nyxTitle: { fontSize: 17, fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: 8, letterSpacing: -0.3 },
  nyxText: { fontSize: 12.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 },
  audio: { width: "100%", marginTop: 12, borderRadius: 8, height: 36 },
  nyxBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%",
    border: "none", color: "white", borderRadius: 12, padding: 13,
    fontSize: 14, fontWeight: 700, cursor: "pointer",
  },
  playIcon: {
    width: 22, height: 22, background: "rgba(255,255,255,0.2)", borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, flexShrink: 0,
  },

  giornataCard: {
    background: "#fff", borderRadius: 18, padding: 18,
    boxShadow: "0 4px 16px rgba(0,0,0,0.07)", border: "1px solid #e5e7eb",
  },
  giornataTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  sectionLabel: { fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", color: "#6b7280", marginBottom: 4 },
  giornataNum: { fontSize: 32, fontWeight: 800, color: "#111827", lineHeight: 1 },
  giornataTotal: { fontSize: 20, fontWeight: 700, color: "#9ca3af" },
  pill: { display: "flex", alignItems: "center", gap: 5, borderRadius: 50, padding: "5px 12px", fontSize: 11, fontWeight: 700 },
  pillDot: { display: "inline-block", width: 7, height: 7, borderRadius: "50%" },
  slotBadge: { fontSize: 12, color: "#6b7280", fontWeight: 600, marginBottom: 12, padding: "6px 10px", background: "#f9fafb", borderRadius: 8 },
  inviaBtn: {
    width: "100%", border: "none", borderRadius: 12, padding: 14,
    fontSize: 15, fontWeight: 700, marginBottom: 14, transition: "all 0.2s",
  },
  lineupBody: { borderTop: "1px solid #e5e7eb", paddingTop: 14, display: "grid", gap: 8 },
  noRosa: { fontSize: 13, color: "#6b7280", fontWeight: 600 },
  totalRow: { marginTop: 6, padding: "12px 14px", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 13, color: "#111827", fontWeight: 700 },
  totalVal: { fontSize: 22, fontWeight: 800 },

  quickGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  quickCard: {
    background: "#fff", borderRadius: 12, padding: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #e5e7eb",
    textDecoration: "none", display: "flex", flexDirection: "column", gap: 6,
  },
  quickIcon: { width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 },
  quickTitle: { fontSize: 14, fontWeight: 700, color: "#111827" },
  quickSub: { fontSize: 11, color: "#6b7280" },

  adminCard: {
    background: "#fff", borderRadius: 18, padding: 18,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #e5e7eb",
  },
  adminTitle: { fontSize: 16, fontWeight: 800, marginBottom: 14, color: "#111827" },
  adminSectionLabel: { fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", color: "#6b7280", marginBottom: 8 },
  adminBtns: { display: "flex", flexWrap: "wrap", gap: 8 },
  adminBtn: {
    display: "inline-flex", alignItems: "center", gap: 6,
    background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 10,
    padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#111827", textDecoration: "none",
  },
};
