"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function sendLink() {
    setErr(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420, border: "1px solid #e5e7eb", borderRadius: 16, padding: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Accedi</h1>
        <p style={{ marginTop: 8, color: "#6b7280" }}>
          Inserisci la tua email: ti mando un link per entrare.
        </p>

        <input
          style={{ marginTop: 16, width: "100%", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}
          placeholder="nome@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button
          style={{ marginTop: 12, width: "100%", borderRadius: 12, padding: 12, fontWeight: 800, background: "black", color: "white", opacity: email.includes("@") ? 1 : 0.5 }}
          disabled={!email.includes("@")}
          onClick={sendLink}
        >
          Invia link
        </button>

        {sent && <p style={{ marginTop: 12, color: "#16a34a", fontWeight: 700 }}>Link inviato! Controlla la posta.</p>}
        {err && <p style={{ marginTop: 12, color: "#dc2626", fontWeight: 700 }}>{err}</p>}
      </div>
    </main>
  );
}
