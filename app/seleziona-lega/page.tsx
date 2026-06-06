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

    if (error) {
      setRows([]);
      setErr(error.message);
      return;
    }

    setRows((data ?? []) as Row[]);
  }, []);

  useEffect(() => {
    if (!app.ready) return;

    if (!app.userId) {
      router.replace("/login");
      return;
    }

    loadLeagues();
  }, [app.ready, app.userId, router, loadLeagues]);

  async function select(id: string) {
    setErr(null);
    setMsg(null);

    const { error } = await supabase.rpc("set_active_league", {
      p_league_id: id,
    });

    if (error) {
      setErr(error.message);
      return;
    }

    await app.refresh();
    window.location.href = "/";
  }

  async function join() {
    setErr(null);
    setMsg(null);

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
    setCode("");
    setTeam("");

    await app.refresh();
    await loadLeagues();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <main style={s.page}>
      <div style={s.topBar}>
        <button type="button" onClick={() => router.push("/")} style={s.iconBtn} aria-label="Menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>

        <div style={s.logoWrap}>
          <div style={s.logo}>
            <span style={s.logoFanta}>Fanta</span>
            <span style={s.logoChat}>Chat</span>
          </div>
          <div style={s.payoff}>LA LEGGENDA CONTINUA</div>
        </div>

        <button type="button" onClick={logout} style={s.avatarBtn} aria-label="Esci">
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0116 0" />
          </svg>
        </button>
      </div>

      <section style={s.hero}>
        <h1 style={s.title}>Seleziona la tua lega</h1>
        <p style={s.subtitle}>
          Scegli la lega in cui vuoi entrare<br />
          e inizia la sfida ⚽
        </p>
      </section>

      <section style={s.section}>
        <div style={s.sectionTitle}>
          <span style={s.titleLine} />
          <span>Le tue leghe</span>
          <span style={s.titleLine} />
        </div>

        {err && <div style={s.err}>{err}</div>}
        {msg && <div style={s.ok}>{msg}</div>}

        {loading ? (
          <div style={s.empty}>Caricamento leghe...</div>
        ) : rows.length === 0 ? (
          <div style={s.empty}>Non sei ancora in nessuna lega.</div>
        ) : (
          <div style={s.list}>
            {rows.map((r, index) => {
              const active = r.league_id === app.activeLeagueId;

              return (
                <button
                  key={`${r.league_id}-${index}`}
                  type="button"
                  onClick={() => select(r.league_id)}
                  style={{
                    ...s.leagueCard,
                    ...(active ? s.leagueCardActive : {}),
                  }}
                >
                  <div style={s.crest}>
                    <span style={s.crestText}>FC</span>
                  </div>

                  <div style={s.leagueInfo}>
                    <div style={s.leagueName}>{r.league_name}</div>
                    <div style={s.leagueMeta}>
                      {r.team_name}
                      {typeof r.competition_count === "number"
                        ? ` · ${r.competition_count} competizioni`
                        : ""}
                    </div>

                    {active && <div style={s.activePill}>Lega attiva</div>}
                  </div>

                  <div style={s.rightIcon}>
                    {active ? (
                      <span style={s.checkCircle}>✓</span>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => router.push("/crea-lega")}
          style={s.createCard}
        >
          <div style={s.plusCircle}>+</div>
          <div style={{ flex: 1 }}>
            <div style={s.createTitle}>Crea nuova lega</div>
            <div style={s.createSub}>Diventa admin e invita i tuoi amici</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </section>

      <section style={s.joinCard}>
        <h2 style={s.joinTitle}>Entra in una lega</h2>
        <p style={s.joinSub}>Hai ricevuto un codice invito? Inseriscilo qui.</p>

        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Codice invito"
          style={{ ...s.input, letterSpacing: 2, textTransform: "uppercase" }}
        />

        <input
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          placeholder="Nome della tua squadra"
          style={s.input}
        />

        <button
          type="button"
          onClick={join}
          disabled={joining}
          style={{
            ...s.joinBtn,
            opacity: joining ? 0.65 : 1,
            cursor: joining ? "not-allowed" : "pointer",
          }}
        >
          {joining ? "Ingresso..." : "Entra nella lega"}
          <span style={{ fontSize: 20 }}>→</span>
        </button>
      </section>

      <section style={s.helpCard}>
        <div style={s.helpIcon}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
        </div>
        <div>
          <div style={s.helpTitle}>Non trovi la tua lega?</div>
          <div style={s.helpText}>
            Chiedi al presidente il codice invito per entrare nella lega.
          </div>
        </div>
      </section>

      <div style={s.waveGreen} />
      <div style={s.waveOrange} />
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    maxWidth: 520,
    margin: "0 auto",
    position: "relative",
    overflow: "hidden",
    padding: "18px 16px 34px",
    background:
      "radial-gradient(circle at 50% 0%, rgba(22,163,74,0.08), transparent 34%), #ffffff",
  },
  topBar: {
    display: "grid",
    gridTemplateColumns: "44px 1fr 44px",
    alignItems: "center",
    gap: 10,
    position: "relative",
    zIndex: 2,
  },
  iconBtn: {
    width: 42,
    height: 42,
    border: "none",
    background: "transparent",
    color: "#111827",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  },
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    color: "#6b7280",
    display: "grid",
    placeItems: "center",
    justifySelf: "end",
    cursor: "pointer",
  },
  logoWrap: {
    textAlign: "center",
  },
  logo: {
    fontFamily: "'Nunito', system-ui, sans-serif",
    fontSize: 34,
    fontWeight: 1000,
    letterSpacing: -1.2,
    lineHeight: 1,
  },
  logoFanta: {
    color: "#0f5132",
  },
  logoChat: {
    color: "#f97316",
  },
  payoff: {
    marginTop: 7,
    fontSize: 11,
    color: "#6b7280",
    fontWeight: 900,
    letterSpacing: "1.7px",
  },
  hero: {
    textAlign: "center",
    padding: "34px 10px 32px",
    position: "relative",
    zIndex: 2,
  },
  title: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1.08,
    color: "#052e1b",
    fontWeight: 1000,
    letterSpacing: -0.7,
  },
  subtitle: {
    margin: "14px 0 0",
    color: "#374151",
    fontWeight: 650,
    lineHeight: 1.5,
    fontSize: 15,
  },
  section: {
    position: "relative",
    zIndex: 2,
  },
  sectionTitle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    margin: "4px 0 18px",
    color: "#15803d",
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    fontSize: 13,
  },
  titleLine: {
    width: 36,
    height: 1,
    background: "linear-gradient(90deg, transparent, #16a34a)",
  },
  list: {
    display: "grid",
    gap: 12,
  },
  leagueCard: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "62px 1fr 34px",
    gap: 14,
    alignItems: "center",
    background: "rgba(255,255,255,0.94)",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 14,
    textAlign: "left",
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: "0 6px 18px rgba(15,23,42,0.06)",
  },
  leagueCardActive: {
    border: "1.5px solid #16a34a",
    background: "linear-gradient(90deg, rgba(22,163,74,0.06), rgba(255,255,255,0.96))",
  },
  crest: {
    width: 58,
    height: 58,
    borderRadius: 16,
    background: "linear-gradient(160deg,#14532d,#16a34a)",
    border: "2px solid rgba(250,204,21,0.72)",
    color: "white",
    display: "grid",
    placeItems: "center",
    boxShadow: "0 6px 18px rgba(22,163,74,0.22)",
  },
  crestText: {
    fontSize: 20,
    fontWeight: 1000,
    letterSpacing: -0.5,
  },
  leagueInfo: {
    minWidth: 0,
  },
  leagueName: {
    color: "#111827",
    fontSize: 16,
    fontWeight: 1000,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  leagueMeta: {
    marginTop: 4,
    color: "#4b5563",
    fontSize: 13,
    fontWeight: 700,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  activePill: {
    display: "inline-flex",
    marginTop: 8,
    padding: "3px 8px",
    borderRadius: 999,
    color: "#15803d",
    background: "#dcfce7",
    fontSize: 10,
    fontWeight: 1000,
    textTransform: "uppercase",
  },
  rightIcon: {
    color: "#111827",
    display: "grid",
    placeItems: "center",
  },
  checkCircle: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    background: "#16a34a",
    color: "white",
    display: "grid",
    placeItems: "center",
    fontSize: 17,
    fontWeight: 1000,
  },
  createCard: {
    marginTop: 14,
    width: "100%",
    display: "grid",
    gridTemplateColumns: "58px 1fr 24px",
    gap: 14,
    alignItems: "center",
    background: "rgba(255,255,255,0.7)",
    border: "1.5px dashed #d1d5db",
    borderRadius: 18,
    padding: 14,
    textAlign: "left",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  plusCircle: {
    width: 52,
    height: 52,
    borderRadius: "50%",
    background: "#f1f5f9",
    color: "#052e1b",
    display: "grid",
    placeItems: "center",
    fontSize: 32,
    lineHeight: 1,
  },
  createTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: 1000,
  },
  createSub: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: 700,
    marginTop: 3,
  },
  joinCard: {
    position: "relative",
    zIndex: 2,
    marginTop: 18,
    background: "rgba(255,255,255,0.96)",
    border: "1px solid #e5e7eb",
    borderRadius: 22,
    padding: 18,
    display: "grid",
    gap: 11,
    boxShadow: "0 8px 24px rgba(15,23,42,0.07)",
  },
  joinTitle: {
    margin: 0,
    color: "#052e1b",
    fontSize: 22,
    fontWeight: 1000,
  },
  joinSub: {
    margin: "-4px 0 4px",
    color: "#6b7280",
    fontWeight: 700,
    fontSize: 13,
  },
  input: {
    width: "100%",
    padding: "14px 15px",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#111827",
    fontSize: 14,
    fontWeight: 800,
    fontFamily: "inherit",
    outline: "none",
  },
  joinBtn: {
    width: "100%",
    padding: 15,
    border: "none",
    borderRadius: 14,
    background: "linear-gradient(135deg,#16a34a,#15803d)",
    color: "white",
    fontWeight: 1000,
    fontSize: 15,
    fontFamily: "inherit",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    boxShadow: "0 8px 20px rgba(22,163,74,0.26)",
  },
  helpCard: {
    position: "relative",
    zIndex: 2,
    marginTop: 16,
    display: "flex",
    gap: 13,
    alignItems: "center",
    background: "linear-gradient(135deg,rgba(240,253,244,0.98),rgba(255,255,255,0.95))",
    border: "1px solid #bbf7d0",
    borderRadius: 18,
    padding: 16,
  },
  helpIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    background: "#dcfce7",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },
  helpTitle: {
    color: "#15803d",
    fontWeight: 1000,
    fontSize: 15,
  },
  helpText: {
    color: "#374151",
    fontWeight: 650,
    fontSize: 13,
    lineHeight: 1.35,
    marginTop: 3,
  },
  ok: {
    color: "#15803d",
    background: "#f0fdf4",
    border: "1px solid #86efac",
    borderRadius: 12,
    padding: "10px 12px",
    fontWeight: 900,
  },
  err: {
    color: "#b85c0a",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: 12,
    padding: "10px 12px",
    fontWeight: 900,
  },
  empty: {
    color: "#6b7280",
    fontWeight: 800,
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 6px 18px rgba(15,23,42,0.05)",
  },
  waveGreen: {
    position: "absolute",
    left: "-28%",
    bottom: -80,
    width: "95%",
    height: 210,
    background: "linear-gradient(135deg,#16a34a,#14532d)",
    borderRadius: "50% 50% 0 0",
    transform: "rotate(-10deg)",
    opacity: 0.96,
    zIndex: 0,
  },
  waveOrange: {
    position: "absolute",
    left: "-34%",
    bottom: 12,
    width: "90%",
    height: 72,
    background: "#f97316",
    borderRadius: "50%",
    transform: "rotate(-10deg)",
    opacity: 0.9,
    zIndex: 0,
  },
};
