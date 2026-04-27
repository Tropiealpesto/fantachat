"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import { useApp } from "../../components/AppContext";

type SeasonMd = { id: string; number: number };
type Player = { id: string; name: string; role: "GK" | "DEF" | "MID" | "FWD"; real_team_id: string };
type RealTeam = { id: string; name: string };

type EventForm = {
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  clean_sheet: boolean;
  goals_conceded: number;
  pen_missed: number;
  subbed_on: boolean;
  subbed_off: boolean;
};

const EMPTY: EventForm = {
  goals: 0,
  assists: 0,
  yellow: 0,
  red: 0,
  clean_sheet: false,
  goals_conceded: 0,
  pen_missed: 0,
  subbed_on: false,
  subbed_off: false,
};

export default function AdminStatistichePage() {
  const router = useRouter();
  const { ready, userId, userEmail, openDrawer } = useApp();

  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [seasonMatchdays, setSeasonMatchdays] = useState<SeasonMd[]>([]);
  const [seasonMatchdayId, setSeasonMatchdayId] = useState<string>("");
  const [seasonMatchdayNumber, setSeasonMatchdayNumber] = useState<number | null>(null);

  const [players, setPlayers] = useState<Player[]>([]);
  const [realTeams, setRealTeams] = useState<Map<string, string>>(new Map());

  const [playerText, setPlayerText] = useState("");
  const [playerId, setPlayerId] = useState<string>("");

  const [form, setForm] = useState<EventForm>({ ...EMPTY });
  const [busy, setBusy] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // label: "Nome (Squadra)"
  const labelFor = (p: Player) => {
    const t = realTeams.get(p.real_team_id) || "";
    return t ? `${p.name} (${t})` : p.name;
  };

  const labelToId = useMemo(() => {
    const m = new Map<string, string>();
    players.forEach((p) => m.set(labelFor(p), p.id));
    return m;
  }, [players, realTeams]);

  const selectedPlayer = useMemo(() => players.find((p) => p.id === playerId) || null, [players, playerId]);

  useEffect(() => {
    async function run() {
      if (!ready) return;

      if (!userId) {
        router.replace("/login");
        return;
      }

      // super-admin check
      const email = (userEmail || "").toLowerCase();
      const { data: admin } = await supabase
        .from("app_admins")
        .select("email")
        .eq("email", email)
        .maybeSingle();

      if (!admin) {
        router.replace("/");
        return;
      }
      setIsSuperAdmin(true);

      // season matchdays
      const { data: sm } = await supabase
        .from("season_matchdays")
        .select("id, number")
        .order("number", { ascending: true });

      const smList = (sm || []) as SeasonMd[];
      setSeasonMatchdays(smList);
      setSeasonMatchdayId(smList[0]?.id ?? "");
      setSeasonMatchdayNumber(smList[0]?.number ?? null);

      // real teams
      const { data: rt } = await supabase.from("real_teams").select("id, name");
      const rtMap = new Map<string, string>();
      (rt || []).forEach((x: any) => rtMap.set(x.id, x.name));
      setRealTeams(rtMap);

      // players
      const { data: pl } = await supabase
        .from("players")
        .select("id, name, role, real_team_id")
        .eq("active", true)
        .order("name", { ascending: true });

      setPlayers((pl || []) as any);

      setLoading(false);
    }

    run();
  }, [ready, userId, userEmail, router]);

  // quando cambi giornata selezionata
  useEffect(() => {
    const md = seasonMatchdays.find((x) => x.id === seasonMatchdayId);
    setSeasonMatchdayNumber(md?.number ?? null);

    // reset player selection + form
    setPlayerText("");
    setPlayerId("");
    setForm({ ...EMPTY });
    setMsg(null);
    setErr(null);
  }, [seasonMatchdayId, seasonMatchdays]);

  // quando digiti/selezi un player (datalist), risolvi id e carica i valori già salvati
  useEffect(() => {
    async function resolveAndLoad() {
      setMsg(null);
      setErr(null);

      const id = labelToId.get(playerText) || "";
      setPlayerId(id);

      if (!id || !seasonMatchdayId) {
        setForm({ ...EMPTY });
        return;
      }

      const { data, error } = await supabase
        .from("player_events")
        .select("goals, assists, yellow, red, clean_sheet, goals_conceded, pen_missed, subbed_on, subbed_off")
        .eq("season_matchday_id", seasonMatchdayId)
        .eq("player_id", id)
        .maybeSingle();

      if (error) {
        // se non esiste, non è un errore: settiamo vuoto
        setForm({ ...EMPTY });
        return;
      }

      if (data) {
        setForm({
          goals: Number((data as any).goals ?? 0),
          assists: Number((data as any).assists ?? 0),
          yellow: Number((data as any).yellow ?? 0),
          red: Number((data as any).red ?? 0),
          clean_sheet: Boolean((data as any).clean_sheet ?? false),
          goals_conceded: Number((data as any).goals_conceded ?? 0),
          pen_missed: Number((data as any).pen_missed ?? 0),
          subbed_on: Boolean((data as any).subbed_on ?? false),
          subbed_off: Boolean((data as any).subbed_off ?? false),
        });
      } else {
        setForm({ ...EMPTY });
      }
    }

    resolveAndLoad();
  }, [playerText, labelToId, seasonMatchdayId]);

  function step(field: keyof EventForm, delta: number) {
    setForm((prev) => {
      const cur = Number(prev[field] as any) || 0;
      const next = Math.max(0, cur + delta);
      return { ...prev, [field]: next } as any;
    });
  }

  function toggle(field: keyof EventForm) {
    setForm((prev) => ({ ...prev, [field]: !Boolean(prev[field]) } as any));
  }

  async function save() {
    setMsg(null);
    setErr(null);

    if (!seasonMatchdayId) return setErr("Seleziona una giornata.");
    if (!playerId) return setErr("Seleziona un giocatore dalla lista.");

    setBusy(true);
    const { error } = await supabase.rpc("upsert_player_event", {
      p_season_matchday_id: seasonMatchdayId,
      p_player_id: playerId,
      p_goals: form.goals,
      p_assists: form.assists,
      p_yellow: form.yellow,
      p_red: form.red,
      p_clean_sheet: form.clean_sheet,
      p_goals_conceded: form.goals_conceded,
      p_pen_missed: form.pen_missed,
      p_subbed_on: form.subbed_on,
      p_subbed_off: form.subbed_off,
    });
    setBusy(false);

    if (error) return setErr(error.message);
    setMsg("Statistiche salvate ✅");
  }

  if (!ready) return <main className="container">Caricamento...</main>;
  if (loading) return <main className="container">Caricamento...</main>;

  return (
    <>
      <AppBar league="FantaChat" team="Super Admin • Statistiche" />

      <main className="container">
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 1000 }}>Statistiche giocatori</div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
            Seleziona giornata e giocatore, poi inserisci eventi.
          </div>

          {/* Selezione giornata */}
          <div style={{ marginTop: 12, fontWeight: 1000 }}>Giornata stagione</div>
          <select
            value={seasonMatchdayId}
            onChange={(e) => setSeasonMatchdayId(e.target.value)}
            style={selectStyle}
          >
            {seasonMatchdays.map((m) => (
              <option key={m.id} value={m.id}>
                Giornata {m.number}
              </option>
            ))}
          </select>

          {/* Ricerca giocatore */}
          <div style={{ marginTop: 12, fontWeight: 1000 }}>Giocatore</div>
          <input
            list="dl_players"
            value={playerText}
            onChange={(e) => setPlayerText(e.target.value)}
            placeholder="Cerca: Nome (Squadra)"
            style={selectStyle}
          />
          <datalist id="dl_players">
            {players.map((p) => (
              <option key={p.id} value={labelFor(p)} />
            ))}
          </datalist>

          {selectedPlayer && (
            <div style={{ marginTop: 10, color: "var(--muted)", fontWeight: 800 }}>
              Ruolo: <b>{selectedPlayer.role}</b>
            </div>
          )}
        </div>

        {/* Editor eventi */}
        <div className="card" style={{ padding: 16, marginTop: 12, borderLeft: "6px solid var(--accent)" }}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>
            Eventi {seasonMatchdayNumber ? `(Giornata ${seasonMatchdayNumber})` : ""}
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <Stepper label="Gol" value={form.goals} onMinus={() => step("goals", -1)} onPlus={() => step("goals", +1)} />
            <Stepper label="Assist" value={form.assists} onMinus={() => step("assists", -1)} onPlus={() => step("assists", +1)} />
            <Stepper label="Giallo" value={form.yellow} onMinus={() => step("yellow", -1)} onPlus={() => step("yellow", +1)} />
            <Stepper label="Rosso" value={form.red} onMinus={() => step("red", -1)} onPlus={() => step("red", +1)} />

            <Toggle label="Porta inviolata (GK + DEF)" checked={form.clean_sheet} onClick={() => toggle("clean_sheet")} />

            <Stepper label="Gol subito (solo GK)" value={form.goals_conceded} onMinus={() => step("goals_conceded", -1)} onPlus={() => step("goals_conceded", +1)} />
            <Stepper label="Rigore sbagliato" value={form.pen_missed} onMinus={() => step("pen_missed", -1)} onPlus={() => step("pen_missed", +1)} />

            <Toggle label="Subentrato" checked={form.subbed_on} onClick={() => toggle("subbed_on")} />
            <Toggle label="Sostituito" checked={form.subbed_off} onClick={() => toggle("subbed_off")} />
          </div>

          <button className="btn btn-primary" style={{ marginTop: 14, width: "100%", padding: 12 }} onClick={save} disabled={busy}>
            {busy ? "Salvataggio..." : "Salva"}
          </button>

          {msg && <div style={{ marginTop: 12, color: "var(--primary-dark)", fontWeight: 900 }}>{msg}</div>}
          {err && <div style={{ marginTop: 12, color: "var(--accent-dark)", fontWeight: 900 }}>{err}</div>}
        </div>
      </main>

      <BottomNav />
    </>
  );
}

function Stepper(props: { label: string; value: number; onMinus: () => void; onPlus: () => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center" }}>
      <div style={{ fontWeight: 900 }}>{props.label}</div>
      <button className="btn" type="button" onClick={props.onMinus} style={{ border: "1px solid var(--border)" }}>
        −
      </button>
      <div style={{ minWidth: 44, textAlign: "center", fontWeight: 1000 }}>{props.value}</div>
      <button className="btn" type="button" onClick={props.onPlus} style={{ border: "1px solid var(--border)" }}>
        +
      </button>
    </div>
  );
}

function Toggle(props: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="card"
      style={{
        padding: 12,
        boxShadow: "none",
        border: "1px solid var(--border)",
        borderLeft: props.checked ? "6px solid var(--primary)" : "6px solid transparent",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <div style={{ fontWeight: 1000 }}>{props.label}</div>
      <div style={{ marginTop: 4, color: props.checked ? "var(--primary-dark)" : "var(--muted)", fontWeight: 900 }}>
        {props.checked ? "ON" : "OFF"}
      </div>
    </button>
  );
}

const selectStyle: any = {
  width: "100%",
  marginTop: 8,
  padding: 12,
  borderRadius: 12,
  border: "1px solid var(--border)",
  fontWeight: 900,
  background: "white",
};
