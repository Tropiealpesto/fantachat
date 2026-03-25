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

    // Prova login immediato
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
      setErr("Inserisci prima l’email per reimpostare la password.");
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
    <main className="container" style={{ minHeight: "100dvh", display: "grid", alignItems: "center" }}>
      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontSize: 18, fontWeight: 1000, color: "var(--primary-dark)" }}>
          <span style={{ color: "#16a34a" }}>Fanta</span>
          <span style={{ color: "#f97316" }}>Chat</span>
        </div>

        <div style={{ marginTop: 8, fontSize: 16, fontWeight: 900, color: "var(--muted)" }}>
          {pageTitle}
        </div>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            background: "#f8fafc",
            padding: 6,
            borderRadius: 16,
            border: "1px solid var(--border)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setErr(null);
              setMsg(null);
            }}
            style={tabStyle(mode === "login")}
          >
            Accedi
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setErr(null);
              setMsg(null);
            }}
            style={tabStyle(mode === "signup")}
          >
            Crea account
          </button>
        </div>

        <form onSubmit={submit}>
          <div style={{ marginTop: 18, fontWeight: 900 }}>Email</div>
          <input
            autoCapitalize="none"
            autoCorrect="off"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@email.com"
            style={inputStyle}
          />

          <div style={{ marginTop: 14, fontWeight: 900 }}>Password</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "Almeno 6 caratteri" : "Inserisci la password"}
            style={inputStyle}
          />

          <button
            type="submit"
            className="btn btn-primary"
            style={{ marginTop: 18, width: "100%", padding: 12, borderRadius: 14 }}
            disabled={busy}
          >
            {busy ? "Attendi..." : mode === "login" ? "Accedi" : "Crea account"}
          </button>
        </form>

        {mode === "login" && (
          <button
            type="button"
            onClick={handleResetPassword}
            style={{
              marginTop: 10,
              width: "100%",
              border: "2px solid var(--accent)",
              borderRadius: 14,
              padding: "10px 14px",
              fontWeight: 900,
              background: "white",
              color: "var(--text)",
            }}
            disabled={busy}
          >
            Password dimenticata?
          </button>
        )}

        {err && (
          <div style={{ marginTop: 14, color: "var(--accent-dark)", fontWeight: 1000 }}>
            {err}
          </div>
        )}

        {msg && (
          <div style={{ marginTop: 14, color: "var(--primary-dark)", fontWeight: 1000 }}>
            {msg}
          </div>
        )}

        <div style={{ marginTop: 14, color: "var(--muted)", fontWeight: 700 }}>
          Dopo l’accesso vedrai le tue leghe se sei stato invitato, oppure potrai crearne una nuova.
        </div>
      </div>
    </main>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    border: "none",
    borderRadius: 12,
    padding: "10px 12px",
    fontWeight: 1000,
    background: active ? "var(--primary)" : "transparent",
    color: active ? "white" : "var(--muted)",
  };
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 8,
  padding: 14,
  borderRadius: 14,
  border: "1px solid var(--border)",
  fontWeight: 800,
  background: "white",
};
