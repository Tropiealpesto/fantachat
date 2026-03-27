"use client";
 
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { useApp } from "../components/AppContext";
import "./rosa.css";
import LoadingScreen from "../components/LoadingScreen";
 
type Player = { id: string; name: string; real_team_id: string };
type Matchday = { id: string; number: number; status: string };
type Top6Row = { rank: number; real_team_id: string; real_team_name: string };
type PickRow = {
  id: string;
  gk_player_id: string;
  def_player_id: string;
  mid_player_id: string;
  fwd_player_id: string;
};
 
type FieldKey = "gk" | "def" | "mid" | "fwd" | null;
 
// ─── CAMPO DA CALCIO ──────────────────────────────────────────────────────────
// Per modificare le dimensioni dei testi cerca i commenti con ← qui sotto
 
function CampoDaCalcio(props: { gk: string; def: string; mid: string; fwd: string }) {
  const positions = [
    { key: "gk",  label: props.gk,  role: "P", bg: "#fefce8", color: "#a16207", left: "50%", top: "12%" },
    { key: "def", label: props.def, role: "D", bg: "#e8f5ee", color: "#1a5c33", left: "63%", top: "34%" },
    { key: "mid", label: props.mid, role: "C", bg: "#e6f1fb", color: "#0c447c", left: "37%", top: "60%" },
    { key: "fwd", label: props.fwd, role: "A", bg: "#fcebeb", color: "#a32d2d", left: "50%", top: "82%" },
  ];
 
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "0.62", borderRadius: 16, overflow: "hidden", marginTop: 12 }}>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 300 484" preserveAspectRatio="xMidYMid slice">
        <rect width="300" height="484" fill="#2d8a4e"/>
        <rect x="0" y="0"   width="300" height="48" fill="#2a8249" opacity="0.5"/>
        <rect x="0" y="96"  width="300" height="48" fill="#2a8249" opacity="0.5"/>
        <rect x="0" y="192" width="300" height="48" fill="#2a8249" opacity="0.5"/>
        <rect x="0" y="288" width="300" height="48" fill="#2a8249" opacity="0.5"/>
        <rect x="0" y="384" width="300" height="48" fill="#2a8249" opacity="0.5"/>
        <rect x="12" y="12" width="276" height="460" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="2" rx="3"/>
        <line x1="12" y1="12" x2="288" y2="12" stroke="rgba(255,255,255,0.65)" strokeWidth="2"/>
        <rect x="75" y="12" width="150" height="70" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5"/>
        <rect x="110" y="12" width="80" height="28" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5"/>
        <circle cx="150" cy="104" r="3" fill="rgba(255,255,255,0.65)"/>
        <path d="M 55 472 A 95 95 0 0 1 245 472" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5"/>
        <rect x="118" y="4" width="64" height="10" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5"/>
      </svg>
 
      {positions.map((pos) =>
        pos.label ? (
          <div key={pos.key} style={{
            position: "absolute",
            left: pos.left,
            top: pos.top,
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 5,
          }}>
            {/* Badge ruolo */}
            <div style={{
              width: 38,           // ← larghezza badge
              height: 38,          // ← altezza badge
              borderRadius: 9,
              background: pos.bg,
              color: pos.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,        // ← dimensione lettera nel badge
              fontWeight: 900,
              border: "2px solid rgba(255,255,255,0.6)",
              fontFamily: "'Nunito', sans-serif",
            }}>
              {pos.role}
            </div>
            {/* Label nome giocatore */}
            <div style={{
              background: "rgba(0,0,0,0.65)",
              color: "white",
              fontSize: 12,        // ← dimensione testo nome
              fontWeight: 800,
              borderRadius: 6,
              padding: "3px 9px",
              whiteSpace: "nowrap",
              maxWidth: 130,       // ← larghezza massima (tronca con ...)
              overflow: "hidden",
              textOverflow: "ellipsis",
              textAlign: "center",
              fontFamily: "'Nunito', sans-serif",
            }}>
              {pos.label}
            </div>
          </div>
        ) : (
          // Slot vuoto tratteggiato
          <div key={pos.key} style={{
            position: "absolute",
            left: pos.left,
            top: pos.top,
            transform: "translate(-50%, -50%)",
            width: 38,
            height: 38,
            borderRadius: 9,
            border: "2px dashed rgba(255,255,255,0.4)",
          }} />
        )
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
 
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
  const [openField, setOpenField] = useState<FieldKey>(null);
 
  const gkWrapRef = useRef<HTMLDivElement | null>(null);
  const defWrapRef = useRef<HTMLDivElement | null>(null);
  const midWrapRef = useRef<HTMLDivElement | null>(null);
  const fwdWrapRef = useRef<HTMLDivElement | null>(null);
 
  const norm = (s: string) => String(s || "").trim().toLowerCase();
 
  const top6Names = useMemo(() => new Set(top6.map((t) => norm(t.real_team_name))), [top6]);
  const top6IdSet = useMemo(() => new Set(top6.map((t) => t.real_team_id)), [top6]);
 
  const playerLabel = useMemo(
    () => (p: Player) => {
      const team = realTeams.get(p.real_team_id) || "";
      return team ? `${p.name} (${team})` : p.name;
    },
    [realTeams]
  );
 
  const gkMap = useMemo(() => new Map(gks.map((p) => [playerLabel(p), p.id])), [gks, playerLabel]);
  const defMap = useMemo(() => new Map(defs.map((p) => [playerLabel(p), p.id])), [defs, playerLabel]);
  const midMap = useMemo(() => new Map(mids.map((p) => [playerLabel(p), p.id])), [mids, playerLabel]);
  const fwdMap = useMemo(() => new Map(fwds.map((p) => [playerLabel(p), p.id])), [fwds, playerLabel]);
 
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
    const q = norm(currentText);
    return list.filter((p) => {
      const label = norm(playerLabel(p));
      if (q && !label.includes(q)) return false;
      if (p.id === currentId) return true;
      if (takenIds.has(p.id)) return false;
      if (selectedIds.includes(p.id)) return false;
      if (selectedRealTeams.has(p.real_team_id)) return false;
      if (chosenTop6RealTeamId && top6IdSet.has(p.real_team_id) && p.real_team_id !== chosenTop6RealTeamId) return false;
      return true;
    });
  }
 
  const gkChoices  = useMemo(() => filterChoices(gks,  gkText,  gkMap).slice(0, 30),  [gks,  gkText,  gkMap,  takenIds, selectedIds, selectedRealTeams, chosenTop6RealTeamId, top6IdSet, playerLabel]);
  const defChoices = useMemo(() => filterChoices(defs, defText, defMap).slice(0, 30), [defs, defText, defMap, takenIds, selectedIds, selectedRealTeams, chosenTop6RealTeamId, top6IdSet, playerLabel]);
  const midChoices = useMemo(() => filterChoices(mids, midText, midMap).slice(0, 30), [mids, midText, midMap, takenIds, selectedIds, selectedRealTeams, chosenTop6RealTeamId, top6IdSet, playerLabel]);
  const fwdChoices = useMemo(() => filterChoices(fwds, fwdText, fwdMap).slice(0, 30), [fwds, fwdText, fwdMap, takenIds, selectedIds, selectedRealTeams, chosenTop6RealTeamId, top6IdSet, playerLabel]);
 
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const refs = [gkWrapRef.current, defWrapRef.current, midWrapRef.current, fwdWrapRef.current];
      const inside = refs.some((ref) => ref && ref.contains(target));
      if (!inside) setOpenField(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
 
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
        const labelFn = (p: Player) => {
          const team = rtMap.get(p.real_team_id) || "";
          return team ? `${p.name} (${team})` : p.name;
        };
        const gkp = pm.get((pick as any).gk_player_id);
        const dep = pm.get((pick as any).def_player_id);
        const mip = pm.get((pick as any).mid_player_id);
        const fwp = pm.get((pick as any).fwd_player_id);
        setSavedNames({
          gk:  gkp ? labelFn(gkp) : "—",
          def: dep ? labelFn(dep) : "—",
          mid: mip ? labelFn(mip) : "—",
          fwd: fwp ? labelFn(fwp) : "—",
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
 
    const gkId  = gkMap.get(gkText)   || "";
    const defId = defMap.get(defText)  || "";
    const midId = midMap.get(midText)  || "";
    const fwdId = fwdMap.get(fwdText)  || "";
 
    if (!gkId || !defId || !midId || !fwdId) {
      setErr("Seleziona i giocatori dalla lista.");
      return;
    }
 
    setSaving(true);
    const { error } = await supabase.rpc("save_picks", {
      p_matchday_id: matchday.id,
      p_gk: gkId, p_def: defId, p_mid: midId, p_fwd: fwdId,
    });
    setSaving(false);
 
    if (error) {
      const m = error.message || "Errore salvataggio";
      if (m.includes("ALREADY_SUBMITTED"))    setErr("Hai già inviato la rosa per questa giornata.");
      else if (m.includes("PLAYER_ALREADY_TAKEN")) setErr("Uno dei giocatori è già stato preso da un'altra squadra.");
      else if (m.includes("DUPLICATE_REAL_TEAM"))  setErr("Non puoi scegliere due giocatori della stessa squadra.");
      else if (m.includes("TOO_MANY_TOP6"))        setErr("Puoi scegliere al massimo 1 giocatore da una squadra Top6.");
      else setErr(m);
      return;
    }
 
    setMsg("Rosa inviata ✅");
    window.location.reload();
  }
 
  if (!ready || !userId || !activeLeagueId || !teamId || loading) return <LoadingScreen />;
 
  // Testi da mostrare sul campo (live durante la digitazione, o salvati)
  const campoGk  = savedNames?.gk  ?? gkText;
  const campoDef = savedNames?.def ?? defText;
  const campoMid = savedNames?.mid ?? midText;
  const campoFwd = savedNames?.fwd ?? fwdText;
 
  return (
    <>
      <AppBar league={leagueName} team={teamName} />
 
      <main className="container" style={{ fontFamily: "'Nunito', sans-serif", padding: "0 16px 100px" }}>
 
        <div className={`rosa-card ${matchday ? "rosa-card-green" : ""}`}>
 
          {/* Giornata */}
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
                <ReadonlyBox label="Portiere"       value={savedNames.gk}  role="gk"  />
                <ReadonlyBox label="Difensore"       value={savedNames.def} role="def" />
                <ReadonlyBox label="Centrocampista"  value={savedNames.mid} role="mid" />
                <ReadonlyBox label="Attaccante"      value={savedNames.fwd} role="fwd" />
              </div>
            </>
          ) : (
            <>
              <div className="rosa-title">Scegli i 4 giocatori</div>
              <div className="rosa-desc">Tocca il campo, scrivi per cercare e seleziona dalla lista.</div>
 
              {!matchday && (
                <div style={{
                  background: "#fff7ed", border: "1.5px solid #fed7aa",
                  borderLeft: "4px solid #ea580c", borderRadius: 12,
                  padding: 16, display: "flex", gap: 12,
                  alignItems: "flex-start", marginBottom: 20,
                }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#ea580c", marginBottom: 4 }}>Nessuna giornata aperta</div>
                    <div style={{ fontSize: 13, color: "#9a3412", lineHeight: 1.55, fontWeight: 500 }}>
                      Aspetta che il tuo admin apra una giornata per inserire la formazione.
                    </div>
                  </div>
                </div>
              )}
 
              <PlayerPicker wrapRef={gkWrapRef}  label="Portiere"      roleLetter="P" roleClass="rosa-role-gk"  value={gkText}  onChange={setGkText}  onFocus={() => setOpenField("gk")}  open={openField === "gk"}  choices={gkChoices}  playerLabel={playerLabel} realTeams={realTeams} top6IdSet={top6IdSet} onSelect={(l) => { setGkText(l);  setOpenField(null); }} placeholder="Cerca portiere..." />
              <PlayerPicker wrapRef={defWrapRef} label="Difensore"     roleLetter="D" roleClass="rosa-role-def" value={defText} onChange={setDefText} onFocus={() => setOpenField("def")} open={openField === "def"} choices={defChoices} playerLabel={playerLabel} realTeams={realTeams} top6IdSet={top6IdSet} onSelect={(l) => { setDefText(l); setOpenField(null); }} placeholder="Cerca difensore..." />
              <PlayerPicker wrapRef={midWrapRef} label="Centrocampista" roleLetter="C" roleClass="rosa-role-mid" value={midText} onChange={setMidText} onFocus={() => setOpenField("mid")} open={openField === "mid"} choices={midChoices} playerLabel={playerLabel} realTeams={realTeams} top6IdSet={top6IdSet} onSelect={(l) => { setMidText(l); setOpenField(null); }} placeholder="Cerca centrocampista..." />
              <PlayerPicker wrapRef={fwdWrapRef} label="Attaccante"    roleLetter="A" roleClass="rosa-role-fwd" value={fwdText} onChange={setFwdText} onFocus={() => setOpenField("fwd")} open={openField === "fwd"} choices={fwdChoices} playerLabel={playerLabel} realTeams={realTeams} top6IdSet={top6IdSet} onSelect={(l) => { setFwdText(l); setOpenField(null); }} placeholder="Cerca attaccante..." />
 
              <button className="rosa-btn" onClick={save} disabled={saving}>
                {saving ? "Invio..." : "Invia rosa"}
              </button>
            </>
          )}
 
          {/* ── CAMPO DA CALCIO ── sempre visibile */}
          <div style={{ marginTop: 16 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, color: "#5a8a6e",
              textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2,
            }}>
              Disposizione in campo
            </div>
            <CampoDaCalcio gk={campoGk} def={campoDef} mid={campoMid} fwd={campoFwd} />
          </div>
 
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
 
        {msg && <div className="rosa-alert rosa-alert-success">{msg}</div>}
        {err && (
          <div className="rosa-alert rosa-alert-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b85c0a" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            {err}
          </div>
        )}
 
      </main>
      <BottomNav />
    </>
  );
}
 
function PlayerPicker(props: {
  wrapRef: React.RefObject<HTMLDivElement | null>;
  label: string; roleLetter: string; roleClass: string;
  value: string; onChange: (v: string) => void; onFocus: () => void;
  open: boolean; choices: Player[]; playerLabel: (p: Player) => string;
  realTeams: Map<string, string>; top6IdSet: Set<string>;
  onSelect: (label: string) => void; placeholder: string;
}) {
  return (
    <div className="rosa-field" ref={props.wrapRef}>
      <label className="rosa-field-label">{props.label}</label>
      <div className="rosa-field-row">
        <div className={`rosa-role-badge ${props.roleClass}`}>{props.roleLetter}</div>
        <input
          value={props.value}
          onChange={(e) => { props.onChange(e.target.value); props.onFocus(); }}
          onFocus={props.onFocus}
          placeholder={props.placeholder}
          className="rosa-input"
          autoComplete="off"
        />
      </div>
      {props.open && (
        <div style={{
          marginTop: 8, background: "white", border: "1px solid #e5e7eb",
          borderRadius: 14, maxHeight: 220, overflowY: "auto",
          boxShadow: "0 8px 24px rgba(0,0,0,.08)",
        }}>
          {props.choices.length === 0 ? (
            <div style={{ padding: 12, color: "#6b7280", fontWeight: 700 }}>Nessun giocatore disponibile</div>
          ) : (
            props.choices.map((p) => {
              const teamName = props.realTeams.get(p.real_team_id) || "";
              const isTop6 = props.top6IdSet.has(p.real_team_id);
              return (
                <button
                  key={p.id} type="button"
                  onClick={() => props.onSelect(props.playerLabel(p))}
                  style={{
                    width: "100%", textAlign: "left", padding: "12px 14px",
                    border: "none", background: "white", borderBottom: "1px solid #f1f5f9",
                    display: "flex", justifyContent: "space-between", gap: 10,
                    fontWeight: 800, fontFamily: "'Nunito', sans-serif", cursor: "pointer",
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    {p.name}
                    {teamName ? <span style={{ color: "#6b7280", fontWeight: 700 }}> ({teamName})</span> : null}
                  </span>
                  {isTop6 ? <span style={{ flexShrink: 0 }}>⭐</span> : null}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
 
function ReadonlyBox({ label, value, role }: { label: string; value: string; role: "gk" | "def" | "mid" | "fwd" }) {
  const letter = { gk: "P", def: "D", mid: "C", fwd: "A" }[role];
  return (
    <div className="rosa-readonly-box">
      <div className={`rosa-role-badge rosa-role-${role}`}>{letter}</div>
      <div>
        <div className="rosa-readonly-label">{label}</div>
        <div className="rosa-readonly-val">{value}</div>
      </div>
    </div>
  );
}