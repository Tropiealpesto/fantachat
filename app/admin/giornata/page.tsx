"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import { useApp } from "../../components/AppContext";

type Matchday = { id: string; number: number; status: string };
type Team = { id: string; name: string };

type ScheduleRow = {
  slot_start_at: string;
  slot_end_at: string;
  submitted_at: string | null;
  submitted_status: "none" | "early" | "within" | "late";
  teams: { name: string } | null;
};

export default function AdminGiornataPage() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamId, teamName, role } = useApp();

  const [loading, setLoading] = useState(true);

  const [current, setCurrent] = useState<Matchday | null>(null);
  const [numberToOpen, setNumberToOpen] = useState(1);

  // schedule settings
  const [deadlineEndLocal, setDeadlineEndLocal] = useState<string>("");
  const [slotMinutes, setSlotMinutes] = useState<number>(90);

  // recap whatsapp
  const [recapText, setRecapText] = useState<string>("");
  const [recapLoading, setRecapLoading] = useState(false);

  // reset rosa
  const [teams, setTeams] = useState<Team[]>([]);
  const [resetTeamId, setResetTeamId] = useState<string>("");
  const [resetting, setResetting] = useState(false);

  // schedule status view
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    if (!activeLeagueId) return;

    const { data: md } = await supabase
      .from("matchdays")
      .select("id, number, status")
      .eq("league_id", activeLeagueId)
      .eq("status", "open")
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();

    setCurrent(md ?? null);

    const { data: last } = await supabase
      .from("matchdays")
      .select("number")
      .eq("league_id", activeLeagueId)
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();

    setNumberToOpen(((last?.number ?? 0) + 1) || 1);
    setRecapText("");

    // carica schedule se giornata open esiste
    if (md?.id) {
      await loadSchedule(md.id);
    } else {
      setScheduleRows([]);
    }
  }

  async function loadTeams() {
    if (!activeLeagueId) return;

    const { data } = await supabase
      .from("teams")
      .select("id, name")
      .eq("league_id", activeLeagueId)
      .order("name", { ascending: true });

    const list = (data || []) as Team[];
    setTeams(list);
    setResetTeamId(list[0]?.id ?? "");
  }

  async function loadSchedule(matchdayId: string) {
    if (!activeLeagueId) return;

    setScheduleLoading(true);

    const { data } = await supabase
      .from("pick_schedule")
      .select("slot_start_at, slot_end_at, submitted_at, submitted_status, teams(name)")
      .eq("league_id", activeLeagueId)
      .eq("matchday_id", matchdayId)
      .order("slot_start_at", { ascending: true });

    setScheduleRows((data || []) as any);
    setScheduleLoading(false);
  }

  useEffect(() => {
    async function run() {
      if (!ready) return;

      if (!userId) return router.replace("/login");
      if (!activeLeagueId || !teamId) return router.replace("/seleziona-lega");
      if (role !== "admin") return router.replace("/");

      setDeadlineEndLocal(suggestFriday20Local());
      await loadTeams();
      await refresh();

      setLoading(false);
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, userId, activeLeagueId, teamId, role]);

  async function openDay() {
    setMsg(null);
    setErr(null);

    const { error } = await supabase.rpc("open_matchday", { p_number: numberToOpen });
    if (error) return setErr(error.message);

    setMsg(`Giornata ${numberToOpen} aperta ✅`);
    await refresh();
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
    await loadSchedule(current.id);
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
    await refresh();
  }

  async function resetPick() {
    setMsg(null);
    setErr(null);

    if (!current) return setErr("Nessuna giornata open.");
    if (!resetTeamId) return setErr("Seleziona una squadra.");

    if (!confirm("Confermi reset rosa per questa squadra? (Cancella la formazione della giornata)")) return;

    setResetting(true);
    const { error } = await supabase.rpc("admin_reset_team_pick", {
      p_matchday_id: current.id,
      p_team_id: resetTeamId,
    });
    setResetting(false);

    if (error) return setErr(error.message);

    const tName = teams.find((t) => t.id === resetTeamId)?.name || "Squadra";
    setMsg(`Rosa resettata ✅ (${tName})`);
    await loadSchedule(current.id);
  }

  async function generateRecapWhatsapp() {
    setMsg(null);
    setErr(null);
    setRecapText("");

    if (!current) return setErr("Apri prima una giornata.");
    if (!deadlineEndLocal) return setErr("Seleziona una data/ora di fine slot.");

    const iso = new Date(deadlineEndLocal).toISOString();

    // 1) salva settings (matchday_settings)
    const { error: sErr } = await supabase.rpc("set_matchday_settings", {
      p_matchday_id: current.id,
      p_deadline_end_at: iso,
      p_slot_minutes: slotMinutes,
    });
    if (sErr) return setErr(sErr.message);

    // 2) genera schedule
    const { data: count, error: gErr } = await supabase.rpc("generate_pick_schedule", {
      p_matchday_id: current.id,
    });
    if (gErr) return setErr(gErr.message);

    // 3) ricarica schedule per mostrare stato
    await loadSchedule(current.id);

    // 4) genera testo whatsapp
    setRecapLoading(true);
    const { data: recap, error: rErr } = await supabase.rpc("get_pick_schedule_recap_text", {
      p_matchday_id: current.id,
    });
    setRecapLoading(false);

    if (rErr) return setErr(rErr.message);

    const txt = String(recap || "").trim();
    if (!txt) {
      setErr("Recap vuoto: sembra che lo schedule non sia stato generato correttamente.");
      return;
    }

    setRecapText(txt);
    setMsg(`Recap pronto ✅ (${count} squadre)`);
  }

  async function copyRecap() {
    try {
      await navigator.clipboard.writeText(recapText);
      setMsg("Recap copiato ✅ Incollalo su WhatsApp.");
    } catch {
      setErr("Impossibile copiare automaticamente. Seleziona il testo e copia manualmente.");
    }
  }

  if (!ready) return <main className="container">Caricamento...</main>;
  if (loading) return <main className="container">Caricamento...</main>;

  return (
    <>
      <AppBar league={leagueName} team={`${teamName} • ADMIN`} />

      <main className="container">
        {/* GIORNATA */}
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

        {/* RESET ROSA */}
        <div className="card" style={{ padding: 16, marginTop: 12, borderLeft: "6px solid var(--accent)" }}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Reset rosa (Admin)</div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
            Cancella la formazione della squadra selezionata per la giornata open.
          </div>

          <select
            value={resetTeamId}
            onChange={(e) => setResetTeamId(e.target.value)}
            style={{ width: "100%", marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid var(--border)", fontWeight: 900 }}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
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

        {/* STATO INSERIMENTO */}
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Stato inserimento formazioni</div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
            Vedi orario reale di invio e stato (early/within/late).
          </div>

          {scheduleLoading ? (
            <div style={{ marginTop: 10, color: "var(--muted)", fontWeight: 800 }}>Caricamento...</div>
          ) : scheduleRows.length === 0 ? (
            <div style={{ marginTop: 10, color: "var(--muted)", fontWeight: 800 }}>
              Nessuno schedule generato (premi “Genera recap WhatsApp”).
            </div>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {scheduleRows.map((r, i) => {
                const start = new Date(r.slot_start_at);
                const end = new Date(r.slot_end_at);
                const sub = r.submitted_at ? new Date(r.submitted_at) : null;

                const fmt = (d: Date) => d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

                let statusLabel = r.submitted_status;
                let statusColor = "var(--muted)";
                if (r.submitted_status === "within") statusColor = "var(--primary-dark)";
                if (r.submitted_status === "late") statusColor = "var(--accent-dark)";
                if (r.submitted_status === "early") statusColor = "#2563eb";

                return (
                  <div
                    key={i}
                    style={{
                      padding: 10,
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "center",
                      fontSize: 14,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 1000, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.teams?.name || "Squadra"}
                      </div>
                      <div style={{ color: "var(--muted)", fontWeight: 800 }}>
                        {fmt(start)} - {fmt(end)}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", minWidth: 110 }}>
                      {sub ? (
                        <>
                          <div style={{ fontWeight: 1000 }}>{fmt(sub)}</div>
                          <div style={{ fontWeight: 1000, color: statusColor }}>{statusLabel}</div>
                        </>
                      ) : (
                        <div style={{ color: "var(--muted)", fontWeight: 800 }}>Non inviato</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* WHATSAPP RECAP */}
        <div className="card" style={{ padding: 16, marginTop: 12, borderLeft: "6px solid var(--accent)" }}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Slot inserimento Rosa (WhatsApp)</div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
            Imposta fine slot e genera recap da copiare. (Salta 22:00–09:30)
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
            onClick={generateRecapWhatsapp}
            disabled={!current}
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

        {msg && (
          <div className="card" style={{ padding: 14, marginTop: 12, borderLeft: "6px solid var(--primary)", fontWeight: 900, color: "var(--primary-dark)" }}>
            {msg}
          </div>
        )}
        {err && (
          <div className="card" style={{ padding: 14, marginTop: 12, borderLeft: "6px solid var(--accent)", fontWeight: 900, color: "var(--accent-dark)" }}>
            {err}
          </div>
        )}
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
