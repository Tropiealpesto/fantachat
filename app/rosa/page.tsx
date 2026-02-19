"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";

type Player = { id: string; name: string; real_team_id: string };
type Matchday = { id: string; number: number; status: string };
type RealTeam = { id: string; name: string };
type Top6Row = { rank: number; real_team_id: string; real_team_name: string };

type PickRow = {
  id: string;
  gk_player_id: string;
  def_player_id: string;
  mid_player_id: string;
  fwd_player_id: string;
};

export default function RosaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("—");
  const [teamName, setTeamName] = useState("—");
  const [myTeamId, setMyTeamId] = useState<string | null>(null);

  const [matchday, setMatchday] = useState<Matchday | null>(null);

  // real teams map
  const [realTeams, setRealTeams] = useState<Map<string, string>>(new Map());

  // players per role
  const [gks, setGks] = useState<Player[]>([]);
  const [defs, setDefs] = useState<Player[]>([]);
  const [mids, setMids] = useState<Player[]>([]);
  const [fwds, setFwds] = useState<Player[]>([]);

  // Top6 + Fixtures
  const [top6, setTop6] = useState<Top6Row[]>([]);
  const [fixtures, setFixtures] = useState<{ slot: number; home_team: string; away_team: string }[]>([]);

  // datalist input texts
  const [gkText, setGkText] = useState("");
  const [defText, setDefText] = useState("");
  const [midText, setMidText] = useState("");
  const [fwdText, setFwdText] = useState("");

  // saved pick readonly
  const [savedPick, setSavedPick] = useState<PickRow | null>(null);
  const [savedNames, setSavedNames] = useState<{ gk: string; def: string; mid: string; fwd: string } | null>(null);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const normTeam = (s: string) => String(s || "").trim().toLowerCase();

  const top6Names = useMemo(() => new Set(top6.map((t) => normTeam(t.real_team_name))), [top6]);

  // label "Nome (Squadra)"
  function playerLabel(p: Player) {
    const team = realTeams.get(p.real_team_id) || "";
    return team ? `${p.name} (${team})` : p.name;
  }

  // maps label -> id
  const gkMap = useMemo(() => new Map(gks.map((p) => [playerLabel(p), p.id])), [gks, realTeams]);
  const defMap = useMemo(() => new Map(defs.map((p) => [playerLabel(p), p.id])), [defs, realTeams]);
  const midMap = useMemo(() => new Map(mids.map((p) => [playerLabel(p), p.id])), [mids, realTeams]);
  const fwdMap = useMemo(() => new Map(fwds.map((p) => [playerLabel(p), p.id])), [fwds, realTeams]);

  // id -> real_team_id map (for “no two same real team” UI)
  const idToRealTeam = useMemo(() => {
    const m = new Map<string, string>();
    [...gks, ...defs, ...mids, ...fwds].forEach((p) => m.set(p.id, p.real_team_id));
    return m;
  }, [gks, defs, mids, fwds]);

  // selected IDs from text
  const selectedIds = useMemo(() => {
    const a = gkMap.get(gkText) || "";
    const b = defMap.get(defText) || "";
    const c = midMap.get(midText) || "";
    const d = fwdMap.get(fwdText) || "";
    return [a, b, c, d].filter(Boolean);
  }, [gkText, defText, midText, fwdText, gkMap, defMap, midMap, fwdMap]);

  // selected real teams
  const selectedRealTeams = useMemo(() => {
    const s = new Set<string>();
    selectedIds.forEach((pid) => {
      const rt = idToRealTeam.get(pid);
      if (rt) s.add(rt);
    });
    return s;
  }, [selectedIds, idToRealTeam]);

  function filterByRealTeam(list: Player[], currentText: string, map: Map<string, string>) {
    const currentId = map.get(currentText) || "";
    return list.filter((p) => {
      if (p.id === currentId) return true;
      return !selectedRealTeams.has(p.real_team_id);
    });
  }

  useEffect(() => {
    async function run() {
      setErr(null);
      setMsg(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");

      // lega attiva
      const { data: ctx } = await supabase
        .from("user_context")
        .select("active_league_id")
        .eq("user_id", auth.user.id)
        .maybeSingle();

      if (!ctx?.active_league_id) return router.replace("/seleziona-lega");
      const lid = ctx.active_league_id as string;
      setLeagueId(lid);

      // membership per lega
      const { data: mem } = await supabase
        .from("memberships")
        .select("team_id")
        .eq("league_id", lid)
        .limit(1)
        .maybeSingle();

      if (!mem) return router.replace("/seleziona-lega");
      setMyTeamId(mem.team_id);

      // nomi lega/squadra
      const { data: lg } = await supabase.from("leagues").select("name").eq("id", lid).single();
      if (lg?.name) setLeagueName(lg.name);

      const { data: tm } = await supabase.from("teams").select("name").eq("id", mem.team_id).single();
      if (tm?.name) setTeamName(tm.name);

      // real teams
      const { data: rt } = await supabase.from("real_teams").select("id, name");
      const rtMap = new Map<string, string>();
      (rt || []).forEach((x: any) => rtMap.set(x.id, x.name));
      setRealTeams(rtMap);

      // matchday open PER LEGA
      const { data: md } = await supabase
        .from("matchdays")
        .select("id, number, status")
        .eq("league_id", lid)
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

      // Top6 (rpc accetta matchday per lega)
      const { data: t6 } = await supabase.rpc("get_top6_for_matchday", { p_league_matchday_id: md.id } as any);
      setTop6((t6 || []) as any);

      // Fixtures globali per giornata open (rpc usa lega attiva)
      const { data: fx } = await supabase.rpc("get_fixtures_for_active_league_open_matchday");
      setFixtures((fx || []) as any);

      // players
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
      try {
        [a, b, c, d] = await Promise.all([loadRole("GK"), loadRole("DEF"), loadRole("MID"), loadRole("FWD")]);
        setGks(a); setDefs(b); setMids(c); setFwds(d);
      } catch (e: any) {
        setErr(e?.message || String(e));
        setLoading(false);
        return;
      }

      // pick già salvata?
      const { data: pick } = await supabase
        .from("picks")
        .select("id, gk_player_id, def_player_id, mid_player_id, fwd_player_id")
        .eq("league_id", lid)
        .eq("matchday_id", md.id)
        .eq("team_id", mem.team_id)
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
  }, [router]);

  async function save() {
    setErr(null);
    setMsg(null);

    if (!matchday) return;

    const gkId = gkMap.get(gkText) || "";
    const defId = defMap.get(defText) || "";
    const midId = midMap.get(midText) || "";
    const fwdId = fwdMap.get(fwdText) || "";

    if (!gkId || !defId || !midId || !fwdId) {
      setErr("Seleziona i giocatori dalla lista: digita e poi scegli un’opzione.");
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
      else if (m.includes("PLAYER_ALREADY_TAKEN")) setErr("Uno dei giocatori è già stato preso da un’altra squadra.");
      else if (m.includes("DUPLICATE_REAL_TEAM")) setErr("Non puoi scegliere due giocatori della stessa squadra.");
      else if (m.includes("TOO_MANY_TOP6")) setErr("Puoi scegliere al massimo 1 giocatore da una squadra Top6.");
      else setErr(m);
      return;
    }

    setMsg("Rosa inviata ✅");
    window.location.reload();
  }

  if (loading) return <main className="container">Caricamento...</main>;

  return (
    <>
      <AppBar league={leagueName} team={teamName} />
      <main className="container">
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 1000 }}>Rosa</div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
            {matchday ? `Giornata aperta: ${matchday.number} / 38` : "—"}
          </div>
        </div>

        {/* Formazione */}
        {savedPick && savedNames ? (
          <div className="card" style={{ padding: 16, marginTop: 12, borderLeft: "6px solid var(--primary)" }}>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>Rosa inviata (non modificabile)</div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <ReadonlyBox label="Portiere" value={savedNames.gk} />
              <ReadonlyBox label="Difensore" value={savedNames.def} />
              <ReadonlyBox label="Centrocampista" value={savedNames.mid} />
              <ReadonlyBox label="Attaccante" value={savedNames.fwd} />
            </div>

            <a
              href="/live"
              style={{
                display: "inline-block",
                marginTop: 12,
                border: "2px solid var(--accent)",
                color: "var(--text)",
                borderRadius: 14,
                padding: "10px 16px",
                fontWeight: 1000,
                textDecoration: "none",
              }}
            >
              Vai a Live
            </a>
          </div>
        ) : (
          <div className="card" style={{ padding: 16, marginTop: 12, borderLeft: "6px solid var(--primary)" }}>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>Scegli i 4 giocatori</div>
            <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
              Digita per cercare. Formato: <b>Nome (Squadra)</b>. Top6 evidenziati con ⭐.
            </div>

            <label style={label}>Portiere</label>
            <input
              list="dl_gk"
              value={gkText}
              onChange={(e) => setGkText(e.target.value)}
              placeholder="Cerca portiere..."
              style={selectStyle}
            />
            <datalist id="dl_gk">
              {filterByRealTeam(gks, gkText, gkMap).map((p) => (
                <option key={p.id} value={playerLabel(p)} />
              ))}
            </datalist>

            <label style={label}>Difensore</label>
            <input
              list="dl_def"
              value={defText}
              onChange={(e) => setDefText(e.target.value)}
              placeholder="Cerca difensore..."
              style={selectStyle}
            />
            <datalist id="dl_def">
              {filterByRealTeam(defs, defText, defMap).map((p) => (
                <option key={p.id} value={playerLabel(p)} />
              ))}
            </datalist>

            <label style={label}>Centrocampista</label>
            <input
              list="dl_mid"
              value={midText}
              onChange={(e) => setMidText(e.target.value)}
              placeholder="Cerca centrocampista..."
              style={selectStyle}
            />
            <datalist id="dl_mid">
              {filterByRealTeam(mids, midText, midMap).map((p) => (
                <option key={p.id} value={playerLabel(p)} />
              ))}
            </datalist>

            <label style={label}>Attaccante</label>
            <input
              list="dl_fwd"
              value={fwdText}
              onChange={(e) => setFwdText(e.target.value)}
              placeholder="Cerca attaccante..."
              style={selectStyle}
            />
            <datalist id="dl_fwd">
              {filterByRealTeam(fwds, fwdText, fwdMap).map((p) => (
                <option key={p.id} value={playerLabel(p)} />
              ))}
            </datalist>

            <button className="btn btn-primary" style={{ marginTop: 16, width: "100%", padding: 12 }} onClick={save} disabled={saving}>
              {saving ? "Invio..." : "Invia rosa"}
            </button>
          </div>
        )}

        {/* Partite + Top6 affiancati compatti arancioni */}
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {/* PARTITE */}
          <div className="card" style={{ padding: 12, borderLeft: "6px solid var(--accent)", boxShadow: "none" }}>
            <div style={{ fontWeight: 1000, fontSize: 14, color: "var(--accent-dark)" }}>Partite</div>

            {fixtures.length === 0 ? (
              <div style={{ marginTop: 8, color: "var(--muted)", fontWeight: 800, fontSize: 12 }}>
                Nessuna partita inserita.
              </div>
            ) : (
              <div style={{ marginTop: 8, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {fixtures.map((f) => (
                      <tr key={f.slot}>
                        <td style={{ ...miniTd, fontWeight: top6Names.has(normTeam(f.home_team)) ? 1000 : 900 }}>
                          {f.home_team}
                        </td>
                        <td style={{ ...miniTd, textAlign: "center", width: 16 }}>-</td>
                        <td style={{ ...miniTd, fontWeight: top6Names.has(normTeam(f.away_team)) ? 1000 : 900 }}>
                          {f.away_team}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* TOP6 */}
          <div className="card" style={{ padding: 12, borderLeft: "6px solid var(--accent)", boxShadow: "none" }}>
            <div style={{ fontWeight: 1000, fontSize: 14, color: "var(--accent-dark)" }}>Top 6</div>

            {top6.length === 0 ? (
              <div style={{ marginTop: 8, color: "var(--muted)", fontWeight: 800, fontSize: 12 }}>
                Non impostata.
              </div>
            ) : (
              <div style={{ marginTop: 8, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {top6
                      .slice()
                      .sort((a, b) => a.rank - b.rank)
                      .map((r) => (
                        <tr key={r.real_team_id}>
                          <td style={{ ...miniTd, width: 24, color: "var(--accent-dark)" }}>
                            <b>{r.rank}</b>
                          </td>
                          <td style={miniTd}>{r.real_team_name}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {msg && <div className="card" style={{ padding: 14, marginTop: 12, borderLeft: "6px solid var(--primary)", fontWeight: 900, color: "var(--primary-dark)" }}>{msg}</div>}
        {err && <div className="card" style={{ padding: 14, marginTop: 12, borderLeft: "6px solid var(--accent)", fontWeight: 900, color: "var(--accent-dark)" }}>{err}</div>}
      </main>
      <BottomNav />
    </>
  );
}

function ReadonlyBox(props: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 12 }}>
      <div style={{ color: "var(--muted)", fontWeight: 900, fontSize: 13 }}>{props.label}</div>
      <div style={{ marginTop: 4, fontWeight: 1000 }}>{props.value}</div>
    </div>
  );
}

const label: any = { fontWeight: 900, marginTop: 12, display: "block" };
const selectStyle: any = { width: "100%", padding: 12, marginTop: 6, borderRadius: 12, border: "1px solid var(--border)", fontWeight: 800, background: "white" };

// tabelline compatte arancioni
const miniTd: any = {
  padding: "6px 6px",
  borderBottom: "1px solid rgba(249,115,22,.18)",
  fontWeight: 900,
  fontSize: 12,
};
