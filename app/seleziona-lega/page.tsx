"use client";

import { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { useApp } from "../components/AppContext";
import { supabase } from "../../lib/supabaseClient";

type Row = {
  league_id: string;
  league_name: string;
  team_name: string;
  role: string;
  active_league_competition_id?: string | null;
  competition_count?: number;
};

export default function SelezionaLega() {
  const app = useApp();
  const router = useRouter();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [code, setCode] = useState("");
  const [team, setTeam] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const loadLeagues = useCallback(async () => {
    setErr(null);
    setLoading(true);

    const { data, error } = await supabase.rpc("get_my_leagues");

    setLoading(false);

    if (error) {
      setRows([]);
      setErr(error.message);
      return;
    }

    setRows((data ?? []) as Row[]);
  }, []);

  useEffect(() => {
    if (!app.ready) return;

    if (!app.userId) {
      router.replace("/login");
      return;
    }

    loadLeagues();
  }, [app.ready, app.userId, router, loadLeagues]);

async function select(id: string) {
  setErr(null);

  console.log("SELECT LEAGUE", id);

  const { error } = await supabase.rpc("set_active_league", {
    p_league_id: id,
  });

  if (error) {
    console.error("set_active_league error", error);
    setErr(error.message);
    return;
  }

  await app.refresh();

  window.location.href = "/";
}

  async function join() {
    setErr(null);
    setMsg(null);

    if (!code.trim()) return setErr("Inserisci il codice invito.");
    if (!team.trim()) return setErr("Inserisci il nome squadra.");

    setJoining(true);

    const { error } = await supabase.rpc("join_league_with_code", {
      p_invite_code: code.trim().toUpperCase(),
      p_team_name: team.trim(),
    });

    setJoining(false);

    if (error) return setErr(error.message);

    setMsg("Sei entrato nella lega ✅");
    setCode("");
    setTeam("");

    await app.refresh();
    await loadLeagues();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <>
      <AppBar
        league="FantaChat"
        team="Seleziona lega"
        right={
          <button onClick={logout} style={s.logout}>
            Esci
          </button>
        }
      />

      <main style={s.container}>
        <h1 style={s.title}>Le tue leghe</h1>

        {err && <div style={s.err}>{err}</div>}
        {msg && <div style={s.ok}>{msg}</div>}

        {loading ? (
          <div style={s.empty}>Caricamento leghe...</div>
        ) : rows.length === 0 ? (
          <div style={s.empty}>Non sei ancora in nessuna lega.</div>
        ) : (
          rows.map((r) => (
            <button
              key={r.league_id}
              onClick={() => select(r.league_id)}
              style={s.row}
            >
              <div style={{ minWidth: 0 }}>
                <b style={s.leagueName}>{r.league_name}</b>
                <small style={s.meta}>
                  {r.team_name}
                  {typeof r.competition_count === "number"
                    ? ` · ${r.competition_count} competizioni`
                    : ""}
                </small>
              </div>
              <span style={s.badge}>{r.role}</span>
            </button>
          ))
        )}

        <a href="/crea-lega" style={s.create}>
          + Crea nuova lega
        </a>

        <div style={s.card}>
          <h2 style={s.cardTitle}>Entra in una lega</h2>

          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Codice invito"
            style={s.input}
          />

          <input
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            placeholder="Nome squadra"
            style={s.input}
          />

          <button onClick={join} disabled={joining} style={s.join}>
            {joining ? "Entro..." : "Entra"}
          </button>
        </div>
      </main>

      <BottomNav />
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 520,
    margin: "0 auto",
    padding: "16px 14px 100px",
    display: "grid",
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 900,
    color: "#111827",
    margin: 0,
  },
  row: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    textAlign: "left",
    fontFamily: "inherit",
    cursor: "pointer",
  },
  leagueName: {
    display: "block",
    color: "#111827",
    fontSize: 15,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  meta: {
    display: "block",
    color: "#6b7280",
    fontWeight: 700,
    marginTop: 3,
  },
  badge: {
    flexShrink: 0,
    background: "#fff7ed",
    color: "#ea580c",
    border: "1px solid #fed7aa",
    borderRadius: 999,
    padding: "3px 9px",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  create: {
    background: "#16a34a",
    color: "white",
    borderRadius: 14,
    padding: 14,
    textAlign: "center",
    fontWeight: 900,
    textDecoration: "none",
  },
  card: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 16,
    display: "grid",
    gap: 10,
  },
  cardTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
  },
  input: {
    padding: 12,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    fontFamily: "inherit",
    fontWeight: 800,
  },
  join: {
    padding: 12,
    border: 0,
    borderRadius: 12,
    background: "#f97316",
    color: "white",
    fontWeight: 900,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  logout: {
    border: 0,
    borderRadius: 999,
    padding: "7px 14px",
    background: "#fff7ed",
    color: "#ea580c",
    fontWeight: 900,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  ok: {
    color: "#15803d",
    background: "#f0fdf4",
    border: "1px solid #86efac",
    borderRadius: 10,
    padding: "10px 12px",
    fontWeight: 900,
  },
  err: {
    color: "#b85c0a",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: 10,
    padding: "10px 12px",
    fontWeight: 900,
  },
  empty: {
    color: "#6b7280",
    fontWeight: 800,
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 14,
  },
};