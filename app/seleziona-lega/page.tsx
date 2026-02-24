"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { useApp } from "../components/AppContext";

type Row = {
  league_id: string;
  leagues: { name: string } | null;
  team_id: string;
  teams: { name: string } | null;
  role: string;
};

export default function SelezionaLegaPage() {
  const router = useRouter();
  const { ready, userId } = useApp();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      if (!ready) return;
      if (!userId) return router.replace("/login");

      setErr(null);
      setMsg(null);
      setLoading(true);

      // auto-claim inviti
      await supabase.rpc("claim_invites_for_me");

      const { data, error } = await supabase
        .from("memberships")
        .select("league_id, leagues(name), team_id, teams(name), role");

      if (error) setErr(error.message);
      setRows((data || []) as any);
      setLoading(false);
    }

    run();
  }, [ready, userId, router]);

  async function setLeague(leagueId: string) {
    setErr(null);
    setMsg(null);

    const { error } = await supabase.rpc("set_active_league", {
      p_league_id: leagueId,
    });

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg("Lega selezionata ✅");
    setTimeout(() => router.replace("/"), 300);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!ready) return <main className="container">Caricamento...</main>;
  if (loading) return <main className="container">Caricamento...</main>;

  return (
    <>
      <AppBar
        league="FantaChat"
        team="Seleziona lega"
        right={<button className="btn" onClick={logout}>Esci</button>}
      />

      <main className="container">
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 1000 }}>Selezione lega</div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
            Scegli la lega attiva. Puoi crearne una nuova in basso.
          </div>

          {err && <div style={{ marginTop: 12, color: "var(--accent-dark)", fontWeight: 900 }}>{err}</div>}
          {msg && <div style={{ marginTop: 12, color: "var(--primary-dark)", fontWeight: 900 }}>{msg}</div>}

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {rows.length === 0 ? (
              <div style={{ color: "var(--muted)", fontWeight: 800 }}>Non sei ancora in nessuna lega.</div>
            ) : (
              rows.map((r, i) => (
                <button
                  key={i}
                  className="card"
                  style={{ padding: 14, textAlign: "left", cursor: "pointer", borderLeft: "6px solid var(--primary)" }}
                  onClick={() => setLeague(r.league_id)}
                >
                  <div style={{ fontWeight: 1000 }}>{r.leagues?.name || "Lega"}</div>
                  <div style={{ marginTop: 4, color: "var(--muted)", fontWeight: 800 }}>
                    {r.teams?.name || "Squadra"} • {String(r.role).toUpperCase()}
                  </div>
                </button>
              ))
            )}
          </div>

          <a
            href="/crea-lega"
            className="btn btn-primary"
            style={{ marginTop: 14, width: "100%", display: "inline-block", textAlign: "center", padding: 12, textDecoration: "none" }}
          >
            + Crea nuova lega
          </a>
        </div>
      </main>

      <BottomNav />
    </>
  );
}
