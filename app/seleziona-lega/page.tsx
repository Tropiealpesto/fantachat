"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../components/AppContext";
import { supabase } from "../../lib/supabaseClient";
import { humanError } from "../../lib/humanError";
import TutorialHelp from "../components/TutorialHelp";

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
    if (error) { setRows([]); setErr(humanError(error)); return; }
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
    if (error) { setErr(humanError(error)); return; }
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
    if (error) return setErr(humanError(error));
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
        <TutorialHelp compact />
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
        <div data-tutorial-target="league-list">
        {rows.map((r, index) => {
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
        })}
        </div>
      )}

      <button type="button" onClick={() => router.push("/crea-lega")} style={{ ...s.card, ...s.create }} data-tutorial-target="create-league">
        <span style={s.plus}>+</span>
        <span style={{ minWidth: 0 }}>
          <div style={s.ctitle}>Crea nuova lega</div>
          <div style={s.csub}>Diventa admin e invita gli amici</div>
        </span>
        <span style={{ ...s.chev, color: "#e07b1a" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg></span>
      </button>

      <div style={s.sec}>Entra con un codice</div>
      <div style={s.join} data-tutorial-target="join-form">
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
    minHeight: "100dvh", maxWidth: 600, margin: "0 auto", padding: "14px 16px 42px",
    color: "var(--fc-text, var(--text, #0f172a))",
    background: "linear-gradient(180deg, color-mix(in srgb, var(--fc-primary, #16a34a) 5%, var(--fc-page-bg, var(--bg, #f4f7f4))) 0, var(--fc-page-bg, var(--bg, #f4f7f4)) 240px)",
  },
  topbar: { display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 42 },
  logo: { fontFamily: "Nunito, sans-serif", fontSize: 23, fontWeight: 900, letterSpacing: "-.7px", lineHeight: 1 },
  logout: { width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--fc-border, var(--border, #e5e7eb))", background: "var(--fc-card-bg, var(--card, #fff))", color: "var(--fc-muted, var(--muted, #64748b))", display: "grid", placeItems: "center", cursor: "pointer" },
  h1: { fontFamily: "Nunito, sans-serif", fontSize: "clamp(28px, 7vw, 38px)", fontWeight: 900, letterSpacing: "-.8px", lineHeight: 1.05, color: "var(--fc-text, var(--text, #0f172a))", margin: "30px 2px 0" },
  accent: { width: 44, height: 3, borderRadius: 3, background: "linear-gradient(90deg,var(--fc-primary-dark, #15803d),var(--fc-accent, var(--brand-orange, #e07b1a)))", margin: "10px 2px 0" },
  sub: { maxWidth: 500, fontSize: 14, color: "var(--fc-muted, var(--muted, #64748b))", fontWeight: 600, lineHeight: 1.5, margin: "10px 2px 24px" },
  sec: { fontSize: 10, fontWeight: 900, color: "var(--fc-muted, var(--muted, #64748b))", textTransform: "uppercase", letterSpacing: ".1em", margin: "25px 2px 9px" },
  card: { width: "100%", display: "grid", gridTemplateColumns: "46px minmax(0, 1fr) 24px", gap: 12, alignItems: "center", background: "var(--fc-card-bg, var(--card, #fff))", color: "inherit", border: "1px solid var(--fc-border, var(--border, #e5e7eb))", borderRadius: 8, padding: "11px 12px", textAlign: "left", cursor: "pointer", fontFamily: "inherit", boxShadow: "0 7px 20px rgba(15,23,42,.055)", marginBottom: 8, transition: "border-color .18s ease, box-shadow .18s ease, transform .18s ease" },
  cardOn: { borderColor: "color-mix(in srgb, var(--fc-primary, #22c55e) 58%, var(--fc-border, #e5e7eb))", background: "color-mix(in srgb, var(--fc-primary, #22c55e) 7%, var(--fc-card-bg, #fff))", boxShadow: "0 0 0 2px color-mix(in srgb, var(--fc-primary, #22c55e) 13%, transparent), 0 9px 22px rgba(15,23,42,.07)" },
  crest: { width: 46, height: 46, borderRadius: 12, display: "grid", placeItems: "center", color: "#fff", fontWeight: 900, fontSize: 13, border: "2px solid rgba(255,255,255,.82)", boxShadow: "0 4px 9px rgba(15,23,42,.16)" },
  lname: { fontSize: 14, fontWeight: 900, color: "var(--fc-text, var(--text, #0f172a))", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  lmeta: { display: "flex", gap: 6, alignItems: "center", fontSize: 11.5, color: "var(--fc-muted, var(--muted, #64748b))", fontWeight: 700, marginTop: 3, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  pill: { display: "inline-flex", marginTop: 6, padding: "3px 7px", borderRadius: 999, color: "var(--fc-primary-dark, #15803d)", background: "color-mix(in srgb, var(--fc-primary, #22c55e) 14%, transparent)", fontSize: 9, fontWeight: 900, letterSpacing: ".03em", textTransform: "uppercase" },
  chev: { color: "var(--fc-muted, #94a3b8)", display: "grid", placeItems: "center" },
  check: { width: 25, height: 25, borderRadius: "50%", background: "var(--fc-primary-dark, #15803d)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 13, justifySelf: "center" },
  create: { border: "1px solid color-mix(in srgb, var(--fc-accent, var(--brand-orange, #e07b1a)) 40%, var(--fc-border, #e5e7eb))", background: "color-mix(in srgb, var(--fc-accent, var(--brand-orange, #e07b1a)) 7%, var(--fc-card-bg, #fff))", boxShadow: "none", marginBottom: 25 },
  plus: { width: 42, height: 42, borderRadius: 10, background: "color-mix(in srgb, var(--fc-accent, var(--brand-orange, #e07b1a)) 13%, transparent)", color: "var(--fc-accent, var(--brand-orange, #e07b1a))", display: "grid", placeItems: "center", fontSize: 24, lineHeight: 1 },
  ctitle: { fontSize: 13.5, fontWeight: 900, color: "var(--fc-text, var(--text, #0f172a))" },
  csub: { fontSize: 11.5, color: "var(--fc-muted, var(--muted, #64748b))", fontWeight: 700, marginTop: 3 },
  join: { background: "var(--fc-card-bg, var(--card, #fff))", border: "1px solid var(--fc-border, var(--border, #e5e7eb))", borderRadius: 8, padding: 15, boxShadow: "0 8px 22px rgba(15,23,42,.055)", marginTop: 0 },
  jtitle: { fontSize: 15, fontWeight: 900, color: "var(--fc-text, var(--text, #0f172a))", margin: 0 },
  jsub: { fontSize: 11.5, color: "var(--fc-muted, var(--muted, #64748b))", fontWeight: 600, lineHeight: 1.4, margin: "4px 0 14px" },
  input: { width: "100%", padding: "11px 12px", borderRadius: 7, border: "1px solid var(--fc-border, var(--border, #e5e7eb))", background: "var(--fc-page-bg, var(--bg, #f4f7f4))", color: "var(--fc-text, var(--text, #0f172a))", fontSize: 13, fontWeight: 700, fontFamily: "inherit", outline: "none", marginBottom: 9 },
  jbtn: { width: "100%", minHeight: 43, padding: "10px 14px", border: "none", borderRadius: 7, background: "var(--fc-primary-dark, #15803d)", color: "#fff", fontWeight: 800, fontSize: 13, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 8px 16px color-mix(in srgb, var(--fc-primary-dark, #15803d) 22%, transparent)", marginTop: 2 },
  help: { display: "flex", gap: 9, alignItems: "center", background: "transparent", border: "none", borderRadius: 0, padding: "2px 2px 0", marginTop: 15 },
  hicon: { width: 23, height: 23, borderRadius: "50%", background: "transparent", border: "1px solid color-mix(in srgb, var(--fc-primary, #22c55e) 44%, transparent)", color: "var(--fc-primary-dark, #15803d)", display: "grid", placeItems: "center", flexShrink: 0, fontSize: 13, fontWeight: 900 },
  htitle: { fontSize: 11.5, fontWeight: 800, color: "var(--fc-text, var(--text, #0f172a))" },
  htext: { fontSize: 11.5, color: "var(--fc-muted, var(--muted, #64748b))", fontWeight: 600, lineHeight: 1.35, marginTop: 1 },
  ok: { color: "var(--fc-primary-dark, #15803d)", background: "color-mix(in srgb, var(--fc-primary, #22c55e) 11%, var(--fc-card-bg, #fff))", border: "1px solid color-mix(in srgb, var(--fc-primary, #22c55e) 38%, transparent)", borderRadius: 8, padding: "11px 13px", fontWeight: 800, fontSize: 13, marginBottom: 16 },
  err: { color: "#b91c1c", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 8, padding: "11px 13px", fontWeight: 800, fontSize: 13, marginBottom: 16 },
  empty: { color: "var(--fc-muted, var(--muted, #64748b))", fontWeight: 700, background: "color-mix(in srgb, var(--fc-card-bg, #fff) 75%, transparent)", border: "1px dashed var(--fc-border, var(--border, #e5e7eb))", borderRadius: 8, padding: 16, marginBottom: 8 },
};
