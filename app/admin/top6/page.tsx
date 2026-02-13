"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";

type Matchday = { id: string; number: number; status: string };
type RealTeam = { id: string; name: string };
type Top6Row = { rank: number; real_team_id: string; name: string };

export default function AdminTop6Page() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [leagueName, setLeagueName] = useState("—");
  const [teamName, setTeamName] = useState("—");

  const [matchdays, setMatchdays] = useState<Matchday[]>([]);
  const [matchdayId, setMatchdayId] = useState<string>("");

  const [teams, setTeams] = useState<RealTeam[]>([]);
  const [selected, setSelected] = useState<string[]>(["", "", "", "", "", ""]);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

      const { data: mds } = await supabase.from("matchdays").select("id, number, status").order("number", { ascending: false });
      const list = (mds || []) as Matchday[];
      setMatchdays(list);

      const open = list.find((x) => x.status === "open");
      setMatchdayId(open?.id ?? list[0]?.id ?? "");

      const { data: rts } = await supabase.from("real_teams").select("id, name").order("name", { ascending: true });
      setTeams((rts || []) as RealTeam[]);

      setLoading(false);
    }
    run();
  }, [router]);

  async function loadTop6(mid: string) {
    setMsg(null); setErr(null);
    if (!mid) return;

    const { data, error } = await supabase.rpc("get_top6_for_matchday", { p_matchday_id: mid });
    if (error) { setSelected(["", "", "", "", "", ""]); return; }

    const rows = (data || []) as any[];
    const arr = ["", "", "", "", "", ""];
    rows.forEach((r) => { if (r.rank >= 1 && r.rank <= 6) arr[r.rank - 1] = r.real_team_id; });
    setSelected(arr);
  }

  useEffect(() => {
    if (!matchdayId) return;
    loadTop6(matchdayId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchdayId]);

  async function save() {
    setErr(null); setMsg(null);

    if (selected.some((x) => !x)) { setErr("Seleziona tutte e 6 le squadre."); return; }
    if (new Set(selected).size !== 6) { setErr("Top6 contiene duplicati."); return; }

    setSaving(true);
    const { data, error } = await supabase.rpc("set_top6_for_matchday", {
      p_matchday_id: matchdayId,
      p_real_team_ids: selected,
    });
    setSaving(false);

    if (error) { setErr(error.message); return; }
    setMsg(`Top6 salvata ✅ (righe: ${data})`);
  }

  if (loading) return <main className="container">Caricamento...</main>;

  return (
    <>
      <AppBar league={leagueName} team={`${teamName} • ADMIN`} />
      <main className="container">
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 1000 }}>Admin • Top6</div>

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

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 10, alignItems: "center" }}>
                <div style={{ fontWeight: 1000 }}>#{i + 1}</div>
                <select
                  value={selected[i]}
                  onChange={(e) => setSelected((p) => { const c=[...p]; c[i]=e.target.value; return c; })}
                  style={{ padding: 12, borderRadius: 12, border: "1px solid var(--border)", fontWeight: 900 }}
                >
                  <option value="">-- scegli --</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            ))}
          </div>

          <button className="btn btn-primary" style={{ marginTop: 12, width: "100%", padding: 12 }} onClick={save} disabled={saving}>
            {saving ? "Salvataggio..." : "Salva Top6"}
          </button>

          {msg && <div style={{ marginTop: 12, color: "var(--primary-dark)", fontWeight: 900 }}>{msg}</div>}
          {err && <div style={{ marginTop: 12, color: "var(--accent-dark)", fontWeight: 900 }}>{err}</div>}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
