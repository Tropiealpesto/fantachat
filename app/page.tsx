"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "./components/AppBar";
import BottomNav from "./components/BottomNav";
import SeasonBarChart from "./components/SeasonBarChart";
import { useApp } from "./components/AppContext";

type SeasonStats = {
rank: number;
total: number;
avg: number;
best: number;
worst: number;
played: number;
history: { matchday_number: number; score: number; is_final: boolean }[];
};

type Lineup = {
gk_name: string;
gk_vote: number | null;
def_name: string;
def_vote: number | null;
mid_name: string;
mid_vote: number | null;
fwd_name: string;
fwd_vote: number | null;
total_score: number;
};

type NyxCard = {
matchday_number: number;
top_team: string;
top_score: number;
bottom_team: string;
bottom_score: number;
leader_team: string;
leader_total: number;
title: string;
message: string;
};

export default function Home() {
const router = useRouter();
const { ready, userId, activeLeagueId, leagueName, teamId, teamName, role } = useApp();

const [loading, setLoading] = useState(true);
const [matchdayId, setMatchdayId] = useState<string | null>(null);
const [matchdayNum, setMatchdayNum] = useState<number | null>(null);
const [lineup, setLineup] = useState<Lineup | null>(null);
const [stats, setStats] = useState<SeasonStats | null>(null);
const [nyxCard, setNyxCard] = useState<NyxCard | null>(null);
const [mySlot, setMySlot] = useState<{ slot_start_at: string; slot_end_at: string } | null>(null);
const [isSuperAdmin, setIsSuperAdmin] = useState(false);
const [err, setErr] = useState<string | null>(null);

useEffect(() => {
if (!ready) return;
if (!userId) { router.replace("/login"); return; }
if (!activeLeagueId || !teamId) { router.replace("/seleziona-lega"); return; }

```
let cancelled = false;

async function run() {
  setErr(null);
  setLoading(true);
  try {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const email = (auth.user?.email || "").toLowerCase();
      if (email) {
        const { data: adminRow } = await supabase
          .from("app_admins").select("email").eq("email", email).maybeSingle();
        if (!cancelled) setIsSuperAdmin(!!adminRow);
      } else {
        if (!cancelled) setIsSuperAdmin(false);
      }
    } catch { if (!cancelled) setIsSuperAdmin(false); }

    const { data: md } = await supabase
      .from("matchdays").select("id, number")
      .eq("league_id", activeLeagueId).eq("status", "open")
      .order("number", { ascending: false }).limit(1).maybeSingle();

    if (cancelled) return;

    if (!md?.id) {
      setMatchdayId(null); setMatchdayNum(null); setLineup(null); setMySlot(null);
    } else {
      setMatchdayId(md.id); setMatchdayNum(md.number);
      const { data: lu } = await supabase.rpc("get_my_matchday_lineup", { p_matchday_id: md.id });
      if (cancelled) return;
      setLineup(Array.isArray(lu) && lu.length ? (lu[0] as any) : null);
      const { data: mySlotData } = await supabase
        .from("pick_schedule").select("slot_start_at, slot_end_at")
        .eq("league_id", activeLeagueId).eq("matchday_id", md.id).eq("team_id", teamId).maybeSingle();
      if (cancelled) return;
      setMySlot(mySlotData ?? null);
    }

    const { data: s, error: sErr } = await supabase.rpc("get_my_season_stats");
    if (sErr) setErr(sErr.message);
    if (cancelled) return;
    setStats({
      rank: Number(s?.rank ?? 0), total: Number(s?.total ?? 0),
      avg: Number(s?.avg ?? 0), best: Number(s?.best ?? 0),
      worst: Number(s?.worst ?? 0), played: Number(s?.played ?? 0),
      history: Array.isArray(s?.history)
        ? s.history.map((x: any) => ({
            matchday_number: Number(x.matchday_number),
            score: Number(x.score), is_final: Boolean(x.is_final),
          }))
        : [],
    });

    const { data: nyxData } = await supabase.rpc("get_home_nyx_message");
    if (!cancelled) {
      const row = Array.isArray(nyxData) ? nyxData[0] : nyxData;
      setNyxCard(row || null);
    }

    setLoading(false);
  } catch (e: any) {
    setErr(e?.message || String(e));
    setLoading(false);
  }
}

run();
return () => { cancelled = true; };
```

}, [ready, userId, activeLeagueId, teamId, router]);

if (!ready || !userId || !activeLeagueId || !teamId || loading) {
return (
<main style={styles.loadingWrap}>
<div style={styles.loadingDot} />
</main>
);
}

const ctaLabel = lineup ? "Vedi Rosa ✓" : "Invia Rosa";

return (
<>
<AppBar
league={leagueName}
team={teamName}
right={
<button style={styles.legheBtn} onClick={() => router.push("/seleziona-lega")}>
Leghe
</button>
}
/>

```
  {/* ── HERO VERDE ── */}
  <div style={styles.hero}>
    <div style={styles.heroDots} />
    <div style={styles.heroGlow} />

    <div style={styles.heroBody}>
      <div style={styles.heroGreeting}>Ciao, benvenuto 👋</div>
      <div style={styles.heroTeam}>{teamName}</div>

      {/* KPI */}
      <div style={styles.kpiRow}>
        <div style={styles.kpiCard}>
          <div style={styles.kpiLabel}>Posizione</div>
          <div style={{ ...styles.kpiValue, color: "#fbbf24" }}>
            {stats ? `#${stats.rank || "—"}` : "—"}
          </div>
        </div>
        <div style={styles.kpiCard}>
          <div style={styles.kpiLabel}>Totale</div>
          <div style={styles.kpiValue}>{stats ? fmt(stats.total) : "—"}</div>
        </div>
        <div style={styles.kpiCard}>
          <div style={styles.kpiLabel}>Media</div>
          <div style={styles.kpiValue}>{stats ? fmt(stats.avg) : "—"}</div>
        </div>
      </div>

      {/* CHART */}
      <div style={styles.heroChart}>
        <div style={styles.heroChartHeader}>
          <span style={styles.heroChartTitle}>Andamento stagione</span>
          <div style={styles.legend}>
            <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: "#4ade80" }} />Pos</span>
            <span style={styles.legendItem}><span style={{ ...styles.legendDot, background: "#fb923c" }} />Neg</span>
          </div>
        </div>
        <SeasonBarChart history={stats?.history || []} totalMatchdays={38} />
      </div>
    </div>
  </div>

  <main style={styles.container}>
    {err && (
      <div style={styles.errorCard}>Errore: {err}</div>
    )}

    {/* ── NYX PODCAST ── */}
    {nyxCard && (
      <div style={styles.nyxCard}>
        <div style={styles.nyxBg} />
        <div style={styles.nyxWave}>
          {[60,30,80,45,100,55,70,35,90,50,65,40,75,25,85,55,95,45,70,30,80,60,40,100,50,75,35,90,55,65].map((h, i) => (
            <div key={i} style={{ ...styles.nyxWaveBar, height: `${h}%` }} />
          ))}
        </div>
        <div style={styles.nyxInner}>
          <div style={styles.nyxHeaderRow}>
            <div style={styles.nyxBadge}>🎙 Podcast · Nyx</div>
            <div style={styles.nyxEp}>Giornata {nyxCard.matchday_number}</div>
          </div>
          <div style={styles.nyxContentRow}>
            <img src="/nyx-v2.png" alt="Nyx" style={styles.nyxAvatar} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.nyxTitle}>{nyxCard.title}</div>
              <div style={styles.nyxText}>{nyxCard.message}</div>
            </div>
          </div>
          {/* highlights */}
          <div style={styles.nyxChips}>
            <div style={styles.nyxChip}>
              <span style={{ ...styles.chipDot, background: "#4ade80" }} />
              {nyxCard.top_team} +{fmt(nyxCard.top_score)}
            </div>
            <div style={styles.nyxChip}>
              <span style={{ ...styles.chipDot, background: "#fb923c" }} />
              {nyxCard.bottom_team} {fmt(nyxCard.bottom_score)}
            </div>
            <div style={styles.nyxChip}>🏆 {nyxCard.leader_team} {fmt(nyxCard.leader_total)}</div>
          </div>
          <button style={styles.podcastBtn} onClick={() => router.push("/podcast")}>
            <span style={styles.playIcon}>▶</span>
            Ascolta la puntata intera
          </button>
        </div>
      </div>
    )}

    {/* ── GIORNATA ── */}
    <div style={styles.giornataCard}>
      <div style={styles.giornataTop}>
        <div>
          <div style={styles.sectionLabel}>Giornata corrente</div>
          <div style={styles.giornataNum}>
            {matchdayNum ? `${matchdayNum}` : "—"}
            <span style={styles.giornataTotal}> / 38</span>
          </div>
        </div>
        <div style={matchdayId ? styles.pillOpen : styles.pillLocked}>
          <span style={matchdayId ? styles.dotOpen : styles.dotLocked} />
          {matchdayId ? "OPEN" : "LOCKED"}
        </div>
      </div>

      {mySlot && (
        <div style={styles.slotBadge}>
          🕐 Slot: {formatSlot(mySlot.slot_start_at, mySlot.slot_end_at)}
        </div>
      )}

      <button
        style={{ ...styles.inviaBtn, opacity: matchdayId ? 1 : 0.5 }}
        onClick={() => router.push("/rosa")}
        disabled={!matchdayId}
      >
        {ctaLabel}
      </button>

      <div style={styles.giornataBody}>
        {lineup ? (
          <>
            <div style={{ display: "grid", gap: 8 }}>
              <LineupRow role="P" name={lineup.gk_name} vote={lineup.gk_vote} />
              <LineupRow role="D" name={lineup.def_name} vote={lineup.def_vote} />
              <LineupRow role="C" name={lineup.mid_name} vote={lineup.mid_vote} />
              <LineupRow role="A" name={lineup.fwd_name} vote={lineup.fwd_vote} />
            </div>
            {(() => {
              const total = Number(lineup.total_score || 0);
              const bg = total > 0 ? "rgba(34,197,94,.12)" : total < 0 ? "rgba(249,115,22,.12)" : "#f1f5f9";
              const color = total > 0 ? "#15803d" : total < 0 ? "#c2410c" : "#6b7280";
              return (
                <div style={{ ...styles.totalRow, background: bg }}>
                  <span style={{ color: "#111827", fontWeight: 700 }}>Totale giornata</span>
                  <span style={{ fontSize: 22, fontWeight: 800, color }}>{fmt(total)}</span>
                </div>
              );
            })()}
          </>
        ) : (
          <div style={styles.noRosa}>⚠️ Rosa non inviata per questa giornata.</div>
        )}
      </div>
    </div>

    {/* ── QUICK LINKS ── */}
    <div style={styles.quickGrid}>
      <a href="/rosa" style={styles.quickCard}>
        <div style={{ ...styles.quickIcon, background: "#dcfce7" }}>👥</div>
        <div style={styles.quickTitle}>Rosa</div>
        <div style={styles.quickSub}>Scegli i 4 giocatori</div>
      </a>
      <a href="/live" style={styles.quickCard}>
        <div style={{ ...styles.quickIcon, background: "#fff7ed" }}>⚡</div>
        <div style={styles.quickTitle}>Live</div>
        <div style={styles.quickSub}>Campionato in diretta</div>
      </a>
      <a href="/classifica" style={styles.quickCard}>
        <div style={{ ...styles.quickIcon, background: "#dcfce7" }}>🏆</div>
        <div style={styles.quickTitle}>Classifica</div>
        <div style={styles.quickSub}>Ranking campionato</div>
      </a>
    </div>

    {/* ── ADMIN ── */}
    {role === "admin" && (
      <div style={styles.adminCard}>
        <div style={styles.adminTitle}>⚙️ Admin</div>
        <div style={styles.adminSectionLabel}>Admin Lega</div>
        <div style={styles.adminBtns}>
          <a style={styles.adminBtn} href="/admin/giornata">📅 Giornata</a>
          <a style={styles.adminBtn} href="/admin/regole">📋 Regole Lega</a>
          <a style={styles.adminBtn} href="/admin/podcast">🎙 Podcast</a>
        </div>
        {isSuperAdmin && (
          <>
            <div style={{ ...styles.adminSectionLabel, marginTop: 14 }}>Super Admin</div>
            <div style={styles.adminBtns}>
              <a style={styles.adminBtn} href="/admin/partite">⚽ Partite</a>
              <a style={styles.adminBtn} href="/admin/top6">🏅 Top 6</a>
              <a style={styles.adminBtn} href="/admin/statistiche">📊 Statistiche</a>
            </div>
          </>
        )}
      </div>
    )}
  </main>

  <BottomNav />
</>
```

);
}

// ─────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────

function LineupRow({ role, name, vote }: { role: string; name: string; vote: number | null }) {
const hasVote = typeof vote === "number" && Number.isFinite(vote);
const color = hasVote ? (vote! > 0 ? "#15803d" : vote! < 0 ? "#c2410c" : "#6b7280") : "#6b7280";
return (
<div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontWeight: 600, fontSize: 14 }}>
<span style={{ width: 22, color: "#9ca3af", fontWeight: 700 }}>{role}</span>
<span style={{ flex: 1, color: "#111827" }}>{name}</span>
<span style={{ color, fontWeight: 700 }}>{hasVote ? fmt(vote as number) : "—"}</span>
</div>
);
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

function fmt(n: number) {
if (!Number.isFinite(n)) return "—";
return String(Math.round(n * 10) / 10).replace(".", ",");
}

function formatSlot(startIso: string, endIso: string) {
const start = new Date(startIso);
const end = new Date(endIso);
const dayNames = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const day = dayNames[start.getDay()];
const pad = (n: number) => String(n).padStart(2, "0");
const s = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
const endStr = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
return `${day} ${s}–${endStr}`;
}

// ─────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
/* loading */
loadingWrap: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f1f5f1" },
loadingDot:  { width: 10, height: 10, borderRadius: "50%", background: "#16a34a", animation: "pulse 1s infinite" },

/* leghe button */
legheBtn: {
background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.35)",
color: "#fff", fontSize: 13, fontWeight: 600, padding: "7px 16px",
borderRadius: 50, cursor: "pointer",
},

/* ── HERO ── */
hero: {
background: "linear-gradient(160deg, #14532d 0%, #16a34a 100%)",
padding: "0 0 28px", position: "relative", overflow: "hidden",
},
heroDots: {
position: "absolute", inset: 0,
backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
backgroundSize: "22px 22px", pointerEvents: "none",
},
heroGlow: {
position: "absolute", top: -60, right: -60, width: 220, height: 220,
background: "radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 65%)",
borderRadius: "50%", pointerEvents: "none",
},
heroBody: { padding: "16px 16px 0", position: "relative", zIndex: 2 },
heroGreeting: { fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: 500, marginBottom: 4 },
heroTeam: { fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: -0.5, marginBottom: 20 },

/* kpi */
kpiRow: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 },
kpiCard: {
background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.2)",
borderRadius: 12, padding: "14px 10px", textAlign: "center",
},
kpiLabel: { fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", color: "rgba(255,255,255,0.6)", marginBottom: 6 },
kpiValue: { fontSize: 26, fontWeight: 800, color: "#fff", lineHeight: 1 },

/* hero chart */
heroChart: {
background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.18)",
borderRadius: 12, padding: "14px 14px 10px",
},
heroChartHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
heroChartTitle: { fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)", textTransform: "uppercase", letterSpacing: "0.6px" },
legend: { display: "flex", gap: 10 },
legendItem: { display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "rgba(255,255,255,0.55)", fontWeight: 500 },
legendDot: { display: "inline-block", width: 7, height: 7, borderRadius: "50%" },

/* ── CONTAINER ── */
container: { padding: "16px 16px 20px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 420, margin: "0 auto" },

/* error */
errorCard: { padding: 14, borderRadius: 14, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 700, fontSize: 14 },

/* ── NYX CARD ── */
nyxCard: { borderRadius: 18, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.14)", position: "relative", background: "#0f172a" },
nyxBg: {
position: "absolute", inset: 0,
background: "radial-gradient(ellipse at 85% 15%, rgba(234,88,12,0.38) 0%, transparent 52%), radial-gradient(ellipse at 10% 85%, rgba(21,128,61,0.22) 0%, transparent 50%), linear-gradient(160deg,#0f172a 0%,#1a1030 100%)",
pointerEvents: "none",
},
nyxWave: {
position: "absolute", bottom: 0, left: 0, right: 0, height: 44,
display: "flex", alignItems: "flex-end", gap: 2, padding: "0 16px", opacity: 0.15, pointerEvents: "none",
},
nyxWaveBar: { flex: 1, background: "white", borderRadius: "2px 2px 0 0" },
nyxInner: { position: "relative", zIndex: 2, padding: "20px 18px 18px" },
nyxHeaderRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
nyxBadge: {
display: "inline-flex", alignItems: "center", gap: 5,
background: "rgba(234,88,12,0.22)", border: "1px solid rgba(234,88,12,0.4)",
color: "#fb923c", fontSize: 10, fontWeight: 700, textTransform: "uppercase",
letterSpacing: "0.8px", padding: "4px 10px", borderRadius: 50,
},
nyxEp: { fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 500 },
nyxContentRow: { display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 16 },
nyxAvatar: { width: 72, height: 72, borderRadius: 14, flexShrink: 0, objectFit: "cover", border: "2px solid rgba(255,255,255,0.08)" },
nyxTitle: { fontSize: 17, fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: 8, letterSpacing: -0.3 },
nyxText: { fontSize: 12.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.6, whiteSpace: "pre-line" },
nyxChips: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" },
nyxChip: {
display: "flex", alignItems: "center", gap: 5,
background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
borderRadius: 8, padding: "6px 10px", fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,0.75)",
},
chipDot: { display: "inline-block", width: 6, height: 6, borderRadius: "50%", flexShrink: 0 },
podcastBtn: {
display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%",
background: "#ea580c", border: "none", color: "white", borderRadius: 12, padding: 13,
fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(234,88,12,0.4)",
letterSpacing: 0.1,
},
playIcon: {
width: 22, height: 22, background: "rgba(255,255,255,0.2)", borderRadius: "50%",
display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, flexShrink: 0,
},

/* ── GIORNATA CARD ── */
giornataCard: {
background: "#fff", borderRadius: 18, padding: 18,
boxShadow: "0 4px 16px rgba(0,0,0,0.07)", border: "1px solid #e5e7eb", borderLeft: "4px solid #16a34a",
},
giornataTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
sectionLabel: { fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px", color: "#6b7280", marginBottom: 4 },
giornataNum: { fontSize: 32, fontWeight: 800, color: "#111827", lineHeight: 1 },
giornataTotal: { fontSize: 20, fontWeight: 700, color: "#9ca3af" },
pillOpen: { display: "flex", alignItems: "center", gap: 5, background: "#dcfce7", border: "1px solid #86efac", borderRadius: 50, padding: "5px 12px", fontSize: 11, fontWeight: 700, color: "#15803d" },
pillLocked: { display: "flex", alignItems: "center", gap: 5, background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 50, padding: "5px 12px", fontSize: 11, fontWeight: 700, color: "#6b7280" },
dotOpen: { display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#16a34a" },
dotLocked: { display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#9ca3af" },
slotBadge: { fontSize: 12, color: "#6b7280", fontWeight: 600, marginBottom: 12, padding: "6px 10px", background: "#f9fafb", borderRadius: 8 },
inviaBtn: {
width: "100%", background: "linear-gradient(135deg,#16a34a,#15803d)", color: "white",
border: "none", borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 700,
cursor: "pointer", boxShadow: "0 4px 14px rgba(22,163,74,0.35)", marginBottom: 14,
},
giornataBody: { borderTop: "1px solid #e5e7eb", paddingTop: 14 },
totalRow: { marginTop: 14, padding: "12px 14px", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center" },
noRosa: { fontSize: 13, color: "#6b7280", fontWeight: 600 },

/* ── QUICK LINKS ── */
quickGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
quickCard: {
background: "#fff", borderRadius: 12, padding: 16,
boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #e5e7eb",
textDecoration: "none", display: "flex", flexDirection: "column", gap: 6,
},
quickIcon: { width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 },
quickTitle: { fontSize: 14, fontWeight: 700, color: "#111827" },
quickSub: { fontSize: 11, color: "#6b7280" },

/* ── ADMIN CARD ── */
adminCard: {
background: "#fff", borderRadius: 18, padding: 18,
boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #e5e7eb", borderLeft: "4px solid #ea580c",
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
