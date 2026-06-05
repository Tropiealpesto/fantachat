"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { supabase } from "../../lib/supabaseClient";

export default function CreaLega() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [team, setTeam] = useState("La mia squadra");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [createdLeagueId, setCreatedLeagueId] = useState<string | null>(null);
  const [createdLeagueCompetitionId, setCreatedLeagueCompetitionId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.replace("/login");
      else setUserId(data.user.id);
    });
  }, [router]);

  async function create() {
    setErr(null);
    setMsg(null);
    setInviteCode(null);
    setCreatedLeagueId(null);
    setCreatedLeagueCompetitionId(null);

    if (!userId) return setErr("Utente non autenticato.");
    if (!name.trim() || !team.trim()) return setErr("Inserisci nome lega e squadra.");

    setBusy(true);

    const { data, error } = await supabase.rpc("create_league_with_default_competition", {
      p_league_name: name.trim(),
      p_team_name: team.trim(),
    });

    setBusy(false);

    if (error) return setErr(error.message);

    const result = Array.isArray(data) ? data[0] : data;

    const leagueId = result?.league_id ?? null;
    const leagueCompetitionId = result?.league_competition_id ?? null;
    const code = result?.invite_code ?? null;

    setCreatedLeagueId(leagueId);
    setCreatedLeagueCompetitionId(leagueCompetitionId);
    setInviteCode(code);

    setMsg("Lega creata ✅ Condividi il codice invito con i tuoi amici.");

    // La RPC dovrebbe già aggiornare user_context.
    // Facciamo comunque un refresh lato DB per sicurezza.
    if (leagueId) {
      try {
        await supabase.rpc("set_active_league", {
          p_league_id: leagueId,
        });
      } catch {}
    }

    if (leagueCompetitionId) {
      try {
        await supabase.rpc("set_active_competition", {
          p_league_competition_id: leagueCompetitionId,
        });
      } catch {}
    }

    // NON facciamo redirect automatico: prima mostriamo il codice.
  }

  async function copyCode() {
    if (!inviteCode) return;

    try {
      await navigator.clipboard.writeText(inviteCode);
      setMsg("Codice copiato ✅");
    } catch {
      setErr("Non riesco a copiarlo automaticamente. Copialo manualmente.");
    }
  }

  function goHome() {
    router.replace("/");
  }

  return (
    <>
      <AppBar league="FantaChat" team="Crea lega" />

      <main style={s.container}>
        <div style={s.card}>
          <h1 style={s.title}>Crea una nuova lega</h1>
          <p style={s.subtitle}>
            La lega è la community. Le competizioni interne si aggiungono dopo.
          </p>

          <label style={s.label}>Nome lega</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={s.input}
            disabled={!!inviteCode}
            placeholder="Es. Fantacalcio amici"
          />

          <label style={s.label}>Nome squadra</label>
          <input
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            style={s.input}
            disabled={!!inviteCode}
            placeholder="Es. La mia squadra"
          />

          {!inviteCode && (
            <button onClick={create} disabled={busy} style={s.btn}>
              {busy ? "Creazione..." : "Crea lega"}
            </button>
          )}

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

              <button onClick={goHome} style={s.goBtn}>
                Vai alla Home →
              </button>
            </div>
          )}

          {msg && <div style={s.ok}>{msg}</div>}
          {err && <div style={s.err}>{err}</div>}

          {createdLeagueId && (
            <div style={s.debugSmall}>
              Lega creata e impostata come attiva.
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 520,
    margin: "0 auto",
    padding: "16px 14px 100px",
  },
  card: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 16,
    display: "grid",
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 900,
    color: "#111827",
    margin: 0,
  },
  subtitle: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: 700,
    lineHeight: 1.5,
    margin: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: 800,
    color: "#374151",
    marginTop: 4,
  },
  input: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    fontWeight: 800,
    fontFamily: "inherit",
    fontSize: 14,
  },
  btn: {
    padding: 14,
    border: 0,
    borderRadius: 12,
    background: "#16a34a",
    color: "white",
    fontWeight: 900,
    fontFamily: "inherit",
    fontSize: 15,
    cursor: "pointer",
  },
  inviteBox: {
    marginTop: 8,
    padding: 16,
    borderRadius: 14,
    background: "#f0fdf4",
    border: "1.5px solid #86efac",
    textAlign: "center",
  },
  inviteTitle: {
    fontSize: 12,
    fontWeight: 900,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    marginBottom: 8,
  },
  inviteCode: {
    fontSize: 34,
    fontWeight: 1000,
    color: "#15803d",
    letterSpacing: 4,
    fontFamily: "monospace",
    marginBottom: 10,
  },
  inviteHint: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 1.5,
    fontWeight: 700,
    marginBottom: 12,
  },
  copyBtn: {
    width: "100%",
    padding: 12,
    border: 0,
    borderRadius: 10,
    background: "#16a34a",
    color: "white",
    fontWeight: 900,
    fontFamily: "inherit",
    marginBottom: 8,
    cursor: "pointer",
  },
  goBtn: {
    width: "100%",
    padding: 12,
    borderRadius: 10,
    border: "1.5px solid #16a34a",
    background: "white",
    color: "#16a34a",
    fontWeight: 900,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  ok: {
    color: "#15803d",
    fontWeight: 900,
    background: "#f0fdf4",
    border: "1px solid #86efac",
    borderRadius: 10,
    padding: "10px 12px",
  },
  err: {
    color: "#b85c0a",
    fontWeight: 900,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: 10,
    padding: "10px 12px",
  },
  debugSmall: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: 700,
    textAlign: "center",
  },
};