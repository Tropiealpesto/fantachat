"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import { useApp } from "../../components/AppContext";

type Matchday = { id: string; number: number; status: string };
type RealTeam = { id: string; name: string };

export default function AdminTop6Page() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamId, teamName, role } = useApp();

  const [loading, setLoading] = useState(true);

  const [matchdays, setMatchdays] = useState<Matchday[]>([]);
  const [matchdayId, setMatchdayId] = useState<string>("");

  const [teams, setTeams] = useState<RealTeam[]>([]);
  const [selected, setSelected] = useState<string[]>(["", "", "", "", "", ""]);

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

      const { data: rts } = await supabase.from("real_teams").select("id, name").order("name", { ascending: true });
      setTeams((rts || []) as RealTeam[]);

      setLoading(false);
    }

    run();
  }, [ready, userId, activeLeagueId, teamId, role, router]);

  useEffect(() => {
    async function load(mid: string) {
      setMsg(null); setErr(null);
      if (!mid) return;
      const { data, error } = await supabase.rpc("get_top6_for_matchday", { p_league_matchday_id: mid } as any);
      if (error) {
        setSelected(["", "", "", "", "", ""]);
        return;
      }
      const rows = (data || []) as any[];
      const arr = ["", "", "", "", "", ""];
      rows.forEach((r: any) => { if (r.rank >= 1 && r.rank <= 6) arr[r.rank - 1] = r.real_team_id; });
      setSelected(arr);
    }
    if (matchdayId) load(matchdayId);
  }, [matchdayId]);

  async function save() {
    setMsg(null); setErr(null);

    if (selected.some((x) => !x)) return setErr("Seleziona tutte e 6 le squadre.");
    if (new Set(selected).size !== 6) return setErr("Top6 contiene duplicati.");

    setSaving(true);
    const { error } = await supabase.rpc("set_top6_for_matchday", {
      p_league_matchday_id: matchdayId,
      p_real_team_ids: selected,
    } as any);
    setSaving(false);

    if (error) return setErr(error.message);
    setMsg("Top6 salvata ✅");
  }

  if (!ready) return <main className="container">Caricamento...</main>;
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
                  onChange={(e) => setSelected((p) => { const c = [...p]; c[i] = e.target.value; return c; })}
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
