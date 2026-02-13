
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

  const [leagueName, setLeagueName] = useState("—");
  const [teamName, setTeamName] = useState("—");

  const [current, setCurrent] = useState<Matchday | null>(null);
  const [numberToOpen, setNumberToOpen] = useState(1);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    const { data: md } = await supabase
      .from("matchdays")
      .select("id, number, status")
      .eq("status", "open")
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();
    setCurrent(md ?? null);

    const { data: last } = await supabase
      .from("matchdays")
      .select("number")
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
      const leagueId = ctx.active_league_id;

      const { data: mem } = await supabase.from("memberships").select("team_id, role").eq("league_id", leagueId).limit(1).maybeSingle();
      if (!mem || mem.role !== "admin") return router.replace("/");

      const { data: lg } = await supabase.from("leagues").select("name").eq("id", leagueId).single();
      if (lg?.name) setLeagueName(lg.name);

      const { data: tm } = await supabase.from("teams").select("name").eq("id", mem.team_id).single();
      if (tm?.name) setTeamName(tm.name);

      await refresh();
      setLoading(false);
    }

    run();
  }, [router]);

  async function openMatchday() {
    setMsg(null); setErr(null);
    const { data, error } = await supabase.rpc("open_matchday", { p_number: numberToOpen });
    if (error) { setErr(error.message); return; }
    setMsg(`Giornata ${numberToOpen} aperta ✅`);
    await refresh();
  }

  async function closeProvisional() {
    setMsg(null); setErr(null);
    if (!current) { setErr("Nessuna giornata open."); return; }

    const { data, error } = await supabase.rpc("close_matchday_for_league", {
      p_matchday_id: current.id,
      p_finalize: false,
    });
    if (error) { setErr(error.message); return; }
    setMsg(`Giornata ${current.number} chiusa (provv). Snapshot: ${data} ✅`);
  }

  async function finalizeMatchday() {
    setMsg(null); setErr(null);
    if (!current) { setErr("Nessuna giornata open."); return; }

    const { data, error } = await supabase.rpc("close_matchday_for_league", {
      p_matchday_id: current.id,
      p_finalize: true,
    });
    if (error) { setErr(error.message); return; }

    await supabase.from("matchdays").update({ status: "locked" }).eq("id", current.id);
    setMsg(`Giornata ${current.number} FINALIZZATA ✅ Snapshot: ${data}`);
    await refresh();
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
            <button className="btn" style={{ border: "2px solid var(--border)" }} onClick={closeProvisional}>Chiudi (provv)</button>
            <button className="btn btn-primary" onClick={finalizeMatchday}>Finalizza</button>
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
              <button className="btn btn-primary" onClick={openMatchday}>Apri</button>
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
