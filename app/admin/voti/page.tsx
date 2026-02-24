"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import { useApp } from "../../components/AppContext";

type Matchday = { id: string; number: number; status: string };
type PickedPlayerRow = {
  player_id: string;
  player_name: string;
  role: "GK" | "DEF" | "MID" | "FWD";
  real_team: string;
  picked_count: number;
  current_vote: number | null;
};

export default function AdminVotiPage() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamId, teamName, role } = useApp();

  const [loading, setLoading] = useState(true);
  const [matchdays, setMatchdays] = useState<Matchday[]>([]);
  const [matchdayId, setMatchdayId] = useState<string>("");

  const [rows, setRows] = useState<PickedPlayerRow[]>([]);
  const [votes, setVotes] = useState<Record<string, string>>({});

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function run() {
      if (!ready) return;
      if (!userId) return router.replace("/login");
      if (!activeLeagueId || !teamId) return router.replace("/seleziona-lega");
      if (role !== "admin") return router.replace("/");

      const { data: mds } = await supabase
        .from("matchdays")
        .select("id, number, status")
        .eq("league_id", activeLeagueId)
        .order("number", { ascending: false });

      const list = (mds || []) as Matchday[];
      setMatchdays(list);
      const open = list.find((x) => x.status === "open");
      setMatchdayId(open?.id ?? list[0]?.id ?? "");

      setLoading(false);
    }

    run();
  }, [ready, userId, activeLeagueId, teamId, role, router]);

  async function loadPicked(mid: string) {
    setMsg(null); setErr(null);
    setRows([]); setVotes({});
    if (!mid) return;

    const { data, error } = await supabase.rpc("get_picked_players_for_matchday", { p_matchday_id: mid });
    if (error) { setErr(error.message); return; }

    const r = (data || []) as PickedPlayerRow[];
    setRows(r);

    const init: Record<string, string> = {};
    r.forEach((x) => (init[x.player_id] = x.current_vote != null ? String(x.current_vote) : ""));
    setVotes(init);

    if (!r.length) setMsg("Nessun giocatore schierato per questa giornata.");
  }

  useEffect(() => {
    if (matchdayId) loadPicked(matchdayId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchdayId]);

  async function saveAll() {
    setMsg(null); setErr(null);
    if (!matchdayId) return;

    const items = Object.entries(votes)
      .map(([player_id, v]) => ({ player_id, vote: v.trim() }))
      .filter((x) => x.vote !== "")
      .map((x) => ({ player_id: x.player_id, vote: Number(x.vote.replace(",", ".")) }))
      .filter((x) => Number.isFinite(x.vote));

    if (!items.length) { setErr("Nessun voto da salvare."); return; }

    setSaving(true);
    const { data, error } = await supabase.rpc("upsert_ratings_bulk", { p_matchday_id: matchdayId, p_items: items });
    setSaving(false);

    if (error) { setErr(error.message); return; }
    setMsg(`Salvati ${data} voti ✅`);
    await loadPicked(matchdayId);
  }

  if (!ready) return <main className="container">Caricamento...</main>;
  if (loading) return <main className="container">Caricamento...</main>;

  return (
    <>
      <AppBar league={leagueName} team={`${teamName} • ADMIN`} />
      <main className="container">
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 1000 }}>Admin • Voti</div>

          <select
            value={matchdayId}
            onChange={(e) => setMatchdayId(e.target.value)}
            style={{ width: "100%", marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid var(--border)", fontWeight: 900 }}
          >
            {matchdays.map((m) => (
              <option key={m.id} value={m.id}>
                Giornata {m.number} ({m.status})
              </option>
            ))}
          </select>

          <button className="btn btn-primary" style={{ marginTop: 12, width: "100%", padding: 12 }} onClick={saveAll} disabled={saving}>
            {saving ? "Salvataggio..." : "Salva voti"}
          </button>

          {msg && <div style={{ marginTop: 12, color: "var(--primary-dark)", fontWeight: 900 }}>{msg}</div>}
          {err && <div style={{ marginTop: 12, color: "var(--accent-dark)", fontWeight: 900 }}>{err}</div>}
        </div>

        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Giocatori schierati</div>
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {rows.map((r) => (
              <div key={r.player_id} className="card" style={{ padding: 12, boxShadow: "none" }}>
                <div style={{ fontWeight: 1000 }}>
                  {r.player_name} <span style={{ color: "var(--muted)" }}>· {r.real_team} · {r.role}</span>
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center" }}>
                  <input
  type="text"
  value={votes[r.player_id] ?? ""}
  onChange={(e) => setVotes((p) => ({ ...p, [r.player_id]: e.target.value }))}
  placeholder="es. -1,5"
  inputMode="text"
  style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid var(--border)", fontWeight: 900 }}
/>
                  <div style={{ color: "var(--muted)", fontWeight: 900 }}>x{r.picked_count}</div>
                </div>
              </div>
            ))}
            {rows.length === 0 && <div style={{ color: "var(--muted)", fontWeight: 800 }}>Nessun dato.</div>}
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
