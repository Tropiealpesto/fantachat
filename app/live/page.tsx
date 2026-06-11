"use client";

import { useEffect, useState } from "react";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import LoadingScreen from "../components/LoadingScreen";
import CompetitionBadge from "../components/CompetitionBadge";
import { useRequireApp } from "../hooks/useRequireApp";
import { rpcJson, fmt, signedFmt } from "../../lib/rpc";

type LivePlayer = { role: string; name: string; team: string; points: number };
type LiveRow = { user_id: string; team_name: string; live_score: number; projected_total: number; players: LivePlayer[]; rank: number };
type LiveData = { matchday?: { id: string; number: number; status: string } | null; rows: LiveRow[] };
const empty: LiveData = { matchday: null, rows: [] };

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  P: { bg: "#fef9c3", color: "#a16207" }, D: { bg: "#dcfce7", color: "#15803d" },
  C: { bg: "#dbeafe", color: "#1d4ed8" }, A: { bg: "#fee2e2", color: "#dc2626" },
};
function hue(str: string) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360; return h; }
function shieldBg(name?: string | null) { const h = hue(name ?? "x"); return `linear-gradient(135deg,hsl(${h},55%,46%),hsl(${(h + 28) % 360},58%,30%))`; }
function initials(name?: string | null) { const n = (name ?? "?").trim(); const p = n.split(/\s+/); return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase(); }
function pLabel(p: LivePlayer) { return p.role === "P" ? (p.team || p.name) : p.name; }
function pSub(p: LivePlayer) { return p.role === "P" ? "Portiere" : p.team; }

export default function LivePage() {
  const app = useRequireApp(true);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LiveData>(empty);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!app.ready || !app.activeLeagueCompetitionId) return;
    let off = false;
    async function load() {
      try {
        const r = await rpcJson<LiveData>("get_live_data", { p_league_competition_id: app.activeLeagueCompetitionId }, empty);
        if (!off) { setData(r ?? empty); setErr(null); }
      } catch (e: any) { if (!off) setErr(e.message); }
      finally { if (!off) setLoading(false); }
    }
    load();
    const t = setInterval(load, 15000);
    return () => { off = true; clearInterval(t); };
  }, [app.ready, app.activeLeagueCompetitionId]);

  // apri di default la riga della propria squadra
  useEffect(() => {
    if (app.userId && data.rows.some((r) => r.user_id === app.userId)) {
      setOpen((o) => (o[app.userId!] === undefined ? { ...o, [app.userId!]: true } : o));
    }
  }, [data.rows, app.userId]);

  if (!app.ready || loading) return <LoadingScreen />;
  const accent = app.competitionTheme.primary;

  function liveColor(v: number) { return v > 0 ? "#15803d" : v < 0 ? "#dc2626" : "#64748b"; }
  function liveBg(v: number) { return v > 0 ? "#dcfce7" : v < 0 ? "#fee2e2" : "#f1f5f9"; }

  return (
    <>
      <AppBar league={app.leagueName} team={app.teamName} onMenuOpen={app.openDrawer} />
      <main style={s.container}>
        <div style={s.head}>
          <div style={s.headTop}>
            <CompetitionBadge name={app.competitionName} type={app.competitionType} />
            <span style={{ ...s.live, color: accent }}><span style={{ ...s.dot, background: accent }} /> LIVE</span>
          </div>
          <h1 style={s.title}>Classifica live</h1>
          <p style={s.sub}>{data.matchday ? `Giornata ${data.matchday.number} · ${data.matchday.status === "open" ? "in corso" : data.matchday.status}` : "Nessuna giornata attiva"}</p>
          <div style={s.legend}>
            <span><b>In classifica</b> = totale se finisse ora</span>
            <span><b>Live</b> = punti di oggi</span>
          </div>
        </div>

        {err && <div style={s.err}>{err}</div>}

        <div style={s.list}>
          {data.rows.map((r) => {
            const own = r.user_id === app.userId;
            const isOpen = !!open[r.user_id];
            return (
              <div key={r.user_id} style={{ ...s.card, ...(own ? s.cardYou : {}) }}>
                <div style={s.rtop} onClick={() => setOpen((o) => ({ ...o, [r.user_id]: !o[r.user_id] }))}>
                  <div style={s.rank}>{r.rank}</div>
                  <div style={{ ...s.shield, background: shieldBg(r.team_name) }}>{initials(r.team_name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={s.rname}>
                      <span style={s.rnameTxt}>{r.team_name}</span>
                      {own && <span style={{ ...s.youTag, background: accent }}>TU</span>}
                    </div>
                    <div style={s.toggle}>{isOpen ? "▾ nascondi giocatori" : "▸ mostra giocatori"}</div>
                  </div>
                  <div style={s.rright}>
                    <div style={{ ...s.bigLive, color: liveColor(r.live_score) }}>{signedFmt(r.live_score)}</div>
                    <div style={s.inClass}>in classifica <b>{fmt(r.projected_total)}</b></div>
                  </div>
                </div>

                {isOpen && (
                  <div style={s.players}>
                    {r.players.length === 0 ? (
                      <div style={s.noLineup}>Nessuna formazione schierata.</div>
                    ) : (
                      r.players.map((p, i) => {
                        const c = ROLE_COLORS[p.role] ?? ROLE_COLORS.C;
                        return (
                          <div key={i} style={s.prow}>
                            <span style={{ ...s.rb, background: c.bg, color: c.color }}>{p.role}</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={s.pn}>{pLabel(p)}</div>
                              <div style={s.pt}>{pSub(p)}</div>
                            </div>
                            <span style={{ ...s.pp, background: liveBg(p.points), color: liveColor(p.points) }}>{signedFmt(p.points)}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {!data.rows.length && <div style={s.card}>Nessun dato live.</div>}
        </div>

        <div style={s.refresh}>🔄 Si aggiorna da sola ogni 15 secondi</div>
      </main>
      <BottomNav />
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 520, margin: "0 auto", padding: "16px 14px 100px" },
  head: { background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: 16, boxShadow: "0 4px 16px rgba(15,23,42,.06)" },
  headTop: { display: "flex", alignItems: "center", gap: 8 },
  live: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 1000 },
  dot: { width: 8, height: 8, borderRadius: "50%" },
  title: { margin: "10px 0 1px", fontSize: 22, fontWeight: 1000, color: "#0f172a" },
  sub: { margin: 0, fontSize: 12.5, color: "#64748b", fontWeight: 800 },
  legend: { display: "flex", gap: 14, flexWrap: "wrap", marginTop: 11, paddingTop: 10, borderTop: "1px solid #f1f5f9", fontSize: 11, fontWeight: 800, color: "#64748b" },
  list: { display: "grid", gap: 8, marginTop: 14 },
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 15, padding: "11px 12px", boxShadow: "0 2px 8px rgba(15,23,42,.05)" },
  cardYou: { borderColor: "#15803d", background: "#f3fbf5" },
  rtop: { display: "grid", gridTemplateColumns: "24px 34px 1fr auto", gap: 10, alignItems: "center", cursor: "pointer" },
  rank: { fontSize: 15, fontWeight: 1000, color: "#64748b", textAlign: "center" },
  shield: { width: 34, height: 34, borderRadius: 11, display: "grid", placeItems: "center", color: "white", fontWeight: 1000, fontSize: 12, border: "2px solid #fff", boxShadow: "0 2px 6px rgba(0,0,0,.16)" },
  rname: { display: "flex", alignItems: "center", gap: 6 },
  rnameTxt: { fontSize: 14, fontWeight: 1000, color: "#0f172a", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  youTag: { color: "white", fontSize: 9, fontWeight: 1000, borderRadius: 5, padding: "1px 5px" },
  toggle: { fontSize: 11, fontWeight: 800, color: "#94a3b8", marginTop: 2 },
  rright: { textAlign: "right", whiteSpace: "nowrap" },
  bigLive: { fontSize: 22, fontWeight: 1000, lineHeight: 1 },
  inClass: { fontSize: 10.5, color: "#94a3b8", fontWeight: 800, marginTop: 3 },
  players: { marginTop: 11, paddingTop: 10, borderTop: "1px dashed #e5e7eb", display: "grid", gap: 7 },
  prow: { display: "grid", gridTemplateColumns: "24px 1fr auto", gap: 9, alignItems: "center" },
  rb: { width: 24, height: 24, borderRadius: 7, display: "grid", placeItems: "center", fontWeight: 1000, fontSize: 11 },
  pn: { fontSize: 13, fontWeight: 900, color: "#0f172a", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  pt: { fontSize: 10.5, fontWeight: 800, color: "#64748b" },
  pp: { fontSize: 13, fontWeight: 1000, padding: "2px 9px", borderRadius: 8 },
  noLineup: { fontSize: 12, fontWeight: 800, color: "#94a3b8" },
  refresh: { textAlign: "center", color: "#94a3b8", fontSize: 11, fontWeight: 800, marginTop: 14 },
  err: { background: "#fff1f2", color: "#991b1b", padding: 12, borderRadius: 12, marginTop: 12, fontWeight: 800 },
};