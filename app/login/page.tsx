"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [mode, setMode] = useState<"login" | "signup">("login");

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(null);
    setMsg(null);

    const e = email.trim().toLowerCase();
    if (!e || !password) {
      setErr("Inserisci email e password.");
      return;
    }

    setBusy(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: e,
        password,
      });

      setBusy(false);

      if (error) {
        setErr(error.message);
        return;
      }

      // Aggancia inviti → crea memberships (multi-lega)
      await supabase.rpc("claim_invites_for_me");

      router.replace("/seleziona-lega");
      return;
    }

    // signup
    const { error } = await supabase.auth.signUp({
      email: e,
      password,
    });

    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }

    // Dopo signup spesso sei già loggato: proviamo a fare claim inviti
    await supabase.rpc("claim_invites_for_me");

    setMsg("Account creato ✅ Ora puoi entrare.");
    router.replace("/seleziona-lega");
  }

  return (
    <main className="container">
      <div className="card" style={{ padding: 16, marginTop: 12 }}>
        <div style={{ fontSize: 24, fontWeight: 1000 }}>
          <span style={{ color: "var(--primary-dark)" }}>Fanta</span>
          <span style={{ color: "var(--accent-dark)" }}>Chat</span>
        </div>

        <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
          {mode === "login" ? "Accedi" : "Prima volta? Crea password"}
        </div>

        <div style={{ marginTop: 12, fontWeight: 900 }}>Email</div>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nome@email.com"
          style={{
            width: "100%",
            marginTop: 8,
            padding: 12,
            borderRadius: 12,
            border: "1px solid var(--border)",
            fontWeight: 900,
          }}
        />

        <div style={{ marginTop: 12, fontWeight: 900 }}>Password</div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={{
            width: "100%",
            marginTop: 8,
            padding: 12,
            borderRadius: 12,
            border: "1px solid var(--border)",
            fontWeight: 900,
          }}
        />

        <button
          className="btn btn-primary"
          style={{ marginTop: 14, width: "100%", padding: 12 }}
          onClick={submit}
          disabled={busy}
        >
          {busy ? "..." : mode === "login" ? "Accedi" : "Crea account"}
        </button>

        <button
          className="btn"
          style={{ marginTop: 10, width: "100%", border: "2px solid var(--accent)" }}
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          disabled={busy}
        >
          {mode === "login" ? "Prima volta? Crea password" : "Hai già un account? Accedi"}
        </button>

        {msg && (
          <div style={{ marginTop: 12, color: "var(--primary-dark)", fontWeight: 900 }}>
            {msg}
          </div>
        )}
        {err && (
          <div style={{ marginTop: 12, color: "var(--accent-dark)", fontWeight: 900 }}>
            {err}
          </div>
        )}

        <div style={{ marginTop: 12, color: "var(--muted)", fontWeight: 800, fontSize: 12 }}>
          Nota: l’accesso è consentito solo alle email invitate in una lega.
        </div>
      </div>
    </main>
  );
}
