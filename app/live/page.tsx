"use client";

import { useEffect, useState } from "react";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import LoadingScreen from "../components/LoadingScreen";
import CompetitionBadge from "../components/CompetitionBadge";
import { useRequireApp } from "../hooks/useRequireApp";
import { rpcJson, fmt, signedFmt } from "../../lib/rpc";

type LiveRow = { user_id: string; team_name: string; total_score: number; p_score?: number; d_score?: number; c_score?: number; a_score?: number; rank: number };
type LiveData = { matchday?: { id: string; number: number; status: string } | null; rows: LiveRow[] };
const empty: LiveData = { matchday: null, rows: [] };

export default function LivePage() {
  const app = useRequireApp(true); const [loading, setLoading] = useState(true); const [data, setData] = useState<LiveData>(empty); const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (!app.ready || !app.activeLeagueCompetitionId) return; let off = false; async function load(){ try { const r = await rpcJson<LiveData>("get_live_data", { p_league_competition_id: app.activeLeagueCompetitionId }, empty); if(!off) setData(r ?? empty); } catch(e:any){ if(!off) setErr(e.message); } finally { if(!off) setLoading(false); } } load(); const t = setInterval(load,15000); return ()=>{ off=true; clearInterval(t);}; }, [app.ready, app.activeLeagueCompetitionId]);
  if (!app.ready || loading) return <LoadingScreen />;
  return <><AppBar league={app.leagueName} team={app.teamName} onMenuOpen={app.openDrawer} /><main style={s.container}><div style={s.head}><CompetitionBadge name={app.competitionName} type={app.competitionType}/><h1>Live</h1><p>{data.matchday ? `Giornata ${data.matchday.number} · ${data.matchday.status}` : "Nessuna giornata attiva"}</p></div>{err && <div style={s.err}>{err}</div>}<div style={s.list}>{data.rows.map((r)=><div key={r.user_id} style={{...s.card,borderLeft:`4px solid ${r.user_id===app.userId?app.competitionTheme.primary:"transparent"}`}}><div style={s.row}><b>#{r.rank}</b><div><strong>{r.team_name}</strong><small>P {signedFmt(r.p_score)} · D {signedFmt(r.d_score)} · C {signedFmt(r.c_score)} · A {signedFmt(r.a_score)}</small></div><span>{fmt(r.total_score)}</span></div></div>)}{!data.rows.length && <div style={s.card}>Nessun dato live.</div>}</div></main><BottomNav/></>;
}
const s: Record<string, React.CSSProperties> = { container:{maxWidth:520,margin:"0 auto",padding:"16px 14px 100px"}, head:{background:"white",border:"1px solid #e5e7eb",borderRadius:18,padding:16}, list:{display:"grid",gap:10,marginTop:14}, card:{background:"white",border:"1px solid #e5e7eb",borderRadius:16,padding:14}, row:{display:"grid",gridTemplateColumns:"44px 1fr auto",gap:10,alignItems:"center"}, err:{background:"#fff1f2",color:"#991b1b",padding:12,borderRadius:12,marginTop:12} };
