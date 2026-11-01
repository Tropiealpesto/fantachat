"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import LogoMark from "../components/LogoMark";
import { humanError, isEmailConfirmationError } from "../../lib/humanError";

type Mode = "login" | "signup" | "reset";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://fantachat-app.vercel.app").replace(/\/$/, "");
const RECOVERY_PENDING_KEY = "fantachat-password-recovery-pending";
const RECOVERY_PENDING_TTL_MS = 30 * 60 * 1000;

function markRecoveryPending() {
  try {
    window.localStorage.setItem(RECOVERY_PENDING_KEY, String(Date.now()));
  } catch {}
}

function hasRecoveryPending() {
  try {
    const value = Number(window.localStorage.getItem(RECOVERY_PENDING_KEY));
    if (!Number.isFinite(value) || Date.now() - value > RECOVERY_PENDING_TTL_MS) {
      window.localStorage.removeItem(RECOVERY_PENDING_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function clearRecoveryPending() {
  try { window.localStorage.removeItem(RECOVERY_PENDING_KEY); } catch {}
}

export default function LoginPage() {
  const router = useRouter();
  const recoveryModeRef = useRef(false);

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);
  const [confirmationCooldown, setConfirmationCooldown] = useState(0);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResetCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resetCooldown]);

  useEffect(() => {
    if (confirmationCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setConfirmationCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [confirmationCooldown]);

  useEffect(() => {
    let active = true;

    function isRecoveryUrl() {
      const search = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      return (
        search.get("recovery") === "1" ||
        search.get("type") === "recovery" ||
        hash.get("type") === "recovery" ||
        search.has("code")
      );
    }

    function isRecoveryFlow() {
      return isRecoveryUrl() || hasRecoveryPending();
    }

    function enterRecoveryMode() {
      if (!active) return;
      recoveryModeRef.current = true;
      setMode("reset");
      setPassword("");
      setErr(null);
      setMsg(null);
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || isRecoveryFlow()) {
        enterRecoveryMode();
        return;
      }

      if (event === "SIGNED_IN" && !recoveryModeRef.current && !isRecoveryFlow()) {
        router.replace("/seleziona-lega");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (isRecoveryFlow()) {
        enterRecoveryMode();
      } else if (session?.user && !recoveryModeRef.current) {
        router.replace("/seleziona-lega");
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  async function handleLogin() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) return setErr("Inserisci email e password.");

    setBusy(true); setErr(null); setMsg(null);

    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });

    if (error) {
      setNeedsEmailConfirmation(isEmailConfirmationError(error));
      setErr(humanError(error));
      setBusy(false);
      return;
    }

    setNeedsEmailConfirmation(false);
    clearRecoveryPending();
    try { await supabase.rpc("claim_invites_for_me"); } catch {}

    setBusy(false);
    router.replace("/seleziona-lega");
  }

  async function handleSignup() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) return setErr("Inserisci email e password.");
    if (password.length < 6) return setErr("La password deve avere almeno 6 caratteri.");

    setBusy(true); setErr(null); setMsg(null);

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { emailRedirectTo: `${APP_URL}/login` },
    });

    if (error) {
      setErr(humanError(error));
      setBusy(false);
      return;
    }

    if (!data.session) {
      setNeedsEmailConfirmation(true);
      setMode("login");
      setMsg("Account creato. Controlla la tua email e conferma l'account prima di accedere.");
      setBusy(false);
      return;
    }

    try { await supabase.rpc("claim_invites_for_me"); } catch {}

    setBusy(false);
    router.replace("/seleziona-lega");
  }

  async function handleResendConfirmation() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return setErr("Inserisci prima l'email.");
    if (confirmationCooldown > 0) return setErr(`Attendi ${confirmationCooldown} secondi prima di richiedere un'altra email.`);

    setBusy(true); setErr(null); setMsg(null);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: cleanEmail,
      options: { emailRedirectTo: `${APP_URL}/login` },
    });
    setBusy(false);
    setConfirmationCooldown(60);

    if (error) {
      setErr(humanError(error, "L'email di conferma è già stata inviata. Controlla anche la cartella spam e riprova più tardi."));
      return;
    }
    setMsg("Email di conferma inviata. Controlla anche la cartella spam.");
  }

  async function handleResetPassword() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return setErr("Inserisci prima l'email.");
    if (resetCooldown > 0) return setErr(`Attendi ${resetCooldown} secondi prima di richiedere un'altra email.`);

    setBusy(true); setErr(null); setMsg(null);

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${APP_URL}/login?recovery=1`,
    });

    setBusy(false);
    setResetCooldown(60);
    if (error) return setErr(humanError(error));
    markRecoveryPending();
    setMsg("Email inviata. Usa l'ultimo link ricevuto e non richiedere altri reset finché non è arrivato.");
  }

  async function handleUpdatePassword() {
    if (password.length < 6) return setErr("La password deve avere almeno 6 caratteri.");

    setBusy(true); setErr(null); setMsg(null);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErr(humanError(error, "Non è stato possibile aggiornare la password."));
      setBusy(false);
      return;
    }

    // Il link di recupero crea una sessione temporanea: dopo il cambio
    // password costringiamo l'utente a effettuare un accesso normale.
    await supabase.auth.signOut();
    recoveryModeRef.current = false;
    clearRecoveryPending();
    window.history.replaceState({}, document.title, "/login");
    setPassword("");
    setMode("login");
    setMsg("Password aggiornata. Ora accedi con la nuova password.");
    setBusy(false);
  }

  async function leaveRecoveryMode() {
    await supabase.auth.signOut();
    recoveryModeRef.current = false;
    clearRecoveryPending();
    window.history.replaceState({}, document.title, "/login");
    setPassword("");
    setMode("login");
    setErr(null);
    setMsg(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (mode === "reset") {
      await handleUpdatePassword();
    } else if (mode === "login") {
      await handleLogin();
    } else {
      await handleSignup();
    }
  }

  return (
    <main style={s.page}>
      <div style={s.card}>
        {/* Logo */}
        <div style={s.logoMark}>
          <LogoMark size={62} />
        </div>
        <div style={s.logo}>
          <span style={{ color: "#1a7a3e" }}>Fanta</span>
          <span style={{ color: "#e07b1a" }}>Chat</span>
        </div>
        <div style={s.tagline}>Il tuo fantacalcio, a modo tuo.</div>

        {mode !== "reset" && (
          <div style={s.tabBar}>
            <button type="button" onClick={() => { setMode("login"); setNeedsEmailConfirmation(false); setErr(null); setMsg(null); }} style={tabStyle(mode === "login")}>Accedi</button>
            <button type="button" onClick={() => { setMode("signup"); setNeedsEmailConfirmation(false); setErr(null); setMsg(null); }} style={tabStyle(mode === "signup")}>Crea account</button>
          </div>
        )}

        {mode === "reset" && (
          <div style={s.resetIntro}>
            <div style={s.resetTitle}>Imposta una nuova password</div>
            <div style={s.resetText}>Scegli una password di almeno 6 caratteri per il tuo account.</div>
          </div>
        )}

        <form onSubmit={submit}>
          <label style={s.label}>Email</label>
          <input autoCapitalize="none" autoCorrect="off" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@email.com" style={s.input} />

          <label style={{ ...s.label, marginTop: 14 }}>{mode === "reset" ? "Nuova password" : "Password"}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" || mode === "reset" ? "Almeno 6 caratteri" : "Inserisci la password"} style={s.input} />

          <button type="submit" disabled={busy} style={{ ...s.submitBtn, background: busy ? "#5a9e72" : "#1a7a3e", cursor: busy ? "not-allowed" : "pointer" }}>
            {busy ? "Attendi..." : mode === "reset" ? "Salva nuova password" : mode === "login" ? "Accedi" : "Crea account"}
          </button>
        </form>

        {mode === "login" && (
          <button type="button" onClick={handleResetPassword} disabled={busy || resetCooldown > 0} style={{ ...s.resetBtn, opacity: busy || resetCooldown > 0 ? 0.65 : 1, cursor: busy || resetCooldown > 0 ? "not-allowed" : "pointer" }}>
            {resetCooldown > 0 ? `Riprova tra ${resetCooldown}s` : "Password dimenticata?"}
          </button>
        )}

        {mode === "login" && needsEmailConfirmation && (
          <div style={s.confirmBox}>
            <span>Non hai ricevuto l'email? Non creare un altro account.</span>
            <button type="button" onClick={handleResendConfirmation} disabled={busy || confirmationCooldown > 0} style={s.confirmBtn}>
              {confirmationCooldown > 0 ? `Riprova tra ${confirmationCooldown}s` : "Invia di nuovo"}
            </button>
          </div>
        )}

        {mode === "reset" && (
          <button type="button" onClick={() => void leaveRecoveryMode()} disabled={busy} style={s.resetBack}>
            Torna all'accesso
          </button>
        )}

        {err && <div style={s.errBox}>{err}</div>}
        {msg && <div style={s.msgBox}>{msg}</div>}

        <div style={s.hint}>
          Dopo l'accesso vedrai le tue leghe se sei stato invitato, oppure potrai crearne una nuova.
        </div>

        <div style={s.legalLinks} aria-label="Link legali">
          <a href="/privacy" style={s.legalLink}>Privacy</a>
          <a href="/termini" style={s.legalLink}>Termini</a>
          <a href="/cancellazione-account" style={s.legalLink}>Cancella account</a>
        </div>
      </div>
    </main>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    border: "none", borderRadius: 9, padding: "10px 12px",
    fontFamily: "inherit", fontWeight: 800, fontSize: 14,
    background: active ? "#1a7a3e" : "transparent",
    color: active ? "white" : "#5a8a6e",
    cursor: "pointer", flex: 1,
  };
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh", display: "grid", alignItems: "center",
    padding: "0 16px",
  },
  card: {
    background: "white", borderRadius: 24, border: "1.5px solid #c8e6d4",
    padding: "28px 24px", maxWidth: 420, width: "100%", margin: "0 auto",
  },
  logoMark: { width: 74, height: 74, margin: "0 auto 12px", borderRadius: 18, background: "#fff", display: "grid", placeItems: "center", boxShadow: "0 10px 26px rgba(15,23,42,.08)" },
  logo: { fontSize: 28, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1, marginBottom: 6 },
  tagline: { fontSize: 13, color: "#5a8a6e", fontWeight: 700, marginBottom: 24 },
  resetIntro: { marginBottom: 18, padding: "12px 14px", borderRadius: 12, background: "#e8f5ee", border: "1px solid #c8e6d4" },
  resetTitle: { color: "#1a5c33", fontSize: 15, fontWeight: 900 },
  resetText: { marginTop: 4, color: "#5a8a6e", fontSize: 12, lineHeight: 1.4, fontWeight: 700 },
  tabBar: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4,
    background: "#e8f5ee", padding: 4, borderRadius: 12, marginBottom: 22,
  },
  label: {
    display: "block", fontSize: 12, fontWeight: 800, color: "#3a6b4e",
    textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6,
  },
  input: {
    width: "100%", padding: "12px 14px", border: "1.5px solid #c8e6d4",
    borderRadius: 12, fontSize: 14, fontWeight: 700,
    background: "#f0faf4", color: "#1a3d2a", boxSizing: "border-box",
    fontFamily: "inherit",
  },
  submitBtn: {
    marginTop: 18, width: "100%", padding: "14px 0",
    color: "white", border: "none", borderRadius: 12,
    fontSize: 15, fontWeight: 800, fontFamily: "inherit",
  },
  resetBtn: {
    marginTop: 10, width: "100%", padding: "13px 0",
    background: "white", color: "#5a8a6e",
    border: "1.5px solid #c8e6d4", borderRadius: 12,
    fontSize: 14, fontWeight: 800, cursor: "pointer",
    fontFamily: "inherit",
  },
  resetBack: {
    marginTop: 10, width: "100%", padding: "11px 0",
    background: "transparent", color: "#64748b", border: 0,
    fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
  },
  errBox: {
    marginTop: 14, background: "#fff4ea", border: "1px solid #f5c990",
    borderRadius: 10, padding: "10px 14px", color: "#b85c0a",
    fontWeight: 800, fontSize: 13,
  },
  msgBox: {
    marginTop: 14, background: "#e8f5ee", border: "1px solid #a3d9b8",
    borderRadius: 10, padding: "10px 14px", color: "#1a5c33",
    fontWeight: 800, fontSize: 13,
  },
  confirmBox: {
    display: "grid", gap: 7, marginTop: 12, padding: "10px 12px",
    background: "#fff8ed", border: "1px solid #f5c990", borderRadius: 10,
    color: "#8a5a18", fontSize: 12, lineHeight: 1.35, fontWeight: 800,
  },
  confirmBtn: {
    width: "100%", padding: "8px 10px", border: "1px solid #e7b66b",
    borderRadius: 9, background: "white", color: "#a45d0a", fontFamily: "inherit",
    fontSize: 12, fontWeight: 900, cursor: "pointer",
  },
  hint: {
    marginTop: 16, color: "#5a8a6e", fontWeight: 700, fontSize: 12,
    lineHeight: 1.5, textAlign: "center",
  },
  legalLinks: {
    display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10,
    marginTop: 16, paddingTop: 14, borderTop: "1px solid #e5e7eb",
  },
  legalLink: {
    color: "#64748b", fontSize: 11.5, fontWeight: 800, textDecoration: "none",
  },
};
