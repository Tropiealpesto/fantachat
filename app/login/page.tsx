"use client";
 
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
 
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
      const {
        data: { session },
      } = await supabase.auth.getSession();
 
      if (session?.user) {
        router.replace("/seleziona-lega");
      }
    }
 
    checkSession();
  }, [router]);
 
  const pageTitle = useMemo(() => {
    return mode === "login" ? "Accedi" : "Crea account";
  }, [mode]);
 
  async function handleLogin() {
    const cleanEmail = email.trim().toLowerCase();
 
    if (!cleanEmail || !password) {
      setErr("Inserisci email e password.");
      return;
    }
 
    setBusy(true);
    setErr(null);
    setMsg(null);
 
    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
 
    if (error) {
      const lower = (error.message || "").toLowerCase();
 
      if (lower.includes("invalid login credentials")) {
        setErr("Email non registrata o password non corretta.");
      } else {
        setErr(error.message);
      }
 
      setBusy(false);
      return;
    }
 
    try {
      await supabase.rpc("claim_invites_for_me");
    } catch {}
 
    setBusy(false);
    router.replace("/seleziona-lega");
  }
 
  async function handleSignup() {
    const cleanEmail = email.trim().toLowerCase();
 
    if (!cleanEmail || !password) {
      setErr("Inserisci email e password.");
      return;
    }
 
    if (password.length < 6) {
      setErr("La password deve avere almeno 6 caratteri.");
      return;
    }
 
    setBusy(true);
    setErr(null);
    setMsg(null);
 
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
    });
 
    if (error) {
      const lower = (error.message || "").toLowerCase();
 
      if (
        lower.includes("already registered") ||
        lower.includes("already been registered") ||
        lower.includes("user already registered")
      ) {
        setErr("Email già registrata.");
      } else {
        setErr(error.message);
      }
 
      setBusy(false);
      return;
    }
 
    const { error: loginAfterSignupError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
 
    if (loginAfterSignupError) {
      setMsg("Account creato correttamente. Ora accedi con email e password.");
      setMode("login");
      setBusy(false);
      return;
    }
 
    try {
      await supabase.rpc("claim_invites_for_me");
    } catch {}
 
    setBusy(false);
    router.replace("/seleziona-lega");
  }
 
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
 
    if (mode === "login") {
      await handleLogin();
    } else {
      await handleSignup();
    }
  }
 
  async function handleResetPassword() {
    const cleanEmail = email.trim().toLowerCase();
 
    if (!cleanEmail) {
      setErr("Inserisci prima l'email per reimpostare la password.");
      return;
    }
 
    setBusy(true);
    setErr(null);
    setMsg(null);
 
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/login`,
    });
 
    setBusy(false);
 
    if (error) {
      setErr(error.message);
      return;
    }
 
    setMsg("Ti abbiamo inviato una mail per reimpostare la password.");
  }
 
  return (
    <main style={{
      minHeight: "100dvh",
      display: "grid",
      alignItems: "center",
      fontFamily: "'Nunito', sans-serif",
      padding: "0 16px",
    }}>
      <div style={{
        background: "white",
        borderRadius: 24,
        border: "1.5px solid #c8e6d4",
        padding: "28px 24px",
        maxWidth: 420,
        width: "100%",
        margin: "0 auto",
      }}>
 
        {/* Logo */}
        <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1, marginBottom: 6 }}>
          <span style={{ color: "#1a7a3e" }}>Fanta</span>
          <span style={{ color: "#e07b1a" }}>Chat</span>
        </div>
        <div style={{ fontSize: 13, color: "#5a8a6e", fontWeight: 700, marginBottom: 24 }}>
          Il tuo fantacalcio, a modo tuo.
        </div>
 
        {/* Tab Accedi / Crea account */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 4,
          background: "#e8f5ee",
          padding: 4,
          borderRadius: 12,
          marginBottom: 22,
        }}>
          <button
            type="button"
            onClick={() => { setMode("login"); setErr(null); setMsg(null); }}
            style={tabStyle(mode === "login")}
          >
            Accedi
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setErr(null); setMsg(null); }}
            style={tabStyle(mode === "signup")}
          >
            Crea account
          </button>
        </div>
 
        <form onSubmit={submit}>
          {/* Email */}
          <label style={labelStyle}>Email</label>
          <input
            autoCapitalize="none"
            autoCorrect="off"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@email.com"
            style={inputStyle}
          />
 
          {/* Password */}
          <label style={{ ...labelStyle, marginTop: 14 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "Almeno 6 caratteri" : "Inserisci la password"}
            style={inputStyle}
          />
 
          {/* Submit */}
          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 18,
              width: "100%",
              padding: "14px 0",
              background: busy ? "#5a9e72" : "#1a7a3e",
              color: "white",
              border: "none",
              borderRadius: 12,
              fontFamily: "'Nunito', sans-serif",
              fontSize: 15,
              fontWeight: 800,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Attendi..." : mode === "login" ? "Accedi" : "Crea account"}
          </button>
        </form>
 
        {/* Password dimenticata */}
        {mode === "login" && (
          <button
            type="button"
            onClick={handleResetPassword}
            disabled={busy}
            style={{
              marginTop: 10,
              width: "100%",
              padding: "13px 0",
              background: "white",
              color: "#5a8a6e",
              border: "1.5px solid #c8e6d4",
              borderRadius: 12,
              fontFamily: "'Nunito', sans-serif",
              fontSize: 14,
              fontWeight: 800,
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            Password dimenticata?
          </button>
        )}
 
        {/* Errore */}
        {err && (
          <div style={{
            marginTop: 14,
            background: "#fff4ea",
            border: "1px solid #f5c990",
            borderRadius: 10,
            padding: "10px 14px",
            color: "#b85c0a",
            fontWeight: 800,
            fontSize: 13,
          }}>
            {err}
          </div>
        )}
 
        {/* Messaggio */}
        {msg && (
          <div style={{
            marginTop: 14,
            background: "#e8f5ee",
            border: "1px solid #a3d9b8",
            borderRadius: 10,
            padding: "10px 14px",
            color: "#1a5c33",
            fontWeight: 800,
            fontSize: 13,
          }}>
            {msg}
          </div>
        )}
 
        {/* Hint */}
        <div style={{
          marginTop: 16,
          color: "#5a8a6e",
          fontWeight: 700,
          fontSize: 12,
          lineHeight: 1.5,
          textAlign: "center",
        }}>
          Dopo l'accesso vedrai le tue leghe se sei stato invitato, oppure potrai crearne una nuova.
        </div>
      </div>
    </main>
  );
}
 
function tabStyle(active: boolean): React.CSSProperties {
  return {
    border: "none",
    borderRadius: 9,
    padding: "10px 12px",
    fontFamily: "'Nunito', sans-serif",
    fontWeight: 800,
    fontSize: 14,
    background: active ? "#1a7a3e" : "transparent",
    color: active ? "white" : "#5a8a6e",
    cursor: "pointer",
    transition: "all 0.15s",
  };
}
 
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 800,
  color: "#3a6b4e",
  textTransform: "uppercase",
  letterSpacing: "0.4px",
  marginBottom: 6,
};
 
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: "1.5px solid #c8e6d4",
  borderRadius: 12,
  fontFamily: "'Nunito', sans-serif",
  fontSize: 14,
  fontWeight: 700,
  background: "#f0faf4",
  color: "#1a3d2a",
  boxSizing: "border-box",
  marginTop: 6,
};