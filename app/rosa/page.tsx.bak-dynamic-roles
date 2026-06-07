"use client";

import { useEffect, useMemo, useState } from "react";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import LoadingScreen from "../components/LoadingScreen";
import CompetitionBadge from "../components/CompetitionBadge";
import { useRequireApp } from "../hooks/useRequireApp";
import { rpcJson } from "../../lib/rpc";

type Player = { id: string; name: string; role: "P" | "D" | "C" | "A"; team_name?: string | null };
type FormData = { matchday: { id: string; number: number; status: string } | null; players: Player[]; existing_lineup?: { players: Player[] } | null };

const roles: Player["role"][] = ["P", "D", "C", "A"];
const empty: FormData = { matchday: null, players: [], existing_lineup: null };

export default function RosaPage() {
  const app = useRequireApp(true);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FormData>(empty);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!app.ready || !app.activeLeagueId || !app.activeLeagueCompetitionId) return;
    async function load() {
      setLoading(true);
      setErr(null);
      const result = await rpcJson<FormData>("get_lineup_form_data", { p_league_competition_id: app.activeLeagueCompetitionId }, empty);
      setData(result ?? empty);
      const initial: Record<string, string> = {};
      (result?.existing_lineup?.players ?? []).forEach((p) => { initial[p.role] = p.id; });
      setSelected(initial);
      setLoading(false);
    }
    load().catch((e) => { setErr(e.message); setLoading(false); });
  }, [app.ready, app.activeLeagueId, app.activeLeagueCompetitionId]);

  const byRole = useMemo(() => {
    const map: Record<string, Player[]> = { P: [], D: [], C: [], A: [] };
    data.players.forEach((p) => map[p.role]?.push(p));
    return map;
  }, [data.players]);

  async function submit() {
    setMsg(null); setErr(null);
    if (!data.matchday || !app.activeLeagueId || !app.activeLeagueCompetitionId) return setErr("Nessuna giornata aperta.");
    const ids = roles.map((r) => selected[r]).filter(Boolean);
    if (ids.length !== roles.length) return setErr("Seleziona un giocatore per ogni ruolo.");
    setSaving(true);
    const { error } = await (await import("../../lib/supabaseClient")).supabase.rpc("submit_lineup", {
      p_league_id: app.activeLeagueId,
      p_league_competition_id: app.activeLeagueCompetitionId,
      p_matchday_id: data.matchday.id,
      p_players: roles.map((role) => ({ role, real_player_id: selected[role] })),
    });
    setSaving(false);
    if (error) return setErr(error.message);
    setMsg("Rosa inviata ✅");
    await app.refresh();
  }

  if (!app.ready || loading) return <LoadingScreen />;

  return <>
    <AppBar league={app.leagueName} team={app.teamName} onMenuOpen={app.openDrawer} />
    <main style={s.container}>
      <div style={s.card}>
        <CompetitionBadge name={app.competitionName} type={app.competitionType} />
        <h1 style={s.title}>Rosa</h1>
        <p style={s.muted}>{data.matchday ? `Giornata ${data.matchday.number} · ${data.matchday.status}` : "Nessuna giornata aperta"}</p>
        {roles.map((role) => <div key={role} style={s.field}><label style={s.label}>{roleLabel(role)}</label><select value={selected[role] ?? ""} onChange={(e) => setSelected((p) => ({ ...p, [role]: e.target.value }))} style={s.select}><option value="">Seleziona...</option>{byRole[role].map((p) => <option key={p.id} value={p.id}>{p.name}{p.team_name ? ` (${p.team_name})` : ""}</option>)}</select></div>)}
        <button style={{ ...s.btn, background: app.competitionTheme.primary }} disabled={saving || !data.matchday} onClick={submit}>{saving ? "Invio..." : "Invia rosa"}</button>
        {msg && <div style={s.ok}>{msg}</div>}{err && <div style={s.err}>{err}</div>}
      </div>
    </main><BottomNav />
  </>;
}

function roleLabel(r: string) { return r === "P" ? "Portiere" : r === "D" ? "Difensore" : r === "C" ? "Centrocampista" : "Attaccante"; }
const s: Record<string, React.CSSProperties> = { container: { maxWidth: 520, margin: "0 auto", padding: "16px 14px 100px" }, card: { background: "white", borderRadius: 18, border: "1px solid #e5e7eb", padding: 16, boxShadow: "0 4px 16px rgba(0,0,0,.06)" }, title: { margin: "12px 0 4px", fontSize: 26 }, muted: { color: "#6b7280", fontWeight: 700 }, field: { marginTop: 14 }, label: { display: "block", fontSize: 12, textTransform: "uppercase", color: "#6b7280", fontWeight: 900, marginBottom: 6 }, select: { width: "100%", padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", fontWeight: 800 }, btn: { width: "100%", marginTop: 18, padding: 14, border: 0, color: "white", borderRadius: 12, fontWeight: 900 }, ok: { marginTop: 12, color: "#15803d", fontWeight: 900 }, err: { marginTop: 12, color: "#b85c0a", fontWeight: 900 } };
