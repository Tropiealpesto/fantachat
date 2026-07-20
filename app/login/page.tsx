"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import LogoMark from "../components/LogoMark";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) router.replace("/seleziona-lega");
    }
    checkSession();
  }, [router]);

  async function handleLogin() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) return setErr("Inserisci email e password.");

    setBusy(true); setErr(null); setMsg(null);

    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });

    if (error) {
      const lower = (error.message || "").toLowerCase();
      setErr(lower.includes("invalid login credentials")
        ? "Email non registrata o password non corretta."
        : error.message);
      setBusy(false);
      return;
    }

    try { await supabase.rpc("claim_invites_for_me"); } catch {}

    setBusy(false);
    router.replace("/seleziona-lega");
  }

  async function handleSignup() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) return setErr("Inserisci email e password.");
    if (password.length < 6) return setErr("La password deve avere almeno 6 caratteri.");

    setBusy(true); setErr(null); setMsg(null);

    const { error } = await supabase.auth.signUp({ email: cleanEmail, password });

    if (error) {
      const lower = (error.message || "").toLowerCase();
      setErr(lower.includes("already registered") || lower.includes("already been registered")
        ? "Email già registrata."
        : error.message);
      setBusy(false);
      return;
    }

    // Auto-login dopo signup
    const { error: loginErr } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });

    if (loginErr) {
      setMsg("Account creato. Ora accedi con email e password.");
      setMode("login");
      setBusy(false);
      return;
    }

    try { await supabase.rpc("claim_invites_for_me"); } catch {}

    setBusy(false);
    router.replace("/seleziona-lega");
  }

  async function handleResetPassword() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return setErr("Inserisci prima l'email.");

    setBusy(true); setErr(null); setMsg(null);

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/login`,
    });

    setBusy(false);
    if (error) return setErr(error.message);
    setMsg("Ti abbiamo inviato una mail per reimpostare la password.");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    mode === "login" ? await handleLogin() : await handleSignup();
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

        {/* Tab */}
        <div style={s.tabBar}>
          <button type="button" onClick={() => { setMode("login"); setErr(null); setMsg(null); }} style={tabStyle(mode === "login")}>Accedi</button>
          <button type="button" onClick={() => { setMode("signup"); setErr(null); setMsg(null); }} style={tabStyle(mode === "signup")}>Crea account</button>
        </div>

        <form onSubmit={submit}>
          <label style={s.label}>Email</label>
          <input autoCapitalize="none" autoCorrect="off" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@email.com" style={s.input} />

          <label style={{ ...s.label, marginTop: 14 }}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "signup" ? "Almeno 6 caratteri" : "Inserisci la password"} style={s.input} />

          <button type="submit" disabled={busy} style={{ ...s.submitBtn, background: busy ? "#5a9e72" : "#1a7a3e", cursor: busy ? "not-allowed" : "pointer" }}>
            {busy ? "Attendi..." : mode === "login" ? "Accedi" : "Crea account"}
          </button>
        </form>

        {mode === "login" && (
          <button type="button" onClick={handleResetPassword} disabled={busy} style={s.resetBtn}>
            Password dimenticata?
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
