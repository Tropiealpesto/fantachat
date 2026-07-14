"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import LoadingScreen from "../../components/LoadingScreen";
import TeamBadge from "../../components/TeamBadge";
import { useRequireApp } from "../../hooks/useRequireApp";
import { rpcJson, fmt, signedFmt } from "../../../lib/rpc";
import { supabase } from "../../../lib/supabaseClient";

type Player = { role: string; name: string; team: string | null; points: number | null };
type Row = { user_id: string; team_name: string; total_score: number; rank: number; players: Player[] };
type Data = { matchday_number: number | null; rows: Row[] };

const RANK_COLOR: Record<number, string> = { 1: "#f59e0b", 2: "#94a3b8", 3: "#b45309" };
function pLabel(p: Player) { return p.role === "AL" ? p.name : p.role === "P" ? (p.team || p.name) : p.name; }
function pSub(p: Player) { return p.role === "P" ? "Portiere" : `${p.role} · ${p.team ?? ""}`; }
const ROLE_META: Record<string, { bg: string; fg: string }> = {
  P: { bg: "#FEF3C7", fg: "#B45309" },
  D: { bg: "#DCFCE7", fg: "#15803D" },
  C: { bg: "#DBEAFE", fg: "#2563EB" },
  A: { bg: "#FEE2E2", fg: "#DC2626" },
  AL: { bg: "#F5F3FF", fg: "#7C3AED" },
};

function RoleBadge({ role }: { role: string }) {
  const c = ROLE_META[role] ?? { bg: "#f1f5f9", fg: "#475569" };
  return <span className={`fc-role-badge fc-role-${role}`} style={{ ...s.roleBadge, background: c.bg, color: c.fg }}>{role}</span>;
}

export default function StoricoDetail() {
  const app = useRequireApp(true);
  const params = useParams();
  const [data, setData] = useState<Data>({ matchday_number: null, rows: [] });
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [memberColors, setMemberColors] = useState<Record<string, { primary: string | null; secondary: string | null }>>({});

  useEffect(() => {
    if (!app.ready || !params?.id) return;
    rpcJson<Data>("get_matchday_detail", { p_matchday_id: params.id }, { matchday_number: null, rows: [] })
      .then(setData)
      .finally(() => setLoading(false));
  }, [app.ready, params?.id]);

  useEffect(() => {
    if (!app.ready || !app.activeLeagueId) return;
    let off = false;
    supabase.rpc("get_league_members", { p_league_id: app.activeLeagueId }).then(({ data }) => {
      if (off) return;
      const mc: Record<string, { primary: string | null; secondary: string | null }> = {};
      ((data as any[] | null) ?? []).forEach((m) => { mc[m.user_id] = { primary: m.color_primary ?? null, secondary: m.color_secondary ?? null }; });
      setMemberColors(mc);
    });
    return () => { off = true; };
  }, [app.ready, app.activeLeagueId]);

  if (!app.ready || loading) return <LoadingScreen />;
  const accent = app.competitionTheme.primary;
  const pColor = (v: number) => (v > 0 ? "#15803d" : v < 0 ? "#dc2626" : "#64748b");
  const pBg = (v: number) => (v > 0 ? "#dcfce7" : v < 0 ? "#fee2e2" : "#f1f5f9");

  return (
    <>
      <AppBar league={app.leagueName} team={app.teamName} onMenuOpen={app.openDrawer} />
      <main style={s.container}>
        <div style={s.head}>
          <h1 style={s.h1}>Giornata {data.matchday_number ?? "—"}</h1>
          <p style={s.sub}>Tabellone finale della giornata</p>
        </div>

        <div style={s.list}>
          {data.rows.map((r) => {
            const own = r.user_id === app.userId;
            const isOpen = open[r.user_id] ?? own;
            const c = memberColors[r.user_id];
            const rc = RANK_COLOR[r.rank];
            return (
              <div key={r.user_id} style={{ ...s.card, ...(own ? s.cardYou : {}) }}>
                <div style={s.rtop} onClick={() => setOpen((o) => ({ ...o, [r.user_id]: !o[r.user_id] }))}>
                  <div style={{ ...s.rank, ...(rc ? { background: rc, color: "white" } : {}) }}>{r.rank}</div>
                  <TeamBadge name={r.team_name} primary={c?.primary ?? null} secondary={c?.secondary ?? null} size={34} />
                  <div style={{ minWidth: 0 }}>
                    <div style={s.rname}>
                      <span style={s.rnameTxt}>{r.team_name}</span>
                      {own && <span style={{ ...s.youTag, background: accent }}>TU</span>}
                    </div>
                    <div style={s.toggle}>{isOpen ? "▾ nascondi giocatori" : "▸ mostra giocatori"}</div>
                  </div>
                  <div style={s.total}>{fmt(r.total_score)}</div>
                </div>

                {isOpen && (
                  <div style={s.players}>
                    {(!r.players || r.players.length === 0) ? (
                      <div style={s.noLineup}>Nessuna formazione.</div>
                    ) : (
                      r.players.map((p, i) => {
                        const v = p.points == null ? null : Number(p.points);
                        return (
                          <div key={i} style={s.prow}>
                            <RoleBadge role={p.role} />
                            <div style={{ minWidth: 0 }}>
                              <div style={s.pn}>{pLabel(p)}</div>
                              <div style={s.pt}>
                                {p.role === "AL" ? `Allenatore - ${p.team ?? ""}` : pSub(p)}
                              </div>
                            </div>
                            <span style={{ ...s.pp, background: v == null ? "#f1f5f9" : pBg(v), color: v == null ? "#94a3b8" : pColor(v) }}>{v == null ? "—" : signedFmt(v)}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {!data.rows.length && <div style={s.empty}>Questa giornata non è ancora stata calcolata.</div>}
        </div>
      </main>
      <BottomNav />
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 520, margin: "0 auto", padding: "16px 14px 100px" },
  head: { background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: 16, boxShadow: "0 4px 16px rgba(15,23,42,.06)" },
  h1: { fontSize: 22, fontWeight: 1000, color: "#0f172a", margin: 0 },
  sub: { fontSize: 12.5, color: "#64748b", fontWeight: 700, margin: "4px 0 0" },
  list: { display: "grid", gap: 8, marginTop: 14 },
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 15, padding: "11px 12px", boxShadow: "0 2px 8px rgba(15,23,42,.05)" },
  cardYou: { borderColor: "#15803d", background: "#f3fbf5" },
  rtop: { display: "grid", gridTemplateColumns: "28px 34px 1fr auto", gap: 10, alignItems: "center", cursor: "pointer" },
  rank: { width: 28, height: 28, borderRadius: 9, display: "grid", placeItems: "center", fontSize: 13, fontWeight: 1000, color: "#64748b", background: "#f1f5f9" },
  rname: { display: "flex", alignItems: "center", gap: 6 },
  rnameTxt: { fontSize: 14, fontWeight: 1000, color: "#0f172a", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  youTag: { color: "white", fontSize: 9, fontWeight: 1000, borderRadius: 5, padding: "1px 5px" },
  toggle: { fontSize: 11, fontWeight: 800, color: "#94a3b8", marginTop: 2 },
  total: { fontSize: 19, fontWeight: 1000, color: "#0f172a", textAlign: "right" },
  players: { marginTop: 11, paddingTop: 10, borderTop: "1px dashed #e5e7eb", display: "grid", gap: 7 },
  prow: { display: "grid", gridTemplateColumns: "32px 1fr auto", gap: 9, alignItems: "center" },
  roleBadge: { width: 32, height: 32, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 1000, border: "2px solid white", boxShadow: "0 3px 9px rgba(15,23,42,.10)" },
  pn: { fontSize: 13, fontWeight: 900, color: "#0f172a", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  pt: { fontSize: 10.5, fontWeight: 800, color: "#64748b" },
  pp: { fontSize: 13, fontWeight: 1000, padding: "2px 9px", borderRadius: 8 },
  noLineup: { fontSize: 12, fontWeight: 800, color: "#94a3b8" },
  empty: { background: "white", border: "1px solid #e5e7eb", borderRadius: 15, padding: 16, color: "#64748b", fontWeight: 800 },
};
