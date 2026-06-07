"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import CompetitionBadge from "../components/CompetitionBadge";
import { useApp } from "../components/AppContext";
import { supabase } from "../../lib/supabaseClient";

type Competition = {
  id: string;
  name: string;
  slug: string;
  type: string;
  theme_key: string | null;
  active: boolean;
  visibility_status: string;
  default_total_matchdays: number;
  default_top_n: number;
  scope: string | null;
  description: string | null;
  rules_summary: string | null;
  active_season_id: string | null;
  active_season_name: string | null;
  players_count: number;
};

type Player = {
  id: string;
  name: string;
  role: string;
  team_name: string;
};

type Stats = {
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  goals_conceded: number;
  pen_saved: number;
  pen_missed: number;
  clean_sheet: boolean;
};

const EMPTY_STATS: Stats = {
  goals: 0,
  assists: 0,
  yellow: 0,
  red: 0,
  goals_conceded: 0,
  pen_saved: 0,
  pen_missed: 0,
  clean_sheet: false,
};

export default function SuperadminPage() {
  const app = useApp();
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState("");
  const [matchday, setMatchday] = useState(1);

  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const selectedCompetition = useMemo(
    () => competitions.find((c) => c.id === selectedCompetitionId) ?? null,
    [competitions, selectedCompetitionId]
  );

  useEffect(() => {
    async function check() {
      if (!app.ready) return;

      if (!app.userId) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase.rpc("is_current_user_superadmin");

      if (error || data !== true) {
        setIsSuperadmin(false);
        setChecking(false);
        return;
      }

      setIsSuperadmin(true);
      setChecking(false);
      loadCompetitions();
    }

    check();
  }, [app.ready, app.userId, router]);

  async function loadCompetitions() {
    setErr(null);

    const { data, error } = await supabase.rpc("superadmin_get_competitions");

    if (error) {
      setErr(error.message);
      return;
    }

    const list = (data ?? []) as Competition[];

    setCompetitions(list);

    if (!selectedCompetitionId && list.length) {
      const first = list.find((c) => c.visibility_status === "active") ?? list[0];
      setSelectedCompetitionId(first.id);
      setMatchday(1);
    }
  }

  async function setStatus(competitionId: string, status: "active" | "wip" | "archived") {
    setErr(null);
    setMsg(null);

    const { error } = await supabase.rpc("superadmin_set_competition_status", {
      p_competition_id: competitionId,
      p_visibility_status: status,
      p_active: status !== "archived",
    });

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg("Stato competizione aggiornato ✅");
    await loadCompetitions();
  }

  async function searchPlayers() {
    setErr(null);
    setMsg(null);
    setSelectedPlayer(null);

    if (!selectedCompetitionId) {
      setErr("Seleziona una competizione.");
      return;
    }

    const { data, error } = await supabase.rpc("superadmin_search_players_for_vote", {
      p_competition_id: selectedCompetitionId,
      p_query: query.trim(),
    });

    if (error) {
      setErr(error.message);
      return;
    }

    setPlayers((data ?? []) as Player[]);
  }

  async function pickPlayer(player: Player) {
    setSelectedPlayer(player);
    setMsg(null);
    setErr(null);

    if (!selectedCompetition?.active_season_id) {
      setErr("Questa competizione non ha una season attiva.");
      return;
    }

    const { data, error } = await supabase.rpc("superadmin_get_player_stats", {
      p_competition_id: selectedCompetition.id,
      p_season_id: selectedCompetition.active_season_id,
      p_matchday_number: matchday,
      p_real_player_id: player.id,
    });

    if (error) {
      setErr(error.message);
      return;
    }

    setStats({
      goals: Number(data?.goals ?? 0),
      assists: Number(data?.assists ?? 0),
      yellow: Number(data?.yellow ?? 0),
      red: Number(data?.red ?? 0),
      goals_conceded: Number(data?.goals_conceded ?? 0),
      pen_saved: Number(data?.pen_saved ?? 0),
      pen_missed: Number(data?.pen_missed ?? 0),
      clean_sheet: Boolean(data?.clean_sheet ?? false),
    });
  }

  function setStat<K extends keyof Stats>(key: K, value: Stats[K]) {
    setStats((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function saveStats() {
    setErr(null);
    setMsg(null);

    if (!selectedCompetition?.active_season_id) {
      setErr("Competizione senza season attiva.");
      return;
    }

    if (!selectedPlayer) {
      setErr("Seleziona un giocatore.");
      return;
    }

    setSaving(true);

    const { data, error } = await supabase.rpc("superadmin_upsert_player_stats", {
      p_competition_id: selectedCompetition.id,
      p_season_id: selectedCompetition.active_season_id,
      p_matchday_number: matchday,
      p_real_player_id: selectedPlayer.id,
      p_goals: stats.goals,
      p_assists: stats.assists,
      p_yellow: stats.yellow,
      p_red: stats.red,
      p_goals_conceded: stats.goals_conceded,
      p_pen_saved: stats.pen_saved,
      p_pen_missed: stats.pen_missed,
      p_clean_sheet: stats.clean_sheet,
    });

    setSaving(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg(`Statistiche salvate ✅ Totale: ${data?.total_points_base ?? 0}`);
  }

  if (!app.ready || checking) {
    return (
      <main style={s.container}>
        <div style={s.card}>Caricamento superadmin...</div>
      </main>
    );
  }

  if (!isSuperadmin) {
    return (
      <main style={s.container}>
        <div style={s.card}>
          <h1>Accesso negato</h1>
          <p>Questa sezione è riservata al superadmin.</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <AppBar
        league="FantaChat"
        team="SUPERADMIN"
        onMenuOpen={app.openDrawer}
      />

      <main style={s.container}>
        <div style={s.hero}>
          <h1 style={s.title}>Superadmin</h1>
          <p style={s.subtitle}>
            Gestisci disponibilità competizioni e statistiche giocatori.
          </p>
        </div>

        {err && <div style={s.err}>{err}</div>}
        {msg && <div style={s.ok}>{msg}</div>}

        <section style={s.card}>
          <h2 style={s.cardTitle}>Competizioni</h2>
          <p style={s.muted}>
            Attiva o archivia le competizioni disponibili agli admin delle leghe.
          </p>

          <div style={s.compList}>
            {competitions.map((c) => (
              <div key={c.id} style={s.compRow}>
                <div style={{ minWidth: 0 }}>
                  <CompetitionBadge name={c.name} type={c.type} />
                  <div style={s.compName}>{c.name}</div>
                  <div style={s.compMeta}>
                    {c.visibility_status} · {c.default_total_matchdays} giornate · Top {c.default_top_n} · {c.players_count} giocatori
                  </div>
                </div>

                <div style={s.compActions}>
                  <button
                    type="button"
                    style={s.smallBtn}
                    onClick={() => setStatus(c.id, "active")}
                  >
                    Attiva
                  </button>
                  <button
                    type="button"
                    style={s.smallBtn}
                    onClick={() => setStatus(c.id, "wip")}
                  >
                    WIP
                  </button>
                  <button
                    type="button"
                    style={s.smallBtnDanger}
                    onClick={() => setStatus(c.id, "archived")}
                  >
                    Archivia
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={s.card}>
          <h2 style={s.cardTitle}>Statistiche giocatore</h2>
          <p style={s.muted}>
            Scegli competizione, giornata e giocatore. Salva le statistiche reali.
          </p>

          <label style={s.label}>Competizione</label>
          <select
            value={selectedCompetitionId}
            onChange={(e) => {
              setSelectedCompetitionId(e.target.value);
              setPlayers([]);
              setSelectedPlayer(null);
              setStats(EMPTY_STATS);
              setMsg(null);
              setErr(null);
            }}
            style={s.input}
          >
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.visibility_status})
              </option>
            ))}
          </select>

          <label style={s.label}>Giornata</label>
          <input
            type="number"
            min={1}
            max={selectedCompetition?.default_total_matchdays ?? 38}
            value={matchday}
            onChange={(e) => {
              setMatchday(Number(e.target.value) || 1);
              setSelectedPlayer(null);
              setStats(EMPTY_STATS);
            }}
            style={s.input}
          />

          <label style={s.label}>Cerca giocatore</label>
          <div style={s.searchRow}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome giocatore o squadra"
              style={s.input}
            />
            <button type="button" onClick={searchPlayers} style={s.searchBtn}>
              Cerca
            </button>
          </div>

          <div style={s.playersList}>
            {players.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pickPlayer(p)}
                style={{
                  ...s.playerRow,
                  borderColor: selectedPlayer?.id === p.id ? "#16a34a" : "#e5e7eb",
                  background: selectedPlayer?.id === p.id ? "#f0fdf4" : "white",
                }}
              >
                <b>{p.name}</b>
                <span>{p.role} · {p.team_name || "—"}</span>
              </button>
            ))}
          </div>

          {selectedPlayer && (
            <div style={s.statsBox}>
              <h3 style={s.selectedTitle}>
                {selectedPlayer.name}
                <small>{selectedPlayer.role} · {selectedPlayer.team_name || "—"}</small>
              </h3>

              <div style={s.statsGrid}>
                <NumberField label="Gol" value={stats.goals} onChange={(v) => setStat("goals", v)} />
                <NumberField label="Assist" value={stats.assists} onChange={(v) => setStat("assists", v)} />
                <NumberField label="Giallo" value={stats.yellow} onChange={(v) => setStat("yellow", v)} />
                <NumberField label="Rosso" value={stats.red} onChange={(v) => setStat("red", v)} />
                <NumberField label="Rigore sbagliato" value={stats.pen_missed} onChange={(v) => setStat("pen_missed", v)} />

                {selectedPlayer.role === "P" && (
                  <>
                    <NumberField label="Gol subito" value={stats.goals_conceded} onChange={(v) => setStat("goals_conceded", v)} />
                    <NumberField label="Rigore parato" value={stats.pen_saved} onChange={(v) => setStat("pen_saved", v)} />
                  </>
                )}
              </div>

              {(selectedPlayer.role === "P" || selectedPlayer.role === "D") && (
                <label style={s.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={stats.clean_sheet}
                    onChange={(e) => setStat("clean_sheet", e.target.checked)}
                  />
                  Clean sheet
                </label>
              )}

              <button
                type="button"
                onClick={saveStats}
                disabled={saving}
                style={s.saveBtn}
              >
                {saving ? "Salvataggio..." : "Salva statistiche"}
              </button>
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </>
  );
}

function NumberField(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label style={s.numberField}>
      <span>{props.label}</span>
      <input
        type="number"
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value) || 0)}
      />
    </label>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 520,
    margin: "0 auto",
    padding: "16px 14px 100px",
    display: "grid",
    gap: 14,
  },
  hero: {
    background: "linear-gradient(160deg,#14532d,#16a34a)",
    color: "white",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 8px 24px rgba(22,163,74,0.20)",
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 1000,
  },
  subtitle: {
    margin: "8px 0 0",
    color: "rgba(255,255,255,0.75)",
    fontWeight: 700,
    lineHeight: 1.4,
  },
  card: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    padding: 16,
    display: "grid",
    gap: 12,
    boxShadow: "0 4px 16px rgba(15,23,42,0.06)",
  },
  cardTitle: {
    margin: 0,
    fontSize: 21,
    fontWeight: 1000,
    color: "#111827",
  },
  muted: {
    margin: 0,
    color: "#6b7280",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.45,
  },
  compList: {
    display: "grid",
    gap: 10,
  },
  compRow: {
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 13,
    display: "grid",
    gap: 10,
  },
  compName: {
    marginTop: 8,
    color: "#111827",
    fontWeight: 1000,
    fontSize: 16,
  },
  compMeta: {
    marginTop: 3,
    color: "#6b7280",
    fontSize: 12,
    fontWeight: 800,
  },
  compActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 8,
  },
  smallBtn: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    background: "white",
    padding: 9,
    fontWeight: 900,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  smallBtnDanger: {
    border: "1px solid #fed7aa",
    borderRadius: 10,
    background: "#fff7ed",
    color: "#ea580c",
    padding: 9,
    fontWeight: 900,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  label: {
    fontSize: 12,
    color: "#374151",
    fontWeight: 1000,
    textTransform: "uppercase",
  },
  input: {
    width: "100%",
    padding: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    fontFamily: "inherit",
    fontWeight: 800,
    background: "white",
  },
  searchRow: {
    display: "grid",
    gridTemplateColumns: "1fr 86px",
    gap: 8,
  },
  searchBtn: {
    border: "none",
    borderRadius: 12,
    background: "#16a34a",
    color: "white",
    fontWeight: 1000,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  playersList: {
    display: "grid",
    gap: 8,
  },
  playerRow: {
    display: "grid",
    gap: 3,
    textAlign: "left",
    border: "1px solid #e5e7eb",
    borderRadius: 13,
    background: "white",
    padding: 12,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  statsBox: {
    display: "grid",
    gap: 12,
    borderTop: "1px solid #e5e7eb",
    paddingTop: 14,
  },
  selectedTitle: {
    margin: 0,
    display: "grid",
    gap: 3,
    color: "#111827",
    fontWeight: 1000,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 9,
  },
  numberField: {
    display: "grid",
    gap: 5,
    color: "#374151",
    fontSize: 12,
    fontWeight: 900,
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    color: "#111827",
    fontWeight: 900,
  },
  saveBtn: {
    border: "none",
    borderRadius: 13,
    background: "#16a34a",
    color: "white",
    padding: 14,
    fontWeight: 1000,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  ok: {
    background: "#f0fdf4",
    border: "1px solid #86efac",
    color: "#15803d",
    borderRadius: 12,
    padding: 12,
    fontWeight: 900,
  },
  err: {
    background: "#fff1f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    borderRadius: 12,
    padding: 12,
    fontWeight: 900,
  },
};
