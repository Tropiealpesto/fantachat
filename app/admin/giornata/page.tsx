"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";

type Matchday = { id: string; number: number; status: string };
type Team = { id: string; name: string };

export default function AdminGiornataPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("—");
  const [teamName, setTeamName] = useState("—");

  const [current, setCurrent] = useState<Matchday | null>(null);
  const [numberToOpen, setNumberToOpen] = useState(1);

  // schedule settings
  const [deadlineEndLocal, setDeadlineEndLocal] = useState<string>(""); // datetime-local value
  const [slotMinutes, setSlotMinutes] = useState<number>(90);

  // recap whatsapp
  const [recapText, setRecapText] = useState<string>("");
  const [recapLoading, setRecapLoading] = useState(false);

  // reset rosa
  const [teams, setTeams] = useState<Team[]>([]);
  const [resetTeamId, setResetTeamId] = useState<string>("");
  const [resetting, setResetting] = useState(false);

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

    const { data: last } = await supabase
      .from("matchdays")
      .select("number")
      .eq("league_id", lid)
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();

    setNumberToOpen(((last?.number ?? 0) + 1) || 1);

    // reset recap quando cambi contesto
    setRecapText("");
  }

  async function loadTeams(lid: string) {
    const { data } = await supabase
      .from("teams")
      .select("id, name")
      .eq("league_id", lid)
      .order("name", { ascending: true });

    const list = (data || []) as Team[];
    setTeams(list);
    setResetTeamId(list[0]?.id ?? "");
  }

  useEffect(() => {
    async function run() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");

      const { data: ctx } = await supabase
        .from("user_context")
        .select("active_league_id")
        .eq("user_id", auth.user.id)
        .maybeSingle();

      if (!ctx?.active_league_id) return router.replace("/seleziona-lega");
      const lid = ctx.active_league_id as string;
      setLeagueId(lid);

      const { data: mem } = await supabase
        .from("memberships")
        .select("team_id, role")
        .eq("league_id", lid)
        .limit(1)
        .maybeSingle();

      if (!mem || mem.role !== "admin") return router.replace("/");

      const { data: lg } = await supabase.from("leagues").select("name").eq("id", lid).single();
      if (lg?.name) setLeagueName(lg.name);

      const { data: tm } = await supabase.from("teams").select("name").eq("id", mem.team_id).single();
      if (tm?.name) setTeamName(tm.name);

      await refresh(lid);
      await loadTeams(lid);

      // default deadline suggerita: venerdì alle 20:00 della settimana corrente (solo suggerimento)
      setDeadlineEndLocal(suggestFriday20Local());

      setLoading(false);
    }

    run();
  }, [router]);

  async function openDay() {
    setMsg(null);
    setErr(null);
    const { error } = await supabase.rpc("open_matchday", { p_number: numberToOpen });
    if (error) return setErr(error.message);
    setMsg(`Giornata ${numberToOpen} aperta ✅`);
    if (leagueId) await refresh(leagueId);
  }

  async function closeProvv() {
    setMsg(null);
    setErr(null);
    if (!current) return setErr("Nessuna giornata open.");
    const { data, error } = await supabase.rpc("close_matchday_for_league", {
      p_matchday_id: current.id,
      p_finalize: false,
    });
    if (error) return setErr(error.message);
    setMsg(`Chiusa provv ✅ (snapshot: ${data})`);
  }

  async function finalize() {
    setMsg(null);
    setErr(null);
    if (!current) return setErr("Nessuna giornata open.");
    const { data, error } = await supabase.rpc("close_matchday_for_league", {
      p_matchday_id: current.id,
      p_finalize: true,
    });
    if (error) return setErr(error.message);
    await supabase.from("matchdays").update({ status: "locked" }).eq("id", current.id);
    setMsg(`Finalizzata ✅ (snapshot: ${data})`);
    if (leagueId) await refresh(leagueId);
  }

  async function saveSettingsAndGenerateRecap() {
    setMsg(null);
    setErr(null);
    setRecapText("");

    if (!current) return setErr("Apri prima una giornata.");
    if (!deadlineEndLocal) return setErr("Seleziona una data/ora di fine slot.");

    const iso = new Date(deadlineEndLocal).toISOString();

    const { error: sErr } = await supabase.rpc("set_matchday_settings", {
      p_matchday_id: current.id,
      p_deadline_end_at: iso,
      p_slot_minutes: slotMinutes,
    });

    if (sErr) return setErr(sErr.message);

    const { data: count, error: gErr } = await supabase.rpc("generate_pick_schedule", {
      p_matchday_id: current.id,
    });

    if (gErr) return setErr(gErr.message);

    setRecapLoading(true);
    const { data: recap, error: rErr } = await supabase.rpc("get_pick_schedule_recap_text", {
      p_matchday_id: current.id,
    });
    setRecapLoading(false);

    if (rErr) return setErr(rErr.message);

    setRecapText(String(recap || ""));
    setMsg(`Schedule generato ✅ (${count} squadre) — recap pronto da copiare.`);
  }

  async function copyRecap() {
    try {
      await navigator.clipboard.writeText(recapText);
      setMsg("Recap copiato ✅ Incollalo su WhatsApp.");
    } catch {
      setErr("Impossibile copiare automaticamente. Seleziona il testo e copia manualmente.");
    }
  }

  async function resetPick() {
    setMsg(null);
    setErr(null);

    if (!current) return setErr("Nessuna giornata open.");
    if (!resetTeamId) return setErr("Seleziona una squadra.");
    if (!confirm("Confermi reset rosa per questa squadra? (Cancella la formazione della giornata)")) return;

    setResetting(true);
    const { data, error } = await supabase.rpc("admin_reset_team_pick", {
      p_matchday_id: current.id,
      p_team_id: resetTeamId,
    });
    setResetting(false);

    if (error) return setErr(error.message);

    const tName = teams.find((t) => t.id === resetTeamId)?.name || "Squadra";
    setMsg(`Rosa resettata ✅ (${tName})`);
  }

  if (loading) return <main className="container">Caricamento...</main>;

  return (
    <>
      <AppBar league={leagueName} team={`${teamName} • ADMIN`} />
      <main className="container">
        {/* Giornata: open/close */}
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
        </div>

        {/* Reset rosa */}
        <div className="card" style={{ padding: 16, marginTop: 12, borderLeft: "6px solid var(--accent)" }}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Reset rosa (Admin)</div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
            Cancella la formazione della squadra selezionata per la giornata open.
          </div>

          <select
            value={resetTeamId}
            onChange={(e) => setResetTeamId(e.target.value)}
            style={{
              width: "100%",
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--border)",
              fontWeight: 900,
            }}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <button
            className="btn"
            style={{ marginTop: 12, width: "100%", border: "2px solid var(--accent)" }}
            onClick={resetPick}
            disabled={resetting || !current}
          >
            {resetting ? "Reset..." : "Reset rosa"}
          </button>
        </div>

        {/* Schedule / WhatsApp recap */}
        <div className="card" style={{ padding: 16, marginTop: 12, borderLeft: "6px solid var(--accent)" }}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Slot inserimento Rosa (WhatsApp)</div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
            Imposta la fine slot (es. venerdì 20:00). Genero lo schedule a ritroso (90 min) saltando 22:00–09:30.
          </div>

          <div style={{ marginTop: 12, fontWeight: 1000 }}>Fine slot (deadline_end_at)</div>
          <input
            type="datetime-local"
            value={deadlineEndLocal}
            onChange={(e) => setDeadlineEndLocal(e.target.value)}
            style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 12, border: "1px solid var(--border)", fontWeight: 900 }}
          />

          <div style={{ marginTop: 12, fontWeight: 1000 }}>Durata slot (minuti)</div>
          <input
            type="number"
            value={slotMinutes}
            onChange={(e) => setSlotMinutes(parseInt(e.target.value || "90", 10))}
            style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 12, border: "1px solid var(--border)", fontWeight: 900 }}
          />

          <button
            className="btn btn-primary"
            style={{ marginTop: 12, width: "100%", padding: 12 }}
            onClick={saveSettingsAndGenerateRecap}
          >
            Genera recap WhatsApp
          </button>

          {recapLoading && <div style={{ marginTop: 10, color: "var(--muted)", fontWeight: 800 }}>Genero recap...</div>}

          {recapText && (
            <>
              <div style={{ marginTop: 12, fontWeight: 1000 }}>Testo pronto da incollare</div>
              <textarea
                value={recapText}
                readOnly
                style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 12, border: "1px solid var(--border)", minHeight: 220, fontWeight: 700 }}
              />
              <button className="btn" style={{ marginTop: 10, border: "2px solid var(--accent)" }} onClick={copyRecap}>
                Copia recap
              </button>
            </>
          )}
        </div>

        {msg && <div className="card" style={{ padding: 14, marginTop: 12, borderLeft: "6px solid var(--primary)", fontWeight: 900, color: "var(--primary-dark)" }}>{msg}</div>}
        {err && <div className="card" style={{ padding: 14, marginTop: 12, borderLeft: "6px solid var(--accent)", fontWeight: 900, color: "var(--accent-dark)" }}>{err}</div>}
      </main>
      <BottomNav />
    </>
  );
}

function suggestFriday20Local() {
  const now = new Date();
  const day = now.getDay(); // 0=dom, 5=ven
  const target = new Date(now);

  const diff = (5 - day + 7) % 7;
  target.setDate(now.getDate() + diff);
  target.setHours(20, 0, 0, 0);

  const pad = (n: number) => String(n).padStart(2, "0");
  const y = target.getFullYear();
  const m = pad(target.getMonth() + 1);
  const d = pad(target.getDate());
  const hh = pad(target.getHours());
  const mm = pad(target.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}
