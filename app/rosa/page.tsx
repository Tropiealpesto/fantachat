"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";

type Player = { id: string; name: string; real_team_id: string };
type Matchday = { id: string; number: number; status: string };
type Membership = { team_id: string; role: "player" | "admin" };

type PickRow = {
  id: string;
  gk_player_id: string;
  def_player_id: string;
  mid_player_id: string;
  fwd_player_id: string;
};

type Top6Row = { rank: number; real_team_id: string; real_team_name: string };

export default function RosaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("—");
  const [teamName, setTeamName] = useState("—");
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [role, setRole] = useState<"player" | "admin" | null>(null);

  const [matchday, setMatchday] = useState<Matchday | null>(null);

  const [gks, setGks] = useState<Player[]>([]);
  const [defs, setDefs] = useState<Player[]>([]);
  const [mids, setMids] = useState<Player[]>([]);
  const [fwds, setFwds] = useState<Player[]>([]);

  const [top6, setTop6] = useState<Top6Row[]>([]);
  const top6TeamIds = useMemo(() => new Set(top6.map((t) => t.real_team_id)), [top6]);

  const [gk, setGk] = useState("");
  const [def, setDef] = useState("");
  const [mid, setMid] = useState("");
  const [fwd, setFwd] = useState("");

  const [fixtures, setFixtures] = useState<
  { slot: number; home_team: string; away_team: string }[]
>([]);

  const [savedPick, setSavedPick] = useState<PickRow | null>(null);
  const [savedNames, setSavedNames] = useState<{ gk: string; def: string; mid: string; fwd: string } | null>(null);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedRealTeams = useMemo(() => {
    const map = new Map<string, string>();
    [...gks, ...defs, ...mids, ...fwds].forEach((p) => map.set(p.id, p.real_team_id));
    return new Set([gk, def, mid, fwd].filter(Boolean).map((pid) => map.get(pid)!).filter(Boolean));
  }, [gk, def, mid, fwd, gks, defs, mids, fwds]);

  function filterByRealTeam(list: Player[], current: string) {
    return list.filter((p) => p.id === current || !selectedRealTeams.has(p.real_team_id));
  }

  function optLabel(p: Player) {
    return top6TeamIds.has(p.real_team_id) ? `⭐ ${p.name} (TOP6)` : p.name;
  }

  useEffect(() => {
    async function run() {
      setErr(null);
      setMsg(null);

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");

      const { data: ctx } = await supabase
        .from("user_context")
        .select("active_league_id")
        .eq("user_id", auth.user.id)
        .maybeSingle();

      if (!ctx?.active_league_id) return router.replace("/seleziona-lega");
      const lid = ctx.active_league_id as string;
      setLeagueId(lid);

      const { data: mem } = await supabase
        .from("memberships")
        .select("team_id, role")
        .eq("league_id", lid)
        .limit(1)
        .maybeSingle();

      if (!mem) return router.replace("/seleziona-lega");
      setMyTeamId(mem.team_id);
      setRole(mem.role);

      const { data: lg } = await supabase.from("leagues").select("name").eq("id", lid).single();
      if (lg?.name) setLeagueName(lg.name);

      const { data: tm } = await supabase.from("teams").select("name").eq("id", mem.team_id).single();
      if (tm?.name) setTeamName(tm.name);

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
      setMatchday(md);

      // Carica partite della giornata
const { data: fixtures } =
  await supabase.rpc("get_fixtures_for_active_league_open_matchday");

setFixtures(fixtures || []);

      // Top6 (RPC ora accetta matchday_id per lega)
      const { data: t6 } = await supabase.rpc("get_top6_for_matchday", { p_league_matchday_id: md.id } as any);
      setTop6((t6 || []) as any);

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

      // pick già salvata? (matchday_id ora per lega)
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
        const playerMap = new Map<string, string>();
        [...a, ...b, ...c, ...d].forEach((p) => playerMap.set(p.id, p.name));
        setSavedNames({
          gk: playerMap.get((pick as any).gk_player_id) || "—",
          def: playerMap.get((pick as any).def_player_id) || "—",
          mid: playerMap.get((pick as any).mid_player_id) || "—",
          fwd: playerMap.get((pick as any).fwd_player_id) || "—",
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
    if (!gk || !def || !mid || !fwd) {
      setErr("Seleziona tutti e 4 i giocatori.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.rpc("save_picks", {
      p_matchday_id: matchday.id,
      p_gk: gk,
      p_def: def,
      p_mid: mid,
      p_fwd: fwd,
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
    router.refresh();
    // ricarico pagina
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
              I giocatori Top6 sono evidenziati con ⭐.
            </div>

            <label style={label}>Portiere</label>
            <select value={gk} onChange={(e) => setGk(e.target.value)} style={selectStyle}>
              <option value="">-- scegli --</option>
              {filterByRealTeam(gks, gk).map((p) => (
                <option key={p.id} value={p.id}>{optLabel(p)}</option>
              ))}
            </select>

            <label style={label}>Difensore</label>
            <select value={def} onChange={(e) => setDef(e.target.value)} style={selectStyle}>
              <option value="">-- scegli --</option>
              {filterByRealTeam(defs, def).map((p) => (
                <option key={p.id} value={p.id}>{optLabel(p)}</option>
              ))}
            </select>

            <label style={label}>Centrocampista</label>
            <select value={mid} onChange={(e) => setMid(e.target.value)} style={selectStyle}>
              <option value="">-- scegli --</option>
              {filterByRealTeam(mids, mid).map((p) => (
                <option key={p.id} value={p.id}>{optLabel(p)}</option>
              ))}
            </select>

            <label style={label}>Attaccante</label>
            <select value={fwd} onChange={(e) => setFwd(e.target.value)} style={selectStyle}>
              <option value="">-- scegli --</option>
              {filterByRealTeam(fwds, fwd).map((p) => (
                <option key={p.id} value={p.id}>{optLabel(p)}</option>
              ))}
            </select>

            <button className="btn btn-primary" style={{ marginTop: 16, width: "100%", padding: 12 }} onClick={save} disabled={saving}>
              {saving ? "Invio..." : "Invia rosa"}
            </button>
          </div>
        )}

        {/* Top6 sotto */}
        <div className="card" style={{ padding: 16, marginTop: 12, borderLeft: "6px solid var(--accent)" }}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Top 6 della giornata</div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
            Max 1 giocatore da queste squadre.
          </div>

          {top6.length === 0 ? (
            <div style={{ marginTop: 10, color: "var(--muted)", fontWeight: 800 }}>Top6 non impostata.</div>
          ) : (
            <div style={{ marginTop: 10, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr><th style={th}>#</th><th style={th}>Squadra</th></tr>
                </thead>
                <tbody>
                  {top6.slice().sort((a,b)=>a.rank-b.rank).map((r) => (
                    <tr key={r.real_team_id}>
                      <td style={td}><b>{r.rank}</b></td>
                      <td style={td}>{r.real_team_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {fixtures.length > 0 && (
  <div
    className="card"
    style={{
      padding: 16,
      marginTop: 12,
      borderLeft: "6px solid var(--primary)",
    }}
  >
    <div style={{ fontWeight: 1000, fontSize: 18 }}>
      Partite della giornata
    </div>

    <div style={{ marginTop: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {fixtures.map((f) => (
            <tr key={f.slot}>
              <td style={tdStyle}>{f.home_team}</td>
              <td style={{ ...tdStyle, textAlign: "center", fontWeight: 900 }}>
                -
              </td>
              <td style={tdStyle}>{f.away_team}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)}

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

const th: any = { textAlign: "left", padding: "10px 12px", borderBottom: "1px solid var(--border)", fontWeight: 900, background: "#f8fafc" };
const td: any = { padding: "10px 12px", borderBottom: "1px solid var(--border)", fontWeight: 800 };
const label: any = { fontWeight: 900, marginTop: 12, display: "block" };
const selectStyle: any = { width: "100%", padding: 12, marginTop: 6, borderRadius: 12, border: "1px solid var(--border)", fontWeight: 800, background: "white" };
const tdStyle = {
  padding: "8px 6px",
  borderBottom: "1px solid var(--border)",
  fontWeight: 900,
};