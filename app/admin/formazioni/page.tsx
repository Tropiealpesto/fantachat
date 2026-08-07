"use client";

import { useEffect, useState } from "react";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import CompetitionBadge from "../../components/CompetitionBadge";
import { useRequireLeagueAdmin } from "../../hooks/useRequireApp";
import { supabase } from "../../../lib/supabaseClient";

type Matchday = {
  id: string;
  number: number;
  status: string;
};

type Row = {
  user_id: string;
  team_name: string;
  rank: number | null;
  slot_order: number | null;
  slot_start: string | null;
  slot_end: string | null;
  lineup_id: string | null;
  submitted_at: string | null;
  players_count: number;
  coach_count: number;
};

type Data = {
  slot_duration_minutes: number;
  matchday: Matchday | null;
  rows: Row[];
};

const EMPTY: Data = {
  slot_duration_minutes: 15,
  matchday: null,
  rows: [],
};

function time(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function submitted(value?: string | null) {
  if (!value) return "Non inviata";
  return `Inviata ${time(value)}`;
}

export default function AdminFormazioniPage() {
  const app = useRequireLeagueAdmin();
  const [data, setData] = useState<Data>(EMPTY);
  const [minutes, setMinutes] = useState(15);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    if (!app.activeLeagueCompetitionId) return;

    setLoading(true);
    setErr(null);

    const { data: rpcData, error } = await supabase.rpc("admin_get_lineup_management", {
      p_league_competition_id: app.activeLeagueCompetitionId,
    });

    setLoading(false);

    if (error) {
      setErr(error.message);
      return;
    }

    const next = {
      ...EMPTY,
      ...(rpcData as Partial<Data>),
      rows: ((rpcData as any)?.rows ?? []) as Row[],
    };
    setData(next);
    setMinutes(Number(next.slot_duration_minutes ?? 15));
  }

  useEffect(() => {
    if (!app.ready) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.ready, app.activeLeagueCompetitionId]);

  async function saveDuration() {
    if (!app.activeLeagueCompetitionId) return;

    setMsg(null);
    setErr(null);
    setBusy("duration");

    const { error } = await supabase.rpc("admin_set_slot_duration", {
      p_league_competition_id: app.activeLeagueCompetitionId,
      p_minutes: minutes,
    });

    setBusy(null);

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg("Durata slot aggiornata. Verrà usata alla prossima apertura giornata.");
    await load();
  }

  async function reset(row: Row) {
    if (!app.activeLeagueCompetitionId || !data.matchday?.id) return;
    if (!window.confirm(`Cancellare la formazione di ${row.team_name}?`)) return;

    setMsg(null);
    setErr(null);
    setBusy(row.user_id);

    const { error } = await supabase.rpc("reset_user_lineup", {
      p_league_competition_id: app.activeLeagueCompetitionId,
      p_user_id: row.user_id,
      p_matchday_id: data.matchday.id,
    });

    setBusy(null);

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg(`Formazione cancellata: ${row.team_name}`);
    await load();
  }

  return (
    <>
      <AppBar
        league={app.leagueName}
        team={`${app.teamName} · ADMIN`}
        onMenuOpen={app.openDrawer}
      />

      <main style={s.container}>
        <section style={s.hero}>
          <CompetitionBadge name={app.competitionName} type={app.competitionType} />
          <h1 style={s.title}>Formazioni e slot</h1>
          <p style={s.subtitle}>
            Controlla gli invii della tua lega. Apertura, chiusura e calcoli restano al superadmin.
          </p>
        </section>

        {msg && <div style={s.ok}>{msg}</div>}
        {err && <div style={s.err}>{err}</div>}

        <section style={s.card}>
          <div>
            <h2 style={s.cardTitle}>Durata slot</h2>
            <p style={s.muted}>
              Valore unico per tutti i partecipanti. Alla prossima giornata gli slot saranno creati dall’ultimo al primo in classifica.
            </p>
          </div>

          <div style={s.durationRow}>
            <input
              type="number"
              min={3}
              max={180}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value) || 15)}
              style={s.input}
            />
            <button
              type="button"
              onClick={saveDuration}
              disabled={busy === "duration"}
              style={s.primaryBtn}
            >
              {busy === "duration" ? "Salvo..." : "Salva"}
            </button>
          </div>
        </section>

        <section style={s.card}>
          <div style={s.cardHead}>
            <div>
              <h2 style={s.cardTitle}>Giornata attiva</h2>
              <p style={s.muted}>
                {data.matchday ? `Giornata ${data.matchday.number}` : "Nessuna giornata aperta."}
              </p>
            </div>
            <button type="button" onClick={load} style={s.secondaryBtn}>
              Aggiorna
            </button>
          </div>

          {loading ? (
            <div style={s.empty}>Caricamento formazioni...</div>
          ) : data.rows.length === 0 ? (
            <div style={s.empty}>Nessun partecipante trovato per questa competizione.</div>
          ) : (
            <div style={s.list}>
              {data.rows.map((row) => {
                const hasLineup = Boolean(row.lineup_id);
                return (
                  <div key={row.user_id} style={s.row}>
                    <div style={s.rank}>{row.rank ?? "—"}</div>
                    <div style={s.rowMain}>
                      <b>{row.team_name}</b>
                      <span>
                        Slot {row.slot_order ?? "—"} · {time(row.slot_start)}-{time(row.slot_end)}
                      </span>
                      <small>{submitted(row.submitted_at)}</small>
                    </div>
                    <div style={s.rowSide}>
                      <span style={{ ...s.status, ...(hasLineup ? s.statusOk : s.statusWait) }}>
                        {hasLineup ? `${row.players_count + row.coach_count}` : "—"}
                      </span>
                      <button
                        type="button"
                        onClick={() => reset(row)}
                        disabled={!hasLineup || busy === row.user_id}
                        style={{
                          ...s.resetBtn,
                          opacity: !hasLineup || busy === row.user_id ? 0.45 : 1,
                        }}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 520,
    margin: "0 auto",
    padding: "12px 14px calc(72px + env(safe-area-inset-bottom, 0px) + 18px)",
    display: "grid",
    gap: 10,
  },
  hero: {
    background: "white",
    border: "1px solid rgba(226,232,240,.92)",
    borderRadius: 12,
    padding: 14,
    boxShadow: "0 3px 12px rgba(15,23,42,.035)",
  },
  title: {
    margin: "12px 0 3px",
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.05,
    fontWeight: 900,
    letterSpacing: "-0.025em",
  },
  subtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: 12.5,
    lineHeight: 1.35,
    fontWeight: 750,
  },
  card: {
    background: "white",
    border: "1px solid rgba(226,232,240,.92)",
    borderRadius: 12,
    padding: 14,
    display: "grid",
    gap: 10,
    boxShadow: "0 3px 12px rgba(15,23,42,.035)",
  },
  cardHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 17,
    fontWeight: 950,
  },
  muted: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 12.5,
    lineHeight: 1.35,
    fontWeight: 750,
  },
  durationRow: {
    display: "grid",
    gridTemplateColumns: "1fr 112px",
    gap: 8,
  },
  input: {
    width: "100%",
    padding: 12,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    color: "#0f172a",
    fontWeight: 900,
    fontFamily: "inherit",
    outline: "none",
  },
  primaryBtn: {
    padding: 12,
    border: 0,
    borderRadius: 10,
    background: "#16a34a",
    color: "white",
    fontWeight: 900,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "9px 11px",
    border: "1px solid #e1e7e3",
    borderRadius: 10,
    background: "#fbfdfb",
    color: "#15803d",
    fontWeight: 900,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  list: {
    display: "grid",
    gap: 8,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "34px 1fr auto",
    alignItems: "center",
    gap: 10,
    padding: 11,
    border: "1px solid #eef2f0",
    borderRadius: 11,
    background: "#fbfdfb",
  },
  rank: {
    width: 30,
    height: 30,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    color: "#15803d",
    background: "#edf8ef",
    fontSize: 13,
    fontWeight: 950,
  },
  rowMain: {
    minWidth: 0,
    display: "grid",
    gap: 2,
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 850,
  },
  rowSide: {
    display: "grid",
    justifyItems: "end",
    gap: 5,
  },
  status: {
    minWidth: 34,
    height: 24,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    fontSize: 12,
    fontWeight: 950,
  },
  statusOk: {
    background: "#dcfce7",
    color: "#15803d",
  },
  statusWait: {
    background: "#f1f5f9",
    color: "#64748b",
  },
  resetBtn: {
    border: "1px solid #f4c99d",
    background: "#fff7ed",
    color: "#c56b14",
    borderRadius: 8,
    padding: "6px 8px",
    fontSize: 11,
    fontWeight: 900,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  empty: {
    border: "1px dashed #d1d5db",
    borderRadius: 10,
    padding: 12,
    color: "#64748b",
    fontSize: 12.5,
    fontWeight: 800,
  },
  ok: {
    background: "#f0fdf4",
    border: "1px solid #86efac",
    color: "#15803d",
    borderRadius: 10,
    padding: 10,
    fontWeight: 850,
    fontSize: 13,
  },
  err: {
    background: "#fff3e4",
    border: "1px solid #f4c99d",
    color: "#b85c0a",
    borderRadius: 10,
    padding: 10,
    fontWeight: 850,
    fontSize: 13,
  },
};
