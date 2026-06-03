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
  const [myEmail, setMyEmail] = useState("");

  const [leagueName, setLeagueName] = useState("");
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
      if (!data.user) return router.replace("/login");

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
    setErr(null); setMsg(null);
    if (!canSubmit) return setErr("Controlla nome lega e prima riga (la tua email admin).");

    const emails = rows.map((r) => r.email.trim().toLowerCase()).filter(Boolean);
    if (new Set(emails).size !== emails.length) return setErr("Hai inserito due volte la stessa email.");

    setBusy(true);

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Non autenticato.");

      // 1) Crea competizione default (Serie A)
      const { data: comp, error: compErr } = await supabase
        .from("competitions")
        .insert({ name: "Serie A", slug: `serie-a-${Date.now()}` })
        .select("id")
        .single();
      if (compErr) throw compErr;

      // 2) Crea config default
      await supabase.from("competition_config").insert({
        competition_id: comp.id,
        roles: [
          { key: "P", label: "Portiere" },
          { key: "D", label: "Difensore" },
          { key: "C", label: "Centrocampista" },
          { key: "A", label: "Attaccante" },
        ],
        players_per_role: { P: 1, D: 1, C: 1, A: 1 },
      });

      // 3) Crea stagione
      const { data: season, error: seasonErr } = await supabase
        .from("seasons")
        .insert({
          competition_id: comp.id,
          name: "2025/26",
          total_matchdays: 38,
        })
        .select("id")
        .single();
      if (seasonErr) throw seasonErr;

      // 4) Crea lega
      const { data: league, error: leagueErr } = await supabase
        .from("leagues")
        .insert({
          season_id: season.id,
          name: leagueName.trim(),
        })
        .select("id")
        .single();
      if (leagueErr) throw leagueErr;

      // 5) Aggiungi i membri
      // L'admin (prima riga) ha user_id = auth.user.id
      // Gli altri per ora vengono aggiunti con user_id NULL (verranno claimati)
      const memberInserts = rows.map((r, i) => ({
        league_id: league.id,
        user_id: i === 0 ? auth.user!.id : null, // solo l'admin ha user_id subito
        team_name: r.team_name.trim(),
        role: r.role,
      }));

      // Per l'inserimento con user_id null, serve una policy apposita
      // Per ora inseriamo solo l'admin e gestiamo gli inviti dopo
      const { error: memErr } = await supabase
        .from("league_members")
        .insert(memberInserts.filter((m) => m.user_id != null));
      if (memErr) throw memErr;

      // TODO: invia inviti via email agli altri membri

      // 6) Imposta come lega attiva
      await supabase.rpc("set_active_league", { p_league_id: league.id });

      setBusy(false);
      setMsg("Lega creata ✅");
      setTimeout(() => router.replace("/"), 700);

    } catch (e: any) {
      setBusy(false);
      setErr(e?.message || String(e));
    }
  }

  if (loading) return <main style={{ padding: 20 }}>Caricamento...</main>;

  return (
    <>
      <AppBar league="FantaChat" team="Crea nuova lega" />
      <main style={s.container}>
        <div style={s.card}>
          <div style={s.title}>Crea una nuova lega</div>

          <div style={s.label}>Nome lega</div>
          <input
            value={leagueName}
            onChange={(e) => setLeagueName(e.target.value)}
            placeholder="Es. Paro Ale e Leo"
            style={s.input}
          />

          <div style={{ ...s.label, marginTop: 14 }}>Squadre & inviti</div>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {rows.map((r, i) => (
              <div key={i} style={s.memberCard}>
                <input
                  value={r.team_name}
                  onChange={(e) => updateRow(i, "team_name", e.target.value)}
                  placeholder="Nome squadra"
                  style={s.input}
                />
                <input
                  value={r.email}
                  onChange={(e) => updateRow(i, "email", e.target.value)}
                  placeholder="Email proprietario"
                  style={{ ...s.input, marginTop: 8 }}
                />
                <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <select
                    value={r.role}
                    onChange={(e) => updateRow(i, "role", e.target.value)}
                    disabled={i === 0}
                    style={s.select}
                  >
                    <option value="player">player</option>
                    <option value="admin">admin</option>
                  </select>
                  {i > 1 && (
                    <button style={s.removeBtn} onClick={() => removeRow(i)}>Rimuovi</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button style={s.addBtn} onClick={addRow}>+ Aggiungi squadra</button>

          <button
            style={{ ...s.submitBtn, opacity: canSubmit && !busy ? 1 : 0.6 }}
            onClick={createLeague}
            disabled={!canSubmit || busy}
          >
            {busy ? "Creazione..." : "Crea lega"}
          </button>

          {msg && <div style={{ marginTop: 12, fontWeight: 900, color: "#1a7a3e" }}>{msg}</div>}
          {err && <div style={{ marginTop: 12, fontWeight: 900, color: "#c2410c" }}>{err}</div>}
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
  title: { fontSize: 22, fontWeight: 800, color: "#111827", marginBottom: 12 },
  label: { fontWeight: 800, color: "#111827", fontSize: 14 },
  input: {
    width: "100%", padding: 12, borderRadius: 12,
    border: "1px solid #e5e7eb", fontWeight: 700,
    fontSize: 14, fontFamily: "inherit", boxSizing: "border-box",
  },
  select: {
    padding: 10, borderRadius: 12, border: "1px solid #e5e7eb",
    fontWeight: 700, fontFamily: "inherit",
  },
  memberCard: {
    padding: 12, border: "1px solid #e5e7eb", borderRadius: 14,
    background: "#f9fafb",
  },
  addBtn: {
    marginTop: 12, width: "100%", padding: 12,
    background: "white", border: "1.5px dashed #d1d5db",
    borderRadius: 12, fontWeight: 700, cursor: "pointer",
    fontSize: 14, color: "#6b7280", fontFamily: "inherit",
  },
  removeBtn: {
    padding: "8px 14px", borderRadius: 10,
    border: "1.5px solid #ea580c", background: "white",
    fontWeight: 700, fontSize: 13, color: "#ea580c",
    cursor: "pointer", fontFamily: "inherit",
  },
  submitBtn: {
    marginTop: 12, width: "100%", padding: 14,
    background: "linear-gradient(135deg, #16a34a, #15803d)",
    color: "white", border: "none", borderRadius: 12,
    fontSize: 15, fontWeight: 700, cursor: "pointer",
    fontFamily: "inherit",
  },
};