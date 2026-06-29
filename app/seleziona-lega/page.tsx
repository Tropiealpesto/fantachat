"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../components/AppContext";
import { supabase } from "../../lib/supabaseClient";

type Row = {
  league_id: string;
  league_name: string;
  team_name: string;
  role: string;
  active_league_competition_id?: string | null;
  competition_count?: number;
};

function hue(str: string) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360; return h; }
function crestBg(name?: string | null) { const h = hue(name ?? "x"); return `linear-gradient(135deg,hsl(${h},60%,55%),hsl(${(h + 28) % 360},62%,38%))`; }
function initials(name?: string | null) { const n = (name ?? "?").trim(); const p = n.split(/\s+/); return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase(); }

export default function SelezionaLega() {
  const app = useApp();
  const router = useRouter();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [team, setTeam] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const loadLeagues = useCallback(async () => {
    setErr(null);
    setLoading(true);
    const { data, error } = await supabase.rpc("get_my_leagues");
    setLoading(false);
    if (error) { setRows([]); setErr(error.message); return; }
    setRows((data ?? []) as Row[]);
  }, []);

  useEffect(() => {
    if (!app.ready) return;
    if (!app.userId) { router.replace("/login"); return; }
    void Promise.resolve().then(loadLeagues);
  }, [app.ready, app.userId, router, loadLeagues]);

  async function select(id: string) {
    setErr(null); setMsg(null);
    const { error } = await supabase.rpc("set_active_league", { p_league_id: id });
    if (error) { setErr(error.message); return; }
    await app.refresh();
    router.replace("/");
  }

  async function join() {
    setErr(null); setMsg(null);
    if (!code.trim()) return setErr("Inserisci il codice invito.");
    if (!team.trim()) return setErr("Inserisci il nome della tua squadra.");
    setJoining(true);
    const { error } = await supabase.rpc("join_league_with_code", {
      p_invite_code: code.trim().toUpperCase(),
      p_team_name: team.trim(),
    });
    setJoining(false);
    if (error) return setErr(error.message);
    setMsg("Sei entrato nella lega ✅");
    setCode(""); setTeam("");
    await app.refresh();
    await loadLeagues();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <main style={s.page}>
      <div style={s.topbar}>
        <div style={s.logo}><span style={{ color: "#15803d" }}>Fanta</span><span style={{ color: "#e07b1a" }}>Chat</span></div>
        <button type="button" onClick={logout} style={s.logout} aria-label="Esci">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
        </button>
      </div>

      <h1 style={s.h1}>Le tue leghe</h1>
      <div style={s.accent} />
      <p style={s.sub}>Scegli una lega per entrare, o creane una nuova.</p>

      {err && <div style={s.err}>{err}</div>}
      {msg && <div style={s.ok}>{msg}</div>}

      {loading ? (
        <div style={s.empty}>Caricamento leghe...</div>
      ) : rows.length === 0 ? (
        <div style={s.empty}>Non sei ancora in nessuna lega.</div>
      ) : (
        rows.map((r, index) => {
          const active = r.league_id === app.activeLeagueId;
          return (
            <button key={`${r.league_id}-${index}`} type="button" onClick={() => select(r.league_id)} style={{ ...s.card, ...(active ? s.cardOn : {}) }}>
              <span style={{ ...s.crest, background: crestBg(r.league_name) }}>{initials(r.league_name)}</span>
              <span style={{ minWidth: 0 }}>
                <div style={s.lname}>{r.league_name}</div>
                <div style={s.lmeta}>{r.team_name}{typeof r.competition_count === "number" ? ` · ${r.competition_count} competizioni` : ""}</div>
                {active && <div style={s.pill}>Lega attiva</div>}
              </span>
              {active ? (
                <span style={s.check}>✓</span>
              ) : (
                <span style={s.chev}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg></span>
              )}
            </button>
          );
        })
      )}

      <button type="button" onClick={() => router.push("/crea-lega")} style={{ ...s.card, ...s.create }}>
        <span style={s.plus}>+</span>
        <span style={{ minWidth: 0 }}>
          <div style={s.ctitle}>Crea nuova lega</div>
          <div style={s.csub}>Diventa admin e invita gli amici</div>
        </span>
        <span style={{ ...s.chev, color: "#e07b1a" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg></span>
      </button>

      <div style={s.sec}>Entra con un codice</div>
      <div style={s.join}>
        <h2 style={s.jtitle}>Hai un codice invito?</h2>
        <p style={s.jsub}>Inseriscilo qui per unirti alla lega.</p>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CODICE INVITO" style={{ ...s.input, letterSpacing: 2, textTransform: "uppercase" }} />
        <input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Nome della tua squadra" style={s.input} />
        <button type="button" onClick={join} disabled={joining} style={{ ...s.jbtn, opacity: joining ? 0.65 : 1, cursor: joining ? "not-allowed" : "pointer" }}>
          {joining ? "Ingresso..." : "Entra nella lega"}<span style={{ fontSize: 18 }}>→</span>
        </button>
      </div>

      <div style={s.help}>
        <div style={s.hicon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <div>
          <div style={s.htitle}>Non trovi la tua lega?</div>
          <div style={s.htext}>Chiedi al presidente il codice invito per entrare.</div>
        </div>
      </div>
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh", maxWidth: 520, margin: "0 auto", padding: "16px 14px 40px",
    background: "radial-gradient(circle at 88% 2%, rgba(224,123,26,.10), transparent 32%), radial-gradient(circle at 10% 1%, rgba(21,128,61,.08), transparent 30%), #f6f7f9",
  },
  topbar: { display: "flex", alignItems: "center", gap: 10, padding: "6px 4px 4px" },
  logo: { fontSize: 22, fontWeight: 1000, letterSpacing: "-.5px" },
  logout: { marginLeft: "auto", width: 38, height: 38, borderRadius: "50%", border: "1px solid #e5e7eb", background: "#fff", color: "#64748b", display: "grid", placeItems: "center", cursor: "pointer" },
  h1: { fontSize: 22, fontWeight: 1000, color: "#0f172a", margin: "18px 2px 0" },
  accent: { width: 40, height: 3.5, borderRadius: 3, background: "linear-gradient(90deg,#15803d,#e07b1a)", margin: "7px 2px 0" },
  sub: { fontSize: 13, color: "#64748b", fontWeight: 700, margin: "9px 2px 14px" },
  sec: { fontSize: 10.5, fontWeight: 1000, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em", margin: "18px 4px 9px" },
  card: { width: "100%", display: "grid", gridTemplateColumns: "48px 1fr 24px", gap: 12, alignItems: "center", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 12, textAlign: "left", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 22px rgba(15,23,42,.06)", marginBottom: 9 },
  cardOn: { borderColor: "#15803d", background: "#f3fbf5" },
  crest: { width: 48, height: 48, borderRadius: 14, display: "grid", placeItems: "center", color: "#fff", fontWeight: 900, fontSize: 14, border: "2px solid #fff", boxShadow: "0 3px 8px rgba(0,0,0,.16)" },
  lname: { fontSize: 15, fontWeight: 1000, color: "#0f172a", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  lmeta: { fontSize: 12, color: "#64748b", fontWeight: 700, marginTop: 2, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  pill: { display: "inline-flex", marginTop: 6, padding: "2px 8px", borderRadius: 999, color: "#15803d", background: "#dcfce7", fontSize: 9.5, fontWeight: 1000, textTransform: "uppercase" },
  chev: { color: "#cbd5e1", display: "grid", placeItems: "center" },
  check: { width: 28, height: 28, borderRadius: "50%", background: "#15803d", color: "#fff", display: "grid", placeItems: "center", fontWeight: 1000, fontSize: 15, justifySelf: "center" },
  create: { border: "1px dashed #fdba74", background: "#fff8f3", boxShadow: "none" },
  plus: { width: 48, height: 48, borderRadius: 14, background: "#fff3e4", color: "#e07b1a", display: "grid", placeItems: "center", fontSize: 26, lineHeight: 1 },
  ctitle: { fontSize: 15, fontWeight: 1000, color: "#0f172a" },
  csub: { fontSize: 12, color: "#64748b", fontWeight: 700, marginTop: 2 },
  join: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 20, padding: 16, boxShadow: "0 8px 22px rgba(15,23,42,.06)", marginTop: 4 },
  jtitle: { fontSize: 17, fontWeight: 1000, color: "#0f172a", margin: 0 },
  jsub: { fontSize: 12.5, color: "#64748b", fontWeight: 700, margin: "4px 0 12px" },
  input: { width: "100%", padding: "13px 15px", borderRadius: 14, border: "1px solid #e5e7eb", background: "#fff", color: "#0f172a", fontSize: 14, fontWeight: 800, fontFamily: "inherit", outline: "none", marginBottom: 9 },
  jbtn: { width: "100%", padding: 14, border: "none", borderRadius: 14, background: "#15803d", color: "#fff", fontWeight: 800, fontSize: 15, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 10px 22px rgba(21,128,61,.24)", marginTop: 2 },
  help: { display: "flex", gap: 12, alignItems: "center", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 18, padding: 14, marginTop: 14 },
  hicon: { width: 40, height: 40, borderRadius: "50%", background: "#dcfce7", display: "grid", placeItems: "center", flexShrink: 0 },
  htitle: { fontSize: 14, fontWeight: 1000, color: "#15803d" },
  htext: { fontSize: 12.5, color: "#374151", fontWeight: 650, lineHeight: 1.35, marginTop: 2 },
  ok: { color: "#15803d", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 14, padding: "10px 12px", fontWeight: 800, marginBottom: 10 },
  err: { color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 14, padding: "10px 12px", fontWeight: 800, marginBottom: 10 },
  empty: { color: "#64748b", fontWeight: 800, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 18, padding: 16, boxShadow: "0 8px 22px rgba(15,23,42,.06)", marginBottom: 9 },
};
