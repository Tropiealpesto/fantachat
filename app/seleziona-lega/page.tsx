"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { useApp } from "../components/AppContext";

type LeagueRow = {
  league_id: string;
  league_name: string;
  team_name: string;
  role: string;
};

export default function SelezionaLegaPage() {
  const router = useRouter();
  const { ready, userId, openDrawer, setActiveLeague } = useApp();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LeagueRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Join con codice
  const [inviteCode, setInviteCode] = useState("");
  const [joinTeamName, setJoinTeamName] = useState("");
  const [joining, setJoining] = useState(false);

  const [os, setOs] = useState<"ios" | "android">("ios");

  async function loadLeagues() {
    if (!userId) return;

    const { data, error } = await supabase
      .from("league_members")
      .select("league_id, team_name, role, leagues!inner(name)")
      .eq("user_id", userId);

    if (error) setErr(error.message);

    const parsed: LeagueRow[] = ((data ?? []) as any[]).map((r) => ({
      league_id: r.league_id,
      league_name: r.leagues?.name ?? "Lega",
      team_name: r.team_name ?? "Squadra",
      role: r.role ?? "player",
    }));

    setRows(parsed);
  }

  useEffect(() => {
    async function run() {
      if (!ready) return;
      if (!userId) return router.replace("/login");
      setLoading(true);
      await loadLeagues();
      setLoading(false);
    }
    run();
  }, [ready, userId, router]);

  async function selectLeague(leagueId: string) {
    setErr(null); setMsg(null);
    await setActiveLeague(leagueId);
    setMsg("Lega selezionata ✅");
    setTimeout(() => { window.location.href = "/"; }, 150);
  }

  async function joinWithCode() {
    setErr(null); setMsg(null);

    const code = inviteCode.trim();
    const teamName = joinTeamName.trim();

    if (!code) return setErr("Inserisci il codice invito.");
    if (!teamName) return setErr("Inserisci il nome della tua squadra.");
    if (!userId) return setErr("Non autenticato.");

    setJoining(true);

    try {
      // 1) Trova la lega con questo codice
      const { data: league, error: leagueErr } = await supabase
        .from("leagues")
        .select("id, name")
        .eq("invite_code", code)
        .maybeSingle();

      if (leagueErr) throw leagueErr;
      if (!league) {
        setJoining(false);
        return setErr("Codice invito non valido.");
      }

      // 2) Controlla se già membro
      const { data: existing } = await supabase
        .from("league_members")
        .select("id")
        .eq("league_id", league.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        setJoining(false);
        return setErr("Sei già membro di questa lega.");
      }

      // 3) Aggiungi come player
      const { error: joinErr } = await supabase
        .from("league_members")
        .insert({
          league_id: league.id,
          user_id: userId,
          team_name: teamName,
          role: "player",
        });

      if (joinErr) throw joinErr;

      // 4) Imposta come lega attiva
      await setActiveLeague(league.id);

      setJoining(false);
      setMsg(`Entrato in "${league.name}" ✅`);
      setInviteCode("");
      setJoinTeamName("");
      await loadLeagues();

    } catch (e: any) {
      setJoining(false);
      setErr(e?.message || String(e));
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!ready || loading) return <main style={{ padding: 20 }}>Caricamento...</main>;

  return (
    <>
      <AppBar
        league="FantaChat"
        team="Seleziona lega"
        right={<button onClick={logout} style={s.logoutBtn}>Esci</button>}
      />

      <main style={s.container}>
        <h1 style={s.title}>Le tue leghe</h1>
        <p style={s.subtitle}>Scegli la lega attiva o unisciti a una nuova.</p>

        {err && <div style={s.errMsg}>{err}</div>}
        {msg && <div style={s.successMsg}>{msg}</div>}

        {/* Lista leghe */}
        <div style={s.list}>
          {rows.length === 0 ? (
            <div style={s.empty}>Non sei ancora in nessuna lega.</div>
          ) : (
            rows.map((r, i) => (
              <button key={i} style={s.leagueItem} onClick={() => selectLeague(r.league_id)}>
                <div style={s.leagueDot}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a7a3e" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
                  </svg>
                </div>
                <div style={s.leagueInfo}>
                  <div style={s.leagueName}>{r.league_name}</div>
                  <div style={s.leagueMeta}>{r.team_name}</div>
                </div>
                <span style={s.roleBadge}>{r.role.toUpperCase()}</span>
                <span style={{ color: "#aaa", fontSize: 16 }}>›</span>
              </button>
            ))
          )}
        </div>

        {/* Crea nuova lega */}
        <a href="/crea-lega" style={s.createBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Crea nuova lega
        </a>

        {/* Divider */}
        <div style={s.divider}>
          <div style={s.dividerLine} /><span style={s.dividerText}>Oppure</span><div style={s.dividerLine} />
        </div>

        {/* Unisciti con codice */}
        <div style={s.joinCard}>
          <div style={s.joinTitle}>Entra in una lega</div>
          <div style={s.joinHint}>Inserisci il codice invito che ti ha dato l'admin della lega.</div>

          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="Codice invito"
            style={{ ...s.input, textAlign: "center", letterSpacing: 3, fontSize: 18, fontWeight: 900, fontFamily: "monospace" }}
          />

          <input
            value={joinTeamName}
            onChange={(e) => setJoinTeamName(e.target.value)}
            placeholder="Nome della tua squadra"
            style={{ ...s.input, marginTop: 10 }}
          />

          <button
            onClick={joinWithCode}
            disabled={joining}
            style={{
              ...s.joinBtn,
              opacity: joining ? 0.6 : 1,
              cursor: joining ? "not-allowed" : "pointer",
            }}
          >
            {joining ? "Entro..." : "Entra nella lega"}
          </button>
        </div>

        {/* Divider */}
        <div style={s.divider}>
          <div style={s.dividerLine} /><span style={s.dividerText}>Aggiungi alla home</span><div style={s.dividerLine} />
        </div>

        {/* Installa PWA */}
        <div style={s.installCard}>
          <div style={s.installHeader}>
            <div style={s.installIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <rect x="5" y="2" width="14" height="20" rx="2" />
                <line x1="12" y1="18" x2="12" y2="18" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p style={s.installTitle}>Installa l'app sul telefono</p>
              <p style={s.installSub}>Accesso rapido dalla home screen</p>
            </div>
          </div>

          <div style={s.osTab}>
            <button style={osTabStyle(os === "ios")} onClick={() => setOs("ios")}>iPhone (Safari)</button>
            <button style={osTabStyle(os === "android")} onClick={() => setOs("android")}>Android (Chrome)</button>
          </div>

          <div style={s.steps}>
            {os === "ios" ? (
              <>
                <Step n={1} label="Apri Safari" desc="Assicurati di usare Safari." />
                <Step n={2} label='Tocca "Condividi"' desc="L'icona nella barra in basso." />
                <Step n={3} label="Aggiungi a Home" desc='"Aggiungi a Home" e conferma.' />
              </>
            ) : (
              <>
                <Step n={1} label="Apri Chrome" desc="Usa Google Chrome." />
                <Step n={2} label="Menu ⋮" desc="Tre puntini in alto a destra." />
                <Step n={3} label="Aggiungi a Home" desc='"Aggiungi a schermata Home".' />
              </>
            )}
          </div>
        </div>
      </main>

      <BottomNav />
    </>
  );
}

function Step({ n, label, desc }: { n: number; label: string; desc: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div style={s.stepNum}>{n}</div>
      <div>
        <p style={s.stepLabel}>{label}</p>
        <p style={s.stepDesc}>{desc}</p>
      </div>
    </div>
  );
}

function osTabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, padding: "7px 0", fontSize: 12, fontWeight: 800,
    borderRadius: 8, border: active ? "1px solid #e07b1a" : "1px solid #e5e7eb",
    background: active ? "#e07b1a" : "white", color: active ? "white" : "#888",
    cursor: "pointer", fontFamily: "inherit",
  };
}

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 480, margin: "0 auto",
    padding: "16px 16px calc(64px + env(safe-area-inset-bottom, 0px) + 20px)",
  },
  title: { fontSize: 22, fontWeight: 900, color: "#111827", margin: "0 0 4px" },
  subtitle: { fontSize: 13, color: "#6b7280", margin: "0 0 16px", fontWeight: 700 },
  logoutBtn: {
    fontSize: 14, color: "#e07b1a", background: "#fff4ea",
    border: "1px solid #f5c990", borderRadius: 20,
    padding: "5px 14px", cursor: "pointer", fontWeight: 800, fontFamily: "inherit",
  },
  list: { display: "grid", gap: 10, marginBottom: 14 },
  empty: { color: "#6b7280", fontWeight: 800, fontSize: 14, padding: "8px 0" },
  leagueItem: {
    display: "flex", alignItems: "center", gap: 12,
    background: "white", border: "1px solid #e5e7eb",
    borderRadius: 14, padding: "13px 15px",
    cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit",
  },
  leagueDot: {
    width: 36, height: 36, borderRadius: 10, background: "#e8f5ee",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  leagueInfo: { flex: 1, minWidth: 0 },
  leagueName: { fontSize: 14, fontWeight: 800, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  leagueMeta: { fontSize: 12, color: "#6b7280", marginTop: 2, fontWeight: 700 },
  roleBadge: {
    fontSize: 10, fontWeight: 800, background: "#fff4ea",
    color: "#e07b1a", padding: "2px 8px", borderRadius: 20,
    border: "1px solid #f5c990", flexShrink: 0,
  },
  createBtn: {
    width: "100%", padding: 15, background: "#1a7a3e",
    color: "white", borderRadius: 14, fontSize: 15, fontWeight: 800,
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 8, marginBottom: 20, textDecoration: "none",
  },
  divider: { display: "flex", alignItems: "center", gap: 10, marginBottom: 18 },
  dividerLine: { flex: 1, height: 1, background: "#e5e7eb" },
  dividerText: { fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 800 },
  joinCard: {
    background: "white", border: "1.5px solid #c8e6d4",
    borderRadius: 16, padding: 16, marginBottom: 20,
  },
  joinTitle: { fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 4 },
  joinHint: { fontSize: 12, color: "#6b7280", fontWeight: 600, marginBottom: 12, lineHeight: 1.5 },
  input: {
    width: "100%", padding: 12, borderRadius: 12,
    border: "1px solid #e5e7eb", fontWeight: 700,
    fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" as const,
  },
  joinBtn: {
    marginTop: 12, width: "100%", padding: 13,
    background: "#16a34a", color: "white", border: "none",
    borderRadius: 12, fontSize: 14, fontWeight: 700,
    fontFamily: "inherit",
  },
  installCard: { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 },
  installHeader: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 },
  installIcon: { width: 38, height: 38, background: "#e07b1a", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  installTitle: { fontSize: 14, fontWeight: 800, color: "#111827", margin: 0 },
  installSub: { fontSize: 12, color: "#6b7280", margin: "2px 0 0", fontWeight: 700 },
  osTab: { display: "flex", gap: 6, marginBottom: 14 },
  steps: { display: "flex", flexDirection: "column", gap: 10 },
  stepNum: { width: 22, height: 22, borderRadius: "50%", background: "#e07b1a", color: "white", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  stepLabel: { fontSize: 13, fontWeight: 800, color: "#111827", margin: "0 0 2px" },
  stepDesc: { fontSize: 12, color: "#6b7280", margin: 0, fontWeight: 700 },
  errMsg: { marginBottom: 12, padding: "10px 14px", background: "#fff4ea", border: "1px solid #f5c990", borderRadius: 10, color: "#b85c0a", fontWeight: 800, fontSize: 13 },
  successMsg: { marginBottom: 12, padding: "10px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, color: "#15803d", fontWeight: 800, fontSize: 13 },
};