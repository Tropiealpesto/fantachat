"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";

export default function AdminPartitePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [leagueName, setLeagueName] = useState("FantaChat");
  const [seasonMatchdayNumber, setSeasonMatchdayNumber] = useState<number>(1);

  const [rows, setRows] = useState(
    Array.from({ length: 10 }).map((_, i) => ({
      slot: i + 1,
      home_team: "",
      away_team: "",
    }))
  );

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");

      const email = auth.user.email?.toLowerCase();

      const { data: admin } = await supabase
        .from("app_admins")
        .select("email")
        .eq("email", email)
        .maybeSingle();

      if (!admin) return router.replace("/");

      setLoading(false);
    }

    run();
  }, [router]);

  async function saveFixtures() {
    setErr(null);
    setMsg(null);

    const items = rows
      .filter((r) => r.home_team.trim() && r.away_team.trim())
      .map((r) => ({
        slot: r.slot,
        home_team: r.home_team.trim(),
        away_team: r.away_team.trim(),
      }));

    if (items.length === 0) {
      setErr("Inserisci almeno una partita.");
      return;
    }

    const { data, error } = await supabase.rpc(
      "set_fixtures_for_season_matchday",
      {
        p_season_matchday_number: seasonMatchdayNumber,
        p_items: items,
      }
    );

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg(`Salvate ${data} partite ✅`);
  }

  if (loading) return <main className="container">Caricamento...</main>;

  return (
    <>
      <AppBar league="FantaChat" team="Admin • Partite" />
      <main className="container">
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 1000 }}>
            Inserisci Partite Giornata
          </div>

          <div style={{ marginTop: 12, fontWeight: 900 }}>
            Numero giornata stagione (1–38)
          </div>

          <input
            type="number"
            min={1}
            max={38}
            value={seasonMatchdayNumber}
            onChange={(e) =>
              setSeasonMatchdayNumber(parseInt(e.target.value || "1", 10))
            }
            style={{
              width: "100%",
              marginTop: 6,
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--border)",
              fontWeight: 900,
            }}
          />

          <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
            {rows.map((row, i) => (
              <div
                key={row.slot}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <input
                  placeholder="Squadra Casa"
                  value={row.home_team}
                  onChange={(e) => {
                    const copy = [...rows];
                    copy[i].home_team = e.target.value;
                    setRows(copy);
                  }}
                  style={inputStyle}
                />
                <input
                  placeholder="Squadra Trasferta"
                  value={row.away_team}
                  onChange={(e) => {
                    const copy = [...rows];
                    copy[i].away_team = e.target.value;
                    setRows(copy);
                  }}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>

          <button
            className="btn btn-primary"
            style={{ marginTop: 16, width: "100%", padding: 12 }}
            onClick={saveFixtures}
          >
            Salva Partite
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
        </div>
      </main>
      <BottomNav />
    </>
  );
}

const inputStyle = {
  padding: 12,
  borderRadius: 12,
  border: "1px solid var(--border)",
  fontWeight: 900,
};
