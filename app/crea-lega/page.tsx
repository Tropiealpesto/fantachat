"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";

export default function CreaLegaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [leagueName, setLeagueName] = useState("");
  const [myTeamName, setMyTeamName] = useState("La mia squadra");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return router.replace("/login");
      setUserId(data.user.id);
      setLoading(false);
    }
    run();
  }, [router]);

  async function createLeague() {
    setErr(null); setMsg(null); setInviteCode(null);

    if (leagueName.trim().length < 2) return setErr("Inserisci un nome per la lega.");
    if (myTeamName.trim().length < 1) return setErr("Inserisci un nome per la tua squadra.");
    if (!userId) return setErr("Non autenticato.");

    setBusy(true);

    try {
      // 1) Competizione default
      const { data: comp, error: e1 } = await supabase
        .from("competitions")
        .insert({ name: "Serie A", slug: "serie-a-" + Date.now() })
        .select("id")
        .single();
      if (e1) throw e1;

      // 2) Config
      const { error: e2 } = await supabase
        .from("competition_config")
        .insert({
          competition_id: comp.id,
          roles: [
            { key: "P", label: "Portiere" },
            { key: "D", label: "Difensore" },
            { key: "C", label: "Centrocampista" },
            { key: "A", label: "Attaccante" },
          ],
          players_per_role: { P: 1, D: 1, C: 1, A: 1 },
        });
      if (e2) throw e2;

      // 3) Stagione
      const { data: season, error: e3 } = await supabase
        .from("seasons")
        .insert({
          competition_id: comp.id,
          name: "2025/26",
          total_matchdays: 38,
        })
        .select("id")
        .single();
      if (e3) throw e3;

      // 4) Lega (invite_code generato automaticamente dal DB)
      const { data: league, error: e4 } = await supabase
        .from("leagues")
        .insert({
          season_id: season.id,
          name: leagueName.trim(),
        })
        .select("id, invite_code")
        .single();
      if (e4) throw e4;

      // 5) Aggiungi me come admin
      const { error: e5 } = await supabase
        .from("league_members")
        .insert({
          league_id: league.id,
          user_id: userId,
          team_name: myTeamName.trim(),
          role: "admin",
        });
      if (e5) throw e5;

      // 6) Imposta come lega attiva
      const { error: e6 } = await supabase.rpc("set_active_league", {
        p_league_id: league.id,
      });
      if (e6) throw e6;

      setBusy(false);
      setInviteCode(league.invite_code);
      setMsg("Lega creata ✅ Condividi il codice invito con i tuoi amici!");

    } catch (e: any) {
      setBusy(false);
      setErr(e?.message || String(e));
    }
  }

  async function copyCode() {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setMsg("Codice copiato ✅");
    } catch {
      setErr("Copia manualmente il codice.");
    }
  }

  if (loading) return <main style={{ padding: 20 }}>Caricamento...</main>;

  return (
    <>
      <AppBar league="FantaChat" team="Crea nuova lega" />
      <main style={s.container}>
        <div style={s.card}>
          <div style={s.title}>Crea una nuova lega</div>
          <div style={s.subtitle}>
            Crea la lega, poi condividi il codice invito con i tuoi amici.
          </div>

          {/* Nome lega */}
          <div style={s.label}>Nome lega</div>
          <input
            value={leagueName}
            onChange={(e) => setLeagueName(e.target.value)}
            placeholder="Es. Fantacalcio con gli amici"
            style={s.input}
          />

          {/* Nome mia squadra */}
          <div style={{ ...s.label, marginTop: 14 }}>Nome della tua squadra</div>
          <input
            value={myTeamName}
            onChange={(e) => setMyTeamName(e.target.value)}
            placeholder="Es. Hapoel Kann"
            style={s.input}
          />

          {/* Bottone crea */}
          <button
            onClick={createLeague}
            disabled={busy}
            style={{
              ...s.submitBtn,
              opacity: busy ? 0.6 : 1,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Creazione..." : "Crea lega"}
          </button>

          {/* Codice invito */}
          {inviteCode && (
            <div style={s.inviteBox}>
              <div style={s.inviteTitle}>Codice invito</div>
              <div style={s.inviteCode}>{inviteCode}</div>
              <div style={s.inviteHint}>
                I tuoi amici dovranno registrarsi su FantaChat e inserire questo codice per unirsi alla lega.
              </div>
              <button onClick={copyCode} style={s.copyBtn}>
                Copia codice
              </button>
              <button
                onClick={() => router.replace("/")}
                style={s.goBtn}
              >
                Vai alla Home →
              </button>
            </div>
          )}

          {msg && <div style={s.msgBox}>{msg}</div>}
          {err && <div style={s.errBox}>{err}</div>}
        </div>
      </main>
      <BottomNav />
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 520, margin: "0 auto",
    padding: "16px 14px calc(64px + env(safe-area-inset-bottom, 0px) + 20px)",
  },
  card: {
    background: "white", borderRadius: 18, padding: 16,
    border: "1px solid #e5e7eb",
  },
  title: { fontSize: 22, fontWeight: 800, color: "#111827" },
  subtitle: { fontSize: 13, color: "#6b7280", fontWeight: 600, marginTop: 4, marginBottom: 16, lineHeight: 1.5 },
  label: { fontWeight: 800, color: "#111827", fontSize: 14, marginBottom: 6 },
  input: {
    width: "100%", padding: 12, borderRadius: 12,
    border: "1px solid #e5e7eb", fontWeight: 700,
    fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" as const,
  },
  submitBtn: {
    marginTop: 16, width: "100%", padding: 14,
    background: "linear-gradient(135deg, #16a34a, #15803d)",
    color: "white", border: "none", borderRadius: 12,
    fontSize: 15, fontWeight: 700, fontFamily: "inherit",
  },
  inviteBox: {
    marginTop: 16, padding: 16, borderRadius: 14,
    background: "#f0fdf4", border: "1.5px solid #86efac",
    textAlign: "center" as const,
  },
  inviteTitle: {
    fontSize: 12, fontWeight: 700, color: "#6b7280",
    textTransform: "uppercase" as const, letterSpacing: "0.5px", marginBottom: 8,
  },
  inviteCode: {
    fontSize: 32, fontWeight: 900, color: "#15803d",
    letterSpacing: 4, marginBottom: 10, fontFamily: "monospace",
  },
  inviteHint: {
    fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 12,
  },
  copyBtn: {
    width: "100%", padding: 12, background: "#16a34a",
    color: "white", border: "none", borderRadius: 10,
    fontSize: 14, fontWeight: 700, cursor: "pointer",
    fontFamily: "inherit", marginBottom: 8,
  },
  goBtn: {
    width: "100%", padding: 12, background: "white",
    color: "#16a34a", border: "1.5px solid #16a34a", borderRadius: 10,
    fontSize: 14, fontWeight: 700, cursor: "pointer",
    fontFamily: "inherit",
  },
  msgBox: {
    marginTop: 12, background: "#f0fdf4", border: "1px solid #86efac",
    borderRadius: 10, padding: "10px 14px", color: "#15803d",
    fontWeight: 800, fontSize: 13,
  },
  errBox: {
    marginTop: 12, background: "#fff4ea", border: "1px solid #f5c990",
    borderRadius: 10, padding: "10px 14px", color: "#b85c0a",
    fontWeight: 800, fontSize: 13,
  },
};