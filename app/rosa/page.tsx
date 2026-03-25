"use client";
 
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { useApp } from "../components/AppContext";
import "./rosa.css";
 
type Player = { id: string; name: string; real_team_id: string };
type Matchday = { id: string; number: number; status: string };
type Top6Row = { rank: number; real_team_id: string; real_team_name: string };
type PickRow = { id: string; gk_player_id: string; def_player_id: string; mid_player_id: string; fwd_player_id: string };
 
export default function RosaPage() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamId, teamName } = useApp();
 
  const [loading, setLoading] = useState(true);
  const [matchday, setMatchday] = useState<Matchday | null>(null);
  const [realTeams, setRealTeams] = useState<Map<string, string>>(new Map());
  const [gks, setGks] = useState<Player[]>([]);
  const [defs, setDefs] = useState<Player[]>([]);
  const [mids, setMids] = useState<Player[]>([]);
  const [fwds, setFwds] = useState<Player[]>([]);
  const [top6, setTop6] = useState<Top6Row[]>([]);
  const [fixtures, setFixtures] = useState<{ slot: number; home_team: string; away_team: string }[]>([]);
  const [gkText, setGkText] = useState("");
  const [defText, setDefText] = useState("");
  const [midText, setMidText] = useState("");
  const [fwdText, setFwdText] = useState("");
  const [takenIds, setTakenIds] = useState<Set<string>>(new Set());
  const [savedPick, setSavedPick] = useState<PickRow | null>(null);
  const [savedNames, setSavedNames] = useState<{ gk: string; def: string; mid: string; fwd: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
 
  const norm = (s: string) => String(s || "").trim().toLowerCase();
 
  const top6Names = useMemo(() => new Set(top6.map((t) => norm(t.real_team_name))), [top6]);
  const top6IdSet = useMemo(() => new Set(top6.map((t) => t.real_team_id)), [top6]);
 
  function playerLabel(p: Player) {
    const team = realTeams.get(p.real_team_id) || "";
    return team ? `${p.name} (${team})` : p.name;
  }
 
  const gkMap = useMemo(() => new Map(gks.map((p) => [playerLabel(p), p.id])), [gks, realTeams]);
  const defMap = useMemo(() => new Map(defs.map((p) => [playerLabel(p), p.id])), [defs, realTeams]);
  const midMap = useMemo(() => new Map(mids.map((p) => [playerLabel(p), p.id])), [mids, realTeams]);
  const fwdMap = useMemo(() => new Map(fwds.map((p) => [playerLabel(p), p.id])), [fwds, realTeams]);
 
  const idToRealTeam = useMemo(() => {
    const m = new Map<string, string>();
    [...gks, ...defs, ...mids, ...fwds].forEach((p) => m.set(p.id, p.real_team_id));
    return m;
  }, [gks, defs, mids, fwds]);
 
  const selectedIds = useMemo(() => {
    const a = gkMap.get(gkText) || "";
    const b = defMap.get(defText) || "";
    const c = midMap.get(midText) || "";
    const d = fwdMap.get(fwdText) || "";
    return [a, b, c, d].filter(Boolean);
  }, [gkText, defText, midText, fwdText, gkMap, defMap, midMap, fwdMap]);
 
  const selectedRealTeams = useMemo(() => {
    const s = new Set<string>();
    selectedIds.forEach((pid) => {
      const rt = idToRealTeam.get(pid);
      if (rt) s.add(rt);
    });
    return s;
  }, [selectedIds, idToRealTeam]);
 
  const chosenTop6RealTeamId = useMemo(() => {
    for (const pid of selectedIds) {
      const rt = idToRealTeam.get(pid);
      if (rt && top6IdSet.has(rt)) return rt;
    }
    return null;
  }, [selectedIds, idToRealTeam, top6IdSet]);
 
  function filterChoices(list: Player[], currentText: string, map: Map<string, string>) {
    const currentId = map.get(currentText) || "";
    return list.filter((p) => {
      if (p.id === currentId) return true;
      if (takenIds.has(p.id)) return false;
      if (selectedIds.includes(p.id)) return false;
      if (selectedRealTeams.has(p.real_team_id)) return false;
      if (chosenTop6RealTeamId && top6IdSet.has(p.real_team_id) && p.real_team_id !== chosenTop6RealTeamId) return false;
      return true;
    });
  }
 
  useEffect(() => {
    async function run() {
      if (!ready) return;
      if (!userId) return router.replace("/login");
      if (!activeLeagueId || !teamId) return router.replace("/seleziona-lega");
 
      setLoading(true);
      setErr(null);
      setMsg(null);
 
      const { data: md } = await supabase
        .from("matchdays")
        .select("id, number, status")
        .eq("league_id", activeLeagueId)
        .eq("status", "open")
        .order("number", { ascending: false })
        .limit(1)
        .maybeSingle();
 
      if (!md) {
        setErr("Nessuna giornata aperta per questa lega.");
        setLoading(false);
        return;
      }
      setMatchday(md as any);
 
      const { data: rt } = await supabase.from("real_teams").select("id, name");
      const rtMap = new Map<string, string>();
      (rt || []).forEach((x: any) => rtMap.set(x.id, x.name));
      setRealTeams(rtMap);
 
      const { data: t6 } = await supabase.rpc("get_top6_for_matchday", { p_league_matchday_id: md.id } as any);
      setTop6((t6 || []) as any);
 
      const { data: taken } = await supabase.rpc("get_taken_player_ids", { p_matchday_id: md.id });
      const s = new Set<string>();
      (taken || []).forEach((x: any) => x.player_id && s.add(String(x.player_id)));
      setTakenIds(s);
 
      const { data: fx } = await supabase.rpc("get_fixtures_for_active_league_open_matchday");
      setFixtures((fx || []) as any);
 
      const loadRole = async (role: "GK" | "DEF" | "MID" | "FWD") => {
        const { data, error } = await supabase
          .from("players")
          .select("id, name, real_team_id")
          .eq("role", role)
          .eq("active", true)
          .order("name", { ascending: true });
        if (error) throw error;
        return (data || []) as Player[];
      };
 
      let a: Player[] = [], b: Player[] = [], c: Player[] = [], d: Player[] = [];
      [a, b, c, d] = await Promise.all([loadRole("GK"), loadRole("DEF"), loadRole("MID"), loadRole("FWD")]);
      setGks(a); setDefs(b); setMids(c); setFwds(d);
 
      const { data: pick } = await supabase
        .from("picks")
        .select("id, gk_player_id, def_player_id, mid_player_id, fwd_player_id")
        .eq("league_id", activeLeagueId)
        .eq("matchday_id", md.id)
        .eq("team_id", teamId)
        .limit(1)
        .maybeSingle();
 
      if (pick) {
        setSavedPick(pick as any);
        const all = [...a, ...b, ...c, ...d];
        const pm = new Map<string, Player>();
        all.forEach((p) => pm.set(p.id, p));
        const gkp = pm.get((pick as any).gk_player_id);
        const dep = pm.get((pick as any).def_player_id);
        const mip = pm.get((pick as any).mid_player_id);
        const fwp = pm.get((pick as any).fwd_player_id);
        setSavedNames({
          gk: gkp ? playerLabel(gkp) : "—",
          def: dep ? playerLabel(dep) : "—",
          mid: mip ? playerLabel(mip) : "—",
          fwd: fwp ? playerLabel(fwp) : "—",
        });
      } else {
        setSavedPick(null);
        setSavedNames(null);
      }
 
      setLoading(false);
    }
 
    run();
  }, [ready, userId, activeLeagueId, teamId, router]);
 
  async function save() {
    setErr(null);
    setMsg(null);
    if (!matchday) return;
 
    const gkId = gkMap.get(gkText) || "";
    const defId = defMap.get(defText) || "";
    const midId = midMap.get(midText) || "";
    const fwdId = fwdMap.get(fwdText) || "";
 
    if (!gkId || !defId || !midId || !fwdId) {
      setErr("Seleziona i giocatori dalla lista: digita e poi scegli un'opzione.");
      return;
    }
 
    setSaving(true);
    const { error } = await supabase.rpc("save_picks", {
      p_matchday_id: matchday.id,
      p_gk: gkId,
      p_def: defId,
      p_mid: midId,
      p_fwd: fwdId,
    });
    setSaving(false);
 
    if (error) {
      const m = error.message || "Errore salvataggio";
      if (m.includes("ALREADY_SUBMITTED")) setErr("Hai già inviato la rosa per questa giornata.");
      else if (m.includes("PLAYER_ALREADY_TAKEN")) setErr("Uno dei giocatori è già stato preso da un'altra squadra.");
      else if (m.includes("DUPLICATE_REAL_TEAM")) setErr("Non puoi scegliere due giocatori della stessa squadra.");
      else if (m.includes("TOO_MANY_TOP6")) setErr("Puoi scegliere al massimo 1 giocatore da una squadra Top6.");
      else setErr(m);
      return;
    }
 
    setMsg("Rosa inviata ✅");
    window.location.reload();
  }
 
  if (!ready || !userId || !activeLeagueId || !teamId || loading)
    return <main className="container" style={{ padding: 20, fontFamily: "'Nunito', sans-serif" }}>Caricamento...</main>;
 
  return (
    <>
      <AppBar league={leagueName} team={teamName} />
      <main className="container" style={{ fontFamily: "'Nunito', sans-serif", padding: "0 16px 100px" }}>
 
        {/* Card principale rosa */}
        <div className={`rosa-card ${matchday ? "rosa-card-green" : ""}`}>
 
          {/* Giornata + locked */}
          <div className="rosa-giornata-row">
            <div>
              <div className="rosa-giornata-label">Giornata corrente</div>
              <div className="rosa-giornata-val">{matchday ? `${matchday.number} / 38` : "— / 38"}</div>
            </div>
            {matchday && (
              <span className="rosa-locked">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                Locked
              </span>
            )}
          </div>
 
          {savedPick && savedNames ? (
            <>
              <div className="rosa-title">Rosa inviata</div>
              <div className="rosa-desc">Non modificabile per questa giornata.</div>
              <div style={{ display: "grid", gap: 10 }}>
                <ReadonlyBox label="Portiere" value={savedNames.gk} role="gk" />
                <ReadonlyBox label="Difensore" value={savedNames.def} role="def" />
                <ReadonlyBox label="Centrocampista" value={savedNames.mid} role="mid" />
                <ReadonlyBox label="Attaccante" value={savedNames.fwd} role="fwd" />
              </div>
            </>
          ) : (
            <>
              <div className="rosa-title">Scegli i 4 giocatori</div>
              <div className="rosa-desc">Digita per cercare. Formato: Nome (Squadra). Top 6 evidenziati con ⭐.</div>
 
              <div className="rosa-field">
                <label className="rosa-field-label">Portiere</label>
                <div className="rosa-field-row">
                  <div className="rosa-role-badge rosa-role-gk">P</div>
                  <input list="dl_gk" value={gkText} onChange={(e) => setGkText(e.target.value)} placeholder="Cerca portiere..." className="rosa-input" />
                  <datalist id="dl_gk">
                    {filterChoices(gks, gkText, gkMap).map((p) => <option key={p.id} value={playerLabel(p)} />)}
                  </datalist>
                </div>
              </div>
 
              <div className="rosa-field">
                <label className="rosa-field-label">Difensore</label>
                <div className="rosa-field-row">
                  <div className="rosa-role-badge rosa-role-def">D</div>
                  <input list="dl_def" value={defText} onChange={(e) => setDefText(e.target.value)} placeholder="Cerca difensore..." className="rosa-input" />
                  <datalist id="dl_def">
                    {filterChoices(defs, defText, defMap).map((p) => <option key={p.id} value={playerLabel(p)} />)}
                  </datalist>
                </div>
              </div>
 
              <div className="rosa-field">
                <label className="rosa-field-label">Centrocampista</label>
                <div className="rosa-field-row">
                  <div className="rosa-role-badge rosa-role-mid">C</div>
                  <input list="dl_mid" value={midText} onChange={(e) => setMidText(e.target.value)} placeholder="Cerca centrocampista..." className="rosa-input" />
                  <datalist id="dl_mid">
                    {filterChoices(mids, midText, midMap).map((p) => <option key={p.id} value={playerLabel(p)} />)}
                  </datalist>
                </div>
              </div>
 
              <div className="rosa-field">
                <label className="rosa-field-label">Attaccante</label>
                <div className="rosa-field-row">
                  <div className="rosa-role-badge rosa-role-fwd">A</div>
                  <input list="dl_fwd" value={fwdText} onChange={(e) => setFwdText(e.target.value)} placeholder="Cerca attaccante..." className="rosa-input" />
                  <datalist id="dl_fwd">
                    {filterChoices(fwds, fwdText, fwdMap).map((p) => <option key={p.id} value={playerLabel(p)} />)}
                  </datalist>
                </div>
              </div>
 
              <button className="rosa-btn" onClick={save} disabled={saving}>
                {saving ? "Invio..." : "Invia rosa"}
              </button>
            </>
          )}
        </div>
 
        {/* Partite + Top6 */}
        <div className="rosa-stats-grid">
          <div className="rosa-stat">
            <div className="rosa-stat-label">Partite</div>
            {fixtures.length === 0 ? (
              <div className="rosa-stat-val">Nessuna inserita</div>
            ) : (
              <table className="rosa-table">
                <tbody>
                  {fixtures.map((f) => (
                    <tr key={f.slot}>
                      <td style={{ fontWeight: top6Names.has(norm(f.home_team)) ? 900 : 700 }}>{f.home_team}</td>
                      <td style={{ textAlign: "center", width: 12 }}>-</td>
                      <td style={{ fontWeight: top6Names.has(norm(f.away_team)) ? 900 : 700 }}>{f.away_team}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
 
          <div className="rosa-stat">
            <div className="rosa-stat-label">Top 6</div>
            {top6.length === 0 ? (
              <div className="rosa-stat-val">Non impostata</div>
            ) : (
              <table className="rosa-table">
                <tbody>
                  {top6.slice().sort((a, b) => a.rank - b.rank).map((r) => (
                    <tr key={r.real_team_id}>
                      <td className="rank">{r.rank}</td>
                      <td>{r.real_team_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
 
        {/* Nessuna giornata aperta */}
        {!matchday && (
          <div className="rosa-alert rosa-alert-warn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b85c0a" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Nessuna giornata aperta per questa lega.
          </div>
        )}
 
        {msg && (
          <div className="rosa-alert rosa-alert-success">
            {msg}
          </div>
        )}
        {err && (
          <div className="rosa-alert rosa-alert-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b85c0a" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            {err}
          </div>
        )}
 
      </main>
      <BottomNav />
    </>
  );
}
 
function ReadonlyBox({ label, value, role }: { label: string; value: string; role: "gk" | "def" | "mid" | "fwd" }) {
  const badgeClass = `rosa-role-badge rosa-role-${role}`;
  const letter = { gk: "P", def: "D", mid: "C", fwd: "A" }[role];
  return (
    <div className="rosa-readonly-box">
      <div className={badgeClass}>{letter}</div>
      <div>
        <div className="rosa-readonly-label">{label}</div>
        <div className="rosa-readonly-val">{value}</div>
      </div>
    </div>
  );
}