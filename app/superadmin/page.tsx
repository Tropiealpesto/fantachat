"use client";

import { useEffect, useMemo, useState } from "react";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import CompetitionBadge from "../components/CompetitionBadge";
import { useApp } from "../components/AppContext";
import { supabase } from "../../lib/supabaseClient";

type Tab = "competizioni" | "statistiche" | "top" | "partite";

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
  active_season_id: string | null;
  active_season_name: string | null;
  players_count: number;
  teams_count: number;
};

type Player = { id: string; name: string; role: string; team_name: string };
type Team = { id: string; name: string; country: string };

type Stats = {
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  goals_conceded: number;
  pen_saved: number;
  pen_missed: number;
  clean_sheet: boolean;
  xg: number;
  xa: number;
  passes_completed: number;
  pass_accuracy: number;
  tackles: number;
  interceptions: number;
  npxg: number;
  saves: number;
  save_pct: number;
};

type TopTeam = { id: string; real_team_id: string; team_name: string; rank: number };
type Fixture = {
  id: string;
  home_team_id: string;
  home_team_name: string;
  away_team_id: string;
  away_team_name: string;
  starts_at: string | null;
  status: string;
};

const EMPTY_STATS: Stats = {
  goals: 0, assists: 0, yellow: 0, red: 0,
  goals_conceded: 0, pen_saved: 0, pen_missed: 0, clean_sheet: false,
  xg: 0, xa: 0, passes_completed: 0, pass_accuracy: 0,
  tackles: 0, interceptions: 0, npxg: 0, saves: 0, save_pct: 0,
};

export default function SuperadminPage() {
  const app = useApp();

  const [tab, setTab] = useState<Tab>("competizioni");
  const [checking, setChecking] = useState(true);
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionId, setCompetitionId] = useState("");
  const [matchday, setMatchday] = useState(1);

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const selectedCompetition = useMemo(
    () => competitions.find((c) => c.id === competitionId) ?? null,
    [competitions, competitionId]
  );

  async function loadCompetitions() {
    setErr(null);
    const { data, error } = await supabase.rpc("superadmin_get_competitions");
    if (error) { setErr(error.message); return; }
    const list = ((data ?? []) as Competition[]).filter((c) => {
      const status = c.visibility_status ?? "active";
      return status !== "archived" && c.active !== false;
    });
    setCompetitions(list);
    if (list.length) {
      const stillExists = list.some((c) => c.id === competitionId);
      if (!competitionId || !stillExists) {
        const first = list.find((c) => c.visibility_status === "active") ?? list[0];
        setCompetitionId(first.id);
      }
    } else {
      setCompetitionId("");
    }
  }

  useEffect(() => {
    async function init() {
      if (!app.ready) return;
      const { data, error } = await supabase.rpc("is_current_user_superadmin");
      if (error || data !== true) {
        setChecking(false);
        setIsSuperadmin(false);
        return;
      }
      setIsSuperadmin(true);
      setChecking(false);
      await loadCompetitions();
    }
    init();
  }, [app.ready]);

  async function setCompetitionStatus(id: string, status: "active" | "wip" | "archived") {
    setMsg(null);
    setErr(null);
    const { error } = await supabase.rpc("superadmin_set_competition_status", {
      p_competition_id: id,
      p_visibility_status: status,
      p_active: status !== "archived",
    });
    if (error) { setErr(error.message); return; }
    setMsg("Stato competizione aggiornato ✅");
    await loadCompetitions();
  }

  if (!app.ready || checking) {
    return <Shell app={app}><div style={s.card}>Caricamento superadmin...</div></Shell>;
  }

  if (!isSuperadmin) {
    return (
      <Shell app={app}>
        <div style={s.card}>
          <h1>Accesso negato</h1>
          <p>Questa sezione è riservata al superadmin.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell app={app}>
      <div style={s.hero}>
        <h1 style={s.title}>Superadmin</h1>
        <p style={s.subtitle}>Gestisci competizioni globali, statistiche, top squadre e partite.</p>
      </div>

      {err && <div style={s.err}>{err}</div>}
      {msg && <div style={s.ok}>{msg}</div>}

      <div style={s.tabs}>
        <TabButton active={tab === "competizioni"} onClick={() => setTab("competizioni")}>Competizioni</TabButton>
        <TabButton active={tab === "statistiche"} onClick={() => setTab("statistiche")}>Statistiche</TabButton>
        <TabButton active={tab === "top"} onClick={() => setTab("top")}>Top squadre</TabButton>
        <TabButton active={tab === "partite"} onClick={() => setTab("partite")}>Partite</TabButton>
      </div>

      {tab !== "competizioni" && (
        <Selector
          competitions={competitions}
          competitionId={competitionId}
          setCompetitionId={setCompetitionId}
          matchday={matchday}
          setMatchday={setMatchday}
          selectedCompetition={selectedCompetition}
        />
      )}

      {tab === "competizioni" && (
        <CompetizioniTab
          competitions={competitions}
          onStatus={setCompetitionStatus}
          onCreated={loadCompetitions}
          setErr={setErr}
          setMsg={setMsg}
        />
      )}

      {tab === "statistiche" && selectedCompetition && (
        <StatisticheTab competition={selectedCompetition} matchday={matchday} setErr={setErr} setMsg={setMsg} />
      )}

      {tab === "top" && selectedCompetition && (
        <TopSquadreTab competition={selectedCompetition} matchday={matchday} setErr={setErr} setMsg={setMsg} />
      )}

      {tab === "partite" && selectedCompetition && (
        <PartiteTab competition={selectedCompetition} matchday={matchday} setErr={setErr} setMsg={setMsg} />
      )}
    </Shell>
  );
}

function Shell(props: { app: ReturnType<typeof useApp>; children: React.ReactNode }) {
  return (
    <>
      <AppBar league="FantaChat" team="SUPERADMIN" onMenuOpen={props.app.openDrawer} />
      <main style={s.container}>{props.children}</main>
      <BottomNav />
    </>
  );
}

function TabButton(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        ...s.tab,
        background: props.active ? "#16a34a" : "white",
        color: props.active ? "white" : "#374151",
        borderColor: props.active ? "#16a34a" : "#e5e7eb",
      }}
    >
      {props.children}
    </button>
  );
}

function Selector(props: {
  competitions: Competition[];
  competitionId: string;
  setCompetitionId: (id: string) => void;
  matchday: number;
  setMatchday: (n: number) => void;
  selectedCompetition: Competition | null;
}) {
  return (
    <div style={s.card}>
      <label style={s.label}>Competizione</label>
      <select value={props.competitionId} onChange={(e) => props.setCompetitionId(e.target.value)} style={s.input}>
        {props.competitions.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <label style={s.label}>Giornata</label>
      <input
        type="number"
        min={1}
        max={props.selectedCompetition?.default_total_matchdays ?? 99}
        value={props.matchday}
        onChange={(e) => props.setMatchday(Number(e.target.value) || 1)}
        style={s.input}
      />
    </div>
  );
}

// Ricerca a comparsa riutilizzabile (stile Rosa)
function Typeahead<T extends { id: string }>(props: {
  placeholder: string;
  search: (q: string) => Promise<T[]>;
  renderItem: (item: T) => React.ReactNode;
  onPick: (item: T) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const needle = q.trim();
    if (!needle) { setResults([]); setLoading(false); return; }
    let off = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await props.search(needle);
        if (!off) setResults(r);
      } finally {
        if (!off) setLoading(false);
      }
    }, 220);
    return () => { off = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div style={{ position: "relative" }}>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={props.placeholder}
        style={s.input}
      />
      {open && q.trim() !== "" && (
        <div style={s.taDropdown}>
          {loading && <div style={s.taEmpty}>Ricerca...</div>}
          {!loading && results.length === 0 && <div style={s.taEmpty}>Nessun risultato.</div>}
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={() => { props.onPick(item); setQ(""); setOpen(false); }}
              style={s.taOption}
            >
              {props.renderItem(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CompetizioniTab(props: {
  competitions: Competition[];
  onStatus: (id: string, status: "active" | "wip" | "archived") => void;
  onCreated: () => Promise<void>;
  setErr: (x: string | null) => void;
  setMsg: (x: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [type, setType] = useState<"campionato" | "champions" | "coppa">("coppa");
  const [themeKey, setThemeKey] = useState("coppe");
  const [matchdays, setMatchdays] = useState(7);
  const [topN, setTopN] = useState(6);
  const [scope, setScope] = useState("club");
  const [description, setDescription] = useState("");
  const [rulesSummary, setRulesSummary] = useState("");

  function autoSlug(value: string) {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function handleTypeChange(value: "campionato" | "champions" | "coppa") {
    setType(value);
    if (value === "campionato") { setThemeKey("campionato"); setScope("club"); setMatchdays(38); }
    if (value === "champions") { setThemeKey("champions"); setScope("club"); setMatchdays(8); }
    if (value === "coppa") { setThemeKey("coppe"); setMatchdays(7); }
  }

  async function createCompetition() {
    props.setErr(null);
    props.setMsg(null);
    if (!name.trim()) { props.setErr("Inserisci il nome della competizione."); return; }
    setCreating(true);
    const { error } = await supabase.rpc("superadmin_create_global_competition", {
      p_name: name.trim(),
      p_slug: slug.trim() || autoSlug(name),
      p_type: type,
      p_theme_key: themeKey,
      p_total_matchdays: matchdays,
      p_top_n: topN,
      p_scope: scope,
      p_description: description.trim() || null,
      p_rules_summary: rulesSummary.trim() || null,
    });
    setCreating(false);
    if (error) { props.setErr(error.message); return; }
    props.setMsg("Competizione globale creata ✅");
    setName(""); setSlug(""); setType("coppa"); setThemeKey("coppe");
    setMatchdays(7); setTopN(6); setScope("club"); setDescription(""); setRulesSummary("");
    setOpen(false);
    await props.onCreated();
  }

  return (
    <section style={s.card}>
      <div style={s.actionsBetween}>
        <div>
          <h2 style={s.cardTitle}>Competizioni globali attive</h2>
          <p style={s.muted}>Qui vedi solo le competizioni operative. Quelle chiuse restano in Supabase.</p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} style={s.smallBtn}>
          {open ? "Chiudi" : "Nuova"}
        </button>
      </div>

      {open && (
        <div style={s.createBox}>
          <h3 style={s.smallTitle}>Nuova competizione globale</h3>

          <label style={s.label}>Nome</label>
          <input
            value={name}
            onChange={(e) => { setName(e.target.value); if (!slug) setSlug(autoSlug(e.target.value)); }}
            placeholder="Es. Mondiale per Club 2025"
            style={s.input}
          />

          <label style={s.label}>Slug</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="mondiale-per-club-2025" style={s.input} />

          <label style={s.label}>Tipo</label>
          <select value={type} onChange={(e) => handleTypeChange(e.target.value as "campionato" | "champions" | "coppa")} style={s.input}>
            <option value="campionato">Campionato</option>
            <option value="champions">Champions</option>
            <option value="coppa">Coppa</option>
          </select>

          <label style={s.label}>Tema grafico</label>
          <select value={themeKey} onChange={(e) => setThemeKey(e.target.value)} style={s.input}>
            <option value="campionato">Campionato</option>
            <option value="champions">Champions</option>
            <option value="coppe">Coppe</option>
          </select>

          <div style={s.statsGrid}>
            <NumberField label="Giornate" value={matchdays} onChange={setMatchdays} />
            <NumberField label="Top squadre" value={topN} onChange={setTopN} />
          </div>

          <label style={s.label}>Scope</label>
          <select value={scope} onChange={(e) => setScope(e.target.value)} style={s.input}>
            <option value="club">Club</option>
            <option value="nazionali">Nazionali</option>
          </select>

          <label style={s.label}>Descrizione</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descrizione della competizione" style={s.textarea} />

          <label style={s.label}>Regole sintetiche</label>
          <textarea value={rulesSummary} onChange={(e) => setRulesSummary(e.target.value)} placeholder="Es. Gol +3, assist +1..." style={s.textarea} />

          <button type="button" onClick={createCompetition} disabled={creating} style={{ ...s.saveBtn, opacity: creating ? 0.65 : 1 }}>
            {creating ? "Creazione..." : "Crea competizione"}
          </button>
        </div>
      )}

      <div style={s.list}>
        {props.competitions.length === 0 ? (
          <div style={s.muted}>Nessuna competizione attiva. Crea una nuova competizione globale.</div>
        ) : (
          props.competitions.map((c) => (
            <div key={c.id} style={s.compRow}>
              <div>
                <CompetitionBadge name={c.name} type={c.type} />
                <div style={s.compName}>{c.name}</div>
                <div style={s.compMeta}>
                  {c.visibility_status} · {c.default_total_matchdays} giornate · Top {c.default_top_n} · {c.players_count} giocatori · {c.teams_count} squadre
                </div>
              </div>
              <div style={s.actions3}>
                <button style={s.smallBtn} onClick={() => props.onStatus(c.id, "active")}>Attiva</button>
                <button style={s.smallBtn} onClick={() => props.onStatus(c.id, "wip")}>WIP</button>
                <button style={s.dangerBtn} onClick={() => props.onStatus(c.id, "archived")}>Chiudi</button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function StatisticheTab(props: {
  competition: Competition;
  matchday: number;
  setErr: (x: string | null) => void;
  setMsg: (x: string | null) => void;
}) {
  const [selected, setSelected] = useState<Player | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [saving, setSaving] = useState(false);
  const [coachTeam, setCoachTeam] = useState<Team | null>(null);
  const [coachName, setCoachName] = useState("");
  const [coachResult, setCoachResult] = useState<"win" | "draw" | "loss">("draw");
  const [coachNpxg, setCoachNpxg] = useState(0);
  const [coachPossession, setCoachPossession] = useState(0);
  const [savingCoach, setSavingCoach] = useState(false);

  async function pickPlayer(p: Player) {
    setSelected(p);
    props.setErr(null);
    props.setMsg(null);
    if (!props.competition.active_season_id) { props.setErr("Questa competizione non ha una season attiva."); return; }

    const { data, error } = await supabase.rpc("superadmin_get_player_stats", {
      p_competition_id: props.competition.id,
      p_season_id: props.competition.active_season_id,
      p_matchday_number: props.matchday,
      p_real_player_id: p.id,
    });
    if (error) { props.setErr(error.message); return; }

    setStats({
      goals: Number(data?.goals ?? 0),
      assists: Number(data?.assists ?? 0),
      yellow: Number(data?.yellow ?? 0),
      red: Number(data?.red ?? 0),
      goals_conceded: Number(data?.goals_conceded ?? 0),
      pen_saved: Number(data?.pen_saved ?? 0),
      pen_missed: Number(data?.pen_missed ?? 0),
      clean_sheet: Boolean(data?.clean_sheet ?? false),
      xg: Number(data?.xg ?? 0),
      xa: Number(data?.xa ?? 0),
      passes_completed: Number(data?.passes_completed ?? 0),
      pass_accuracy: Number(data?.pass_accuracy ?? 0),
      tackles: Number(data?.tackles ?? 0),
      interceptions: Number(data?.interceptions ?? 0),
      npxg: Number(data?.npxg ?? 0),
      saves: Number(data?.saves ?? 0),
      save_pct: Number(data?.save_pct ?? 0),
    });
  }

  function setStat<K extends keyof Stats>(key: K, value: Stats[K]) {
    setStats((prev) => ({ ...prev, [key]: value }));
  }

  async function saveStats() {
    props.setErr(null);
    props.setMsg(null);
    if (!selected) { props.setErr("Seleziona un giocatore."); return; }
    if (!props.competition.active_season_id) { props.setErr("Competizione senza season attiva."); return; }

    setSaving(true);
    const { data, error } = await supabase.rpc("superadmin_upsert_player_stats", {
      p_competition_id: props.competition.id,
      p_season_id: props.competition.active_season_id,
      p_matchday_number: props.matchday,
      p_real_player_id: selected.id,
      p_goals: stats.goals,
      p_assists: stats.assists,
      p_yellow: stats.yellow,
      p_red: stats.red,
      p_goals_conceded: stats.goals_conceded,
      p_pen_saved: stats.pen_saved,
      p_pen_missed: stats.pen_missed,
      p_clean_sheet: stats.clean_sheet,
      p_xg: stats.xg,
      p_xa: stats.xa,
      p_passes_completed: stats.passes_completed,
      p_pass_accuracy: stats.pass_accuracy,
      p_tackles: stats.tackles,
      p_interceptions: stats.interceptions,
      p_npxg: stats.npxg,
      p_saves: stats.saves,
      p_save_pct: stats.save_pct,
    });
    setSaving(false);
    if (error) { props.setErr(error.message); return; }
    props.setMsg(`Statistiche salvate ✅ Totale: ${data?.total_points_base ?? 0}`);
  }

  async function saveCoach() {
    props.setErr(null);
    props.setMsg(null);
    if (!props.competition.active_season_id) { props.setErr("Competizione senza season attiva."); return; }
    if (!coachTeam) { props.setErr("Seleziona la squadra dell'allenatore."); return; }
    if (!coachName.trim()) { props.setErr("Scrivi il nome dell'allenatore."); return; }

    setSavingCoach(true);
    const { error: coachError } = await supabase.rpc("superadmin_upsert_coach", {
      p_competition_id: props.competition.id,
      p_real_team_id: coachTeam.id,
      p_name: coachName.trim(),
      p_active: true,
    });

    if (coachError) {
      setSavingCoach(false);
      props.setErr(coachError.message);
      return;
    }

    const { error: statsError } = await supabase.rpc("superadmin_upsert_coach_stats", {
      p_competition_id: props.competition.id,
      p_season_id: props.competition.active_season_id,
      p_matchday_number: props.matchday,
      p_real_team_id: coachTeam.id,
      p_result: coachResult,
      p_npxg: coachNpxg,
      p_possession: coachPossession,
    });

    setSavingCoach(false);
    if (statsError) { props.setErr(statsError.message); return; }
    props.setMsg(`Allenatore salvato: ${coachName.trim()} (${coachTeam.name}) ✅`);
  }

  return (
    <div style={s.stack}>
      <section style={s.card}>
        <h2 style={s.cardTitle}>Statistiche giocatore</h2>
        <p style={s.muted}>Scrivi il nome del giocatore o della squadra e selezionalo dall'elenco che compare.</p>

        <Typeahead<Player>
          placeholder="Cerca giocatore o squadra"
          search={async (q) => {
            const { data, error } = await supabase.rpc("superadmin_search_players_for_vote", {
              p_competition_id: props.competition.id,
              p_query: q,
            });
            if (error) { props.setErr(error.message); return []; }
            return (data ?? []) as Player[];
          }}
          renderItem={(p) => (
            <span style={s.taItem}>
              <b>{p.name}</b>
              <small>{p.role}{p.team_name ? ` · ${p.team_name}` : ""}</small>
            </span>
          )}
          onPick={pickPlayer}
        />

        {selected && (
          <div style={s.statsBox}>
          <h3 style={s.selectedTitle}>
            {selected.name}
            <small>{selected.role} · {selected.team_name || "—"}</small>
          </h3>

          <div style={s.statsGrid}>
            <NumberField label="Gol" value={stats.goals} onChange={(v) => setStat("goals", v)} />
            <NumberField label="Assist" value={stats.assists} onChange={(v) => setStat("assists", v)} />
            <NumberField label="Giallo" value={stats.yellow} onChange={(v) => setStat("yellow", v)} />
            <NumberField label="Rosso" value={stats.red} onChange={(v) => setStat("red", v)} />
            <NumberField label="Rigore sbagliato" value={stats.pen_missed} onChange={(v) => setStat("pen_missed", v)} />
          </div>

          <h4 style={s.microTitle}>Statistiche non standard</h4>
          <div style={s.statsGrid}>
            <NumberField label="Passaggi riusciti" value={stats.passes_completed} onChange={(v) => setStat("passes_completed", v)} />
            <NumberField label="% passaggi" value={stats.pass_accuracy} step={0.1} onChange={(v) => setStat("pass_accuracy", v)} />
            <NumberField label="Tackle" value={stats.tackles} onChange={(v) => setStat("tackles", v)} />
            <NumberField label="Intercetti" value={stats.interceptions} onChange={(v) => setStat("interceptions", v)} />
            <NumberField label="npxG" value={stats.npxg} step={0.01} onChange={(v) => setStat("npxg", v)} />
            <NumberField label="xA" value={stats.xa} step={0.01} onChange={(v) => setStat("xa", v)} />
            <NumberField label="xG" value={stats.xg} step={0.01} onChange={(v) => setStat("xg", v)} />
          </div>

          {selected.role === "P" && (
            <>
              <h4 style={s.microTitle}>Portiere</h4>
              <div style={s.statsGrid}>
                <NumberField label="Gol subito" value={stats.goals_conceded} onChange={(v) => setStat("goals_conceded", v)} />
                <NumberField label="Rigore parato" value={stats.pen_saved} onChange={(v) => setStat("pen_saved", v)} />
                <NumberField label="Parate" value={stats.saves} onChange={(v) => setStat("saves", v)} />
                <NumberField label="% parate" value={stats.save_pct} step={0.1} onChange={(v) => setStat("save_pct", v)} />
              </div>
            </>
          )}

          {(selected.role === "P" || selected.role === "D") && (
            <label style={s.checkboxRow}>
              <input type="checkbox" checked={stats.clean_sheet} onChange={(e) => setStat("clean_sheet", e.target.checked)} />
              Clean sheet
            </label>
          )}

          <button type="button" onClick={saveStats} disabled={saving} style={s.saveBtn}>
            {saving ? "Salvataggio..." : "Salva statistiche"}
          </button>
          </div>
        )}
      </section>

      <section style={s.card}>
        <h2 style={s.cardTitle}>Allenatore</h2>
        <p style={s.muted}>
          Associa il nome dell'allenatore alla squadra e salva le statistiche
          semplici della giornata.
        </p>

        <Typeahead<Team>
          placeholder="Scrivi e scegli la squadra"
          search={async (q) => {
            const { data, error } = await supabase.rpc("superadmin_search_teams", {
              p_competition_id: props.competition.id,
              p_query: q,
            });
            if (error) { props.setErr(error.message); return []; }
            return (data ?? []) as Team[];
          }}
          renderItem={(t) => (
            <span style={s.taItem}><b>{t.name}</b>{t.country ? <small>{t.country}</small> : null}</span>
          )}
          onPick={setCoachTeam}
        />

        {coachTeam && <div style={s.picked}>Squadra: <b>{coachTeam.name}</b></div>}

        <label style={s.label}>Nome allenatore</label>
        <input
          value={coachName}
          onChange={(e) => setCoachName(e.target.value)}
          placeholder="Es. Simone Inzaghi"
          style={s.input}
        />

        <label style={s.label}>Risultato</label>
        <select
          value={coachResult}
          onChange={(e) => setCoachResult(e.target.value as "win" | "draw" | "loss")}
          style={s.input}
        >
          <option value="win">Vittoria</option>
          <option value="draw">Pareggio</option>
          <option value="loss">Sconfitta</option>
        </select>

        <div style={s.statsGrid}>
          <NumberField label="npxG squadra" value={coachNpxg} step={0.01} onChange={setCoachNpxg} />
          <NumberField label="Possesso %" value={coachPossession} step={0.1} max={100} onChange={setCoachPossession} />
        </div>

        <button type="button" onClick={saveCoach} disabled={savingCoach} style={s.saveBtn}>
          {savingCoach ? "Salvataggio..." : "Salva allenatore"}
        </button>
      </section>
    </div>
  );
}

function TopSquadreTab(props: {
  competition: Competition;
  matchday: number;
  setErr: (x: string | null) => void;
  setMsg: (x: string | null) => void;
}) {
  const [top, setTop] = useState<TopTeam[]>([]);
  const [rank, setRank] = useState(1);

  useEffect(() => {
    loadTop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.competition.id, props.matchday]);

  async function loadTop() {
    if (!props.competition.active_season_id) return;
    const { data, error } = await supabase.rpc("superadmin_get_top_teams", {
      p_competition_id: props.competition.id,
      p_season_id: props.competition.active_season_id,
      p_matchday_number: props.matchday,
    });
    if (!error) setTop((data ?? []) as TopTeam[]);
  }

  async function addTeam(team: Team) {
    props.setErr(null);
    props.setMsg(null);
    if (!props.competition.active_season_id) { props.setErr("Competizione senza season attiva."); return; }
    const { error } = await supabase.rpc("superadmin_upsert_top_team", {
      p_competition_id: props.competition.id,
      p_season_id: props.competition.active_season_id,
      p_matchday_number: props.matchday,
      p_real_team_id: team.id,
      p_rank: rank,
    });
    if (error) { props.setErr(error.message); return; }
    props.setMsg(`Top #${rank} salvata: ${team.name} ✅`);
    setRank(rank + 1);
    await loadTop();
  }

  async function clearTop() {
    if (!props.competition.active_season_id) return;
    const { error } = await supabase.rpc("superadmin_clear_top_n", {
      p_competition_id: props.competition.id,
      p_season_id: props.competition.active_season_id,
      p_matchday_number: props.matchday,
    });
    if (error) { props.setErr(error.message); return; }
    setRank(1);
    props.setMsg("Top squadre svuotata ✅");
    await loadTop();
  }

  return (
    <section style={s.card}>
      <h2 style={s.cardTitle}>Top squadre</h2>

      <label style={s.label}>Posizione Top</label>
      <input type="number" min={1} value={rank} onChange={(e) => setRank(Number(e.target.value) || 1)} style={s.input} />

      <Typeahead<Team>
        placeholder="Scrivi e scegli la squadra"
        search={async (q) => {
          const { data, error } = await supabase.rpc("superadmin_search_teams", {
            p_competition_id: props.competition.id,
            p_query: q,
          });
          if (error) { props.setErr(error.message); return []; }
          return (data ?? []) as Team[];
        }}
        renderItem={(t) => (
          <span style={s.taItem}><b>{t.name}</b>{t.country ? <small>{t.country}</small> : null}</span>
        )}
        onPick={addTeam}
      />

      <div style={s.actionsBetween}>
        <h3 style={s.smallTitle}>Top inserita</h3>
        <button type="button" onClick={clearTop} style={s.dangerBtn}>Svuota</button>
      </div>

      <div style={s.list}>
        {top.length === 0 ? (
          <div style={s.muted}>Nessuna squadra inserita per questa giornata.</div>
        ) : top.map((t) => (
          <div key={t.id} style={s.topRow}>
            <b>#{t.rank}</b>
            <span>{t.team_name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PartiteTab(props: {
  competition: Competition;
  matchday: number;
  setErr: (x: string | null) => void;
  setMsg: (x: string | null) => void;
}) {
  const [home, setHome] = useState<Team | null>(null);
  const [away, setAway] = useState<Team | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);

  useEffect(() => {
    loadFixtures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.competition.id, props.matchday]);

  async function loadFixtures() {
    if (!props.competition.active_season_id) return;
    const { data, error } = await supabase.rpc("superadmin_get_fixtures", {
      p_competition_id: props.competition.id,
      p_season_id: props.competition.active_season_id,
      p_matchday_number: props.matchday,
    });
    if (!error) setFixtures((data ?? []) as Fixture[]);
  }

  const searchTeams = async (q: string) => {
    const { data, error } = await supabase.rpc("superadmin_search_teams", {
      p_competition_id: props.competition.id,
      p_query: q,
    });
    if (error) { props.setErr(error.message); return []; }
    return (data ?? []) as Team[];
  };

  async function addFixture() {
    props.setErr(null);
    props.setMsg(null);
    if (!props.competition.active_season_id) { props.setErr("Competizione senza season attiva."); return; }
    if (!home || !away) { props.setErr("Seleziona squadra casa e squadra trasferta."); return; }
    const { error } = await supabase.rpc("superadmin_upsert_fixture", {
      p_competition_id: props.competition.id,
      p_season_id: props.competition.active_season_id,
      p_matchday_number: props.matchday,
      p_home_team_id: home.id,
      p_away_team_id: away.id,
      p_starts_at: null,
      p_status: "scheduled",
    });
    if (error) { props.setErr(error.message); return; }
    props.setMsg("Partita salvata ✅");
    setHome(null);
    setAway(null);
    await loadFixtures();
  }

  async function deleteFixture(id: string) {
    const { error } = await supabase.rpc("superadmin_delete_fixture", { p_fixture_id: id });
    if (error) { props.setErr(error.message); return; }
    props.setMsg("Partita eliminata ✅");
    await loadFixtures();
  }

  return (
    <section style={s.card}>
      <h2 style={s.cardTitle}>Partite</h2>

      <label style={s.label}>Squadra casa</label>
      <Typeahead<Team>
        placeholder="Scrivi e scegli la squadra di casa"
        search={searchTeams}
        renderItem={(t) => (<span style={s.taItem}><b>{t.name}</b>{t.country ? <small>{t.country}</small> : null}</span>)}
        onPick={setHome}
      />
      {home && <div style={s.picked}>Casa: <b>{home.name}</b></div>}

      <label style={s.label}>Squadra trasferta</label>
      <Typeahead<Team>
        placeholder="Scrivi e scegli la squadra in trasferta"
        search={searchTeams}
        renderItem={(t) => (<span style={s.taItem}><b>{t.name}</b>{t.country ? <small>{t.country}</small> : null}</span>)}
        onPick={setAway}
      />
      {away && <div style={s.picked}>Trasferta: <b>{away.name}</b></div>}

      <div style={s.fixturePreview}>
        <b>{home?.name ?? "Casa"}</b>
        <span>vs</span>
        <b>{away?.name ?? "Trasferta"}</b>
      </div>

      <button type="button" onClick={addFixture} style={s.saveBtn}>Aggiungi partita</button>

      <h3 style={s.smallTitle}>Partite inserite</h3>
      <div style={s.list}>
        {fixtures.length === 0 ? (
          <div style={s.muted}>Nessuna partita inserita.</div>
        ) : fixtures.map((f) => (
          <div key={f.id} style={s.fixtureRow}>
            <span><b>{f.home_team_name}</b> - <b>{f.away_team_name}</b></span>
            <button type="button" onClick={() => deleteFixture(f.id)} style={s.removeBtn}>Elimina</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function NumberField(props: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number }) {
  const min = props.min ?? 0;
  const step = props.step ?? 1;
  const clamp = (v: number) => {
    let x = isNaN(v) ? min : v;
    x = Math.max(min, x);
    if (props.max != null) x = Math.min(props.max, x);
    return Number(x.toFixed(step < 1 ? 2 : 0));
  };
  return (
    <label style={s.numberField}>
      <span>{props.label}</span>
      <div style={s.stepper}>
        <button type="button" onClick={() => props.onChange(clamp(props.value - step))} style={s.stepBtn} aria-label="meno">−</button>
        <input
          inputMode="decimal"
          value={String(props.value)}
          onChange={(e) => props.onChange(clamp(Number(e.target.value.replace(",", "."))))}
          style={s.stepInput}
        />
        <button type="button" onClick={() => props.onChange(clamp(props.value + step))} style={s.stepBtn} aria-label="più">+</button>
      </div>
    </label>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 520, margin: "0 auto", padding: "16px 14px 100px", display: "grid", gap: 14 },
  hero: { background: "linear-gradient(160deg,#14532d,#16a34a)", color: "white", borderRadius: 22, padding: 18, boxShadow: "0 8px 24px rgba(22,163,74,0.20)" },
  title: { margin: 0, fontSize: 28, fontWeight: 1000 },
  subtitle: { margin: "8px 0 0", color: "rgba(255,255,255,0.78)", fontWeight: 700, lineHeight: 1.4 },
  tabs: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  tab: { padding: 11, borderRadius: 12, border: "1px solid #e5e7eb", fontWeight: 1000, fontFamily: "inherit", cursor: "pointer" },
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: 16, display: "grid", gap: 12, boxShadow: "0 4px 16px rgba(15,23,42,0.06)" },
  stack: { display: "grid", gap: 12 },
  cardTitle: { margin: 0, fontSize: 21, fontWeight: 1000, color: "#111827" },
  muted: { margin: 0, color: "#6b7280", fontSize: 13, fontWeight: 700, lineHeight: 1.45 },
  list: { display: "grid", gap: 8 },
  compRow: { border: "1px solid #e5e7eb", borderRadius: 16, padding: 13, display: "grid", gap: 10 },
  compName: { marginTop: 8, color: "#111827", fontWeight: 1000, fontSize: 16 },
  compMeta: { marginTop: 3, color: "#6b7280", fontSize: 12, fontWeight: 800 },
  actions3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 },
  smallBtn: { border: "1px solid #e5e7eb", borderRadius: 10, background: "white", padding: 9, fontWeight: 900, fontFamily: "inherit", cursor: "pointer" },
  dangerBtn: { border: "1px solid #f4c99d", borderRadius: 10, background: "#fff3e4", color: "#e07b1a", padding: 9, fontWeight: 900, fontFamily: "inherit", cursor: "pointer" },
  label: { fontSize: 12, color: "#374151", fontWeight: 1000, textTransform: "uppercase" },
  input: { width: "100%", padding: 12, border: "1px solid #e5e7eb", borderRadius: 12, fontFamily: "inherit", fontWeight: 800, background: "white" },
  taDropdown: { position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 30, background: "white", border: "1px solid #e5e7eb", borderRadius: 12, boxShadow: "0 12px 30px rgba(15,23,42,0.16)", maxHeight: 260, overflowY: "auto", display: "grid" },
  taOption: { textAlign: "left", border: "none", borderBottom: "1px solid #f3f4f6", background: "white", padding: "10px 12px", cursor: "pointer", fontFamily: "inherit" },
  taItem: { display: "grid", gap: 1 },
  taEmpty: { padding: 12, color: "#6b7280", fontWeight: 700, fontSize: 13 },
  picked: { background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", borderRadius: 10, padding: "8px 12px", fontWeight: 800, fontSize: 13 },
  searchRow: { display: "grid", gridTemplateColumns: "1fr 86px", gap: 8 },
  searchBtn: { border: "none", borderRadius: 12, background: "#16a34a", color: "white", fontWeight: 1000, fontFamily: "inherit", cursor: "pointer" },
  playerRow: { display: "grid", gap: 3, textAlign: "left", border: "1px solid #e5e7eb", borderRadius: 13, background: "white", padding: 12, fontFamily: "inherit", cursor: "pointer" },
  statsBox: { display: "grid", gap: 12, borderTop: "1px solid #e5e7eb", paddingTop: 14 },
  selectedTitle: { margin: 0, display: "grid", gap: 3, color: "#111827", fontWeight: 1000 },
  microTitle: { margin: "4px 0 -4px", fontSize: 11, fontWeight: 1000, color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em" },
  statsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 },
  numberField: { display: "grid", gap: 5, color: "#374151", fontSize: 12, fontWeight: 900 },
  stepper: { display: "flex", alignItems: "stretch", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "white" },
  stepBtn: { width: 44, border: "none", background: "#f1f5f9", color: "#15803d", fontSize: 22, fontWeight: 1000, lineHeight: 1, cursor: "pointer", fontFamily: "inherit" },
  stepInput: { flex: 1, minWidth: 0, width: "100%", border: "none", textAlign: "center", fontWeight: 1000, fontSize: 17, color: "#0f172a", background: "white", outline: "none", fontFamily: "inherit" },
  checkboxRow: { display: "flex", alignItems: "center", gap: 9, color: "#111827", fontWeight: 900 },
  saveBtn: { border: "none", borderRadius: 13, background: "#16a34a", color: "white", padding: 14, fontWeight: 1000, fontFamily: "inherit", cursor: "pointer" },
  topRow: { display: "grid", gridTemplateColumns: "42px 1fr", gap: 10, alignItems: "center", padding: 12, borderRadius: 13, background: "#f9fafb", fontWeight: 900 },
  actionsBetween: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
  smallTitle: { margin: 0, fontSize: 16, fontWeight: 1000, color: "#111827" },
  fixturePreview: { display: "grid", gridTemplateColumns: "1fr 34px 1fr", gap: 8, alignItems: "center", textAlign: "center", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 14, padding: 12 },
  fixtureRow: { display: "grid", gridTemplateColumns: "1fr 78px", gap: 8, alignItems: "center", padding: 12, border: "1px solid #e5e7eb", borderRadius: 13 },
  removeBtn: { border: "1px solid #f4c99d", background: "#fff3e4", color: "#e07b1a", borderRadius: 10, padding: 8, fontWeight: 900, fontFamily: "inherit", cursor: "pointer" },
  createBox: { display: "grid", gap: 10, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 16, padding: 13 },
  textarea: { width: "100%", minHeight: 82, padding: 12, border: "1px solid #e5e7eb", borderRadius: 12, fontFamily: "inherit", fontWeight: 700, background: "white", resize: "vertical" },
  ok: { background: "#f0fdf4", border: "1px solid #86efac", color: "#15803d", borderRadius: 12, padding: 12, fontWeight: 900 },
  err: { background: "#fff1f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 12, padding: 12, fontWeight: 900 },
};
