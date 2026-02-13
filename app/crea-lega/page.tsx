"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";

type Row = { team_name: string; email: string; role: "player" | "admin" };

export default function CreaLegaPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [myEmail, setMyEmail] = useState<string>("");

  const [leagueName, setLeagueName] = useState<string>("");

  const [rows, setRows] = useState<Row[]>([
    { team_name: "La mia squadra", email: "", role: "admin" },
    { team_name: "Squadra 2", email: "", role: "player" },
  ]);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function run() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login");
        return;
      }

      const e = (data.user.email || "").toLowerCase();
      setMyEmail(e);

      setRows((prev) => {
        const copy = [...prev];
        copy[0] = { ...copy[0], email: e, role: "admin" };
        return copy;
      });

      setLoading(false);
    }
    run();
  }, [router]);

  function addRow() {
    setRows((prev) => [...prev, { team_name: `Squadra ${prev.length + 1}`, email: "", role: "player" }]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateRow(i: number, k: keyof Row, v: any) {
    setRows((prev) => {
      const copy = [...prev];
      copy[i] = { ...copy[i], [k]: v };
      return copy;
    });
  }

  const canSubmit = useMemo(() => {
    if (leagueName.trim().length < 2) return false;
    if (rows.length < 2) return false;
    if (!rows[0].email || rows[0].email.toLowerCase() !== myEmail) return false;
    if (rows[0].role !== "admin") return false;
    return true;
  }, [leagueName, rows, myEmail]);

  async function createLeague() {
    setErr(null);
    setMsg(null);

    if (!canSubmit) {
      setErr("Controlla: nome lega, almeno 2 squadre, e la prima riga deve avere la tua email come admin.");
      return;
    }

    const emails = rows.map((r) => r.email.trim().toLowerCase()).filter(Boolean);
    if (new Set(emails).size !== emails.length) {
      setErr("Hai inserito due volte la stessa email.");
      return;
    }

    setBusy(true);
    const { data, error } = await supabase.rpc("create_league_with_teams_and_invites", {
      p_league_name: leagueName.trim(),
      p_items: rows,
    });
    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg("Lega creata ✅ Ti porto alla Home della nuova lega...");
    setTimeout(() => router.replace("/"), 700);
  }

  if (loading) return <main className="container">Caricamento...</main>;

  return (
    <>
      <AppBar league="FantaChat" team="Crea nuova lega" />
      <main className="container">
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 1000 }}>Crea una nuova lega</div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
            Inserisci squadre ed email. La prima riga è la tua (admin).
          </div>

          <div style={{ marginTop: 12, fontWeight: 1000 }}>Nome lega</div>
          <input
            value={leagueName}
            onChange={(e) => setLeagueName(e.target.value)}
            placeholder="Es. Paro Ale e Leo"
            style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 12, border: "1px solid var(--border)", fontWeight: 900 }}
          />

          <div style={{ marginTop: 14, fontWeight: 1000 }}>Squadre & inviti</div>

          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {rows.map((r, i) => (
              <div key={i} className="card" style={{ padding: 12, boxShadow: "none" }}>
                <input
                  value={r.team_name}
                  onChange={(e) => updateRow(i, "team_name", e.target.value)}
                  placeholder="Nome squadra"
                  style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid var(--border)", fontWeight: 900 }}
                />

                <input
                  value={r.email}
                  onChange={(e) => updateRow(i, "email", e.target.value)}
                  placeholder="Email proprietario"
                  style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid var(--border)", fontWeight: 900, marginTop: 8 }}
                />

                <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                  <select
                    value={r.role}
                    onChange={(e) => updateRow(i, "role", e.target.value)}
                    style={{ padding: 10, borderRadius: 12, border: "1px solid var(--border)", fontWeight: 900 }}
                    disabled={i === 0}
                  >
                    <option value="player">player</option>
                    <option value="admin">admin</option>
                  </select>

                  {i > 1 && (
                    <button className="btn" style={{ border: "2px solid var(--accent)" }} onClick={() => removeRow(i)}>
                      Rimuovi
                    </button>
                  )}
                </div>

                {i === 0 && (
                  <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800, fontSize: 12 }}>
                    Questa riga deve essere la tua email (admin).
                  </div>
                )}
              </div>
            ))}
          </div>

          <button className="btn" style={{ marginTop: 12, width: "100%" }} onClick={addRow}>
            + Aggiungi squadra
          </button>

          <button className="btn btn-primary" style={{ marginTop: 12, width: "100%", padding: 12 }} onClick={createLeague} disabled={!canSubmit || busy}>
            {busy ? "Creazione..." : "Crea lega"}
          </button>

          {msg && <div style={{ marginTop: 12, fontWeight: 900, color: "var(--primary-dark)" }}>{msg}</div>}
          {err && <div style={{ marginTop: 12, fontWeight: 900, color: "var(--accent-dark)" }}>{err}</div>}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
