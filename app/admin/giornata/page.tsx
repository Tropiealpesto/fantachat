"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";

type Matchday = { id: string; number: number; status: string };

export default function AdminGiornataPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("—");
  const [teamName, setTeamName] = useState("—");

  const [current, setCurrent] = useState<Matchday | null>(null);
  const [numberToOpen, setNumberToOpen] = useState(1);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function refresh(lid: string) {
    const { data: md } = await supabase
      .from("matchdays")
      .select("id, number, status")
      .eq("league_id", lid)
      .eq("status", "open")
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();
    setCurrent(md ?? null);

    // prossimo numero = max+1
    const { data: last } = await supabase
      .from("matchdays")
      .select("number")
      .eq("league_id", lid)
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();

    setNumberToOpen(((last?.number ?? 0) + 1) || 1);
  }

  useEffect(() => {
    async function run() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");

      const { data: ctx } = await supabase.from("user_context").select("active_league_id").eq("user_id", auth.user.id).maybeSingle();
      if (!ctx?.active_league_id) return router.replace("/seleziona-lega");
      const lid = ctx.active_league_id as string;
      setLeagueId(lid);

      const { data: mem } = await supabase.from("memberships").select("team_id, role").eq("league_id", lid).limit(1).maybeSingle();
      if (!mem || mem.role !== "admin") return router.replace("/");

      const { data: lg } = await supabase.from("leagues").select("name").eq("id", lid).single();
      if (lg?.name) setLeagueName(lg.name);

      const { data: tm } = await supabase.from("teams").select("name").eq("id", mem.team_id).single();
      if (tm?.name) setTeamName(tm.name);

      await refresh(lid);
      setLoading(false);
    }

    run();
  }, [router]);

  async function openDay() {
    setMsg(null); setErr(null);
    const { data, error } = await supabase.rpc("open_matchday", { p_number: numberToOpen });
    if (error) { setErr(error.message); return; }
    setMsg(`Giornata ${numberToOpen} aperta ✅`);
    if (leagueId) await refresh(leagueId);
  }

  async function closeProvv() {
    setMsg(null); setErr(null);
    if (!current) return setErr("Nessuna giornata open.");
    const { data, error } = await supabase.rpc("close_matchday_for_league", { p_matchday_id: current.id, p_finalize: false });
    if (error) { setErr(error.message); return; }
    setMsg(`Chiusa provv ✅ (snapshot: ${data})`);
  }

  async function finalize() {
    setMsg(null); setErr(null);
    if (!current) return setErr("Nessuna giornata open.");
    const { data, error } = await supabase.rpc("close_matchday_for_league", { p_matchday_id: current.id, p_finalize: true });
    if (error) { setErr(error.message); return; }
    await supabase.from("matchdays").update({ status: "locked" }).eq("id", current.id);
    setMsg(`Finalizzata ✅ (snapshot: ${data})`);
    if (leagueId) await refresh(leagueId);
  }

  if (loading) return <main className="container">Caricamento...</main>;

  return (
    <>
      <AppBar league={leagueName} team={`${teamName} • ADMIN`} />
      <main className="container">
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 1000 }}>Admin • Giornata</div>

          <div style={{ marginTop: 10, color: "var(--muted)", fontWeight: 900 }}>
            {current ? `Open: Giornata ${current.number}` : "Nessuna giornata open"}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <button className="btn" onClick={closeProvv}>Chiudi (provv)</button>
            <button className="btn btn-primary" onClick={finalize}>Finalizza</button>
          </div>

          <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <div style={{ fontWeight: 1000 }}>Apri nuova giornata</div>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <input
                type="number"
                value={numberToOpen}
                onChange={(e) => setNumberToOpen(parseInt(e.target.value || "1", 10))}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid var(--border)", fontWeight: 900 }}
              />
              <button className="btn btn-primary" onClick={openDay}>Apri</button>
            </div>
          </div>

          {msg && <div style={{ marginTop: 12, color: "var(--primary-dark)", fontWeight: 900 }}>{msg}</div>}
          {err && <div style={{ marginTop: 12, color: "var(--accent-dark)", fontWeight: 900 }}>{err}</div>}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
