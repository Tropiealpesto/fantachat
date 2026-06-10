"use client";

import { useEffect, useMemo, useState } from "react";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import LoadingScreen from "../components/LoadingScreen";
import CompetitionBadge from "../components/CompetitionBadge";
import { useRequireApp } from "../hooks/useRequireApp";
import { supabase } from "../../lib/supabaseClient";

type Player = { id: string; name: string; role: string; team: string };
type Matchday = { id: string; number: number; status: string };
type LineupData = { id?: string; submitted_at?: string; players?: { role: string; real_player_id: string }[] };
type FormData = {
  competition_id: string | null;
  is_participant: boolean;
  matchday: Matchday | null;
  players_per_role: Record<string, number>;
  players: Player[];
  lineup: LineupData | null;
};
type TopRow = { rank: number; name: string };
type FixtureRow = { home: string; away: string; status: string };

const ROLE_LABELS: Record<string, string> = { P: "Portiere", D: "Difensore", C: "Centrocampista", A: "Attaccante" };
const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  P: { bg: "#fef9c3", color: "#a16207" },
  D: { bg: "#dcfce7", color: "#15803d" },
  C: { bg: "#dbeafe", color: "#1d4ed8" },
  A: { bg: "#fee2e2", color: "#dc2626" },
};
const EMPTY_FORM: FormData = {
  competition_id: null,
  is_participant: false,
  matchday: null,
  players_per_role: { P: 1, D: 1, C: 1, A: 1 },
  players: [],
  lineup: null,
};

function roleOrder(role: string) {
  return ({ P: 1, D: 2, C: 3, A: 4 } as Record<string, number>)[role] ?? 10;
}
const norm = (x?: string) => (x ?? "").trim().toLowerCase();
function label(p: Player) { return p.role === "P" ? (p.team || p.name) : p.name; }
function sub(p: Player) { return p.role === "P" ? "Portiere" : p.team; }

export default function RosaPage() {
  const app = useRequireApp(false);

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [top, setTop] = useState<TopRow[]>([]);
  const [fixtures, setFixtures] = useState<FixtureRow[]>([]);

  const roles = useMemo(
    () =>
      Object.entries(form.players_per_role ?? {})
        .filter(([, n]) => Number(n) > 0)
        .sort(([a], [b]) => roleOrder(a) - roleOrder(b)),
    [form.players_per_role]
  );

  const selectedIds = useMemo(() => Object.values(selected).flat().filter(Boolean), [selected]);
  const totalPlayers = useMemo(() => roles.reduce((s, [, n]) => s + Number(n || 0), 0), [roles]);
  const byId = useMemo(() => new Map(form.players.map((p) => [p.id, p])), [form.players]);
  const topNames = useMemo(() => new Set(top.map((t) => norm(t.name))), [top]);

  useEffect(() => {
    async function load() {
      if (!app.ready || !app.activeLeagueCompetitionId) return;
      setLoading(true);
      setErr(null);
      setMsg(null);
      try {
        const { data, error } = await supabase.rpc("get_lineup_form_data", {
          p_league_competition_id: app.activeLeagueCompetitionId,
        });
        if (error) throw error;
        const nextForm = normalizeFormData(data);
        setForm(nextForm);
        setSelected(buildInitialSelected(nextForm.players_per_role, nextForm.lineup));
        setSaved(Boolean(nextForm.lineup?.id));
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [app.ready, app.activeLeagueCompetitionId]);

  // Partite + Top squadre della giornata (usa l'id competizione dato dalla funzione)
  useEffect(() => {
    const md = form.matchday?.number;
    const compId = form.competition_id;
    if (!compId || !md) {
      setTop([]);
      setFixtures([]);
      return;
    }
    let off = false;
    (async () => {
      const { data: teams } = await supabase
        .from("real_teams")
        .select("id,name")
        .eq("competition_id", compId);
      const map = new Map(((teams ?? []) as any[]).map((t) => [t.id, t.name]));

      const { data: tt } = await supabase
        .from("top_teams")
        .select("rank,real_team_id")
        .eq("competition_id", compId)
        .eq("matchday_number", md)
        .order("rank", { ascending: true });

      const { data: fx } = await supabase
        .from("fixtures")
        .select("home_team_id,away_team_id,status")
        .eq("competition_id", compId)
        .eq("matchday_number", md);

      if (off) return;
      setTop(((tt ?? []) as any[]).map((r) => ({ rank: r.rank, name: map.get(r.real_team_id) ?? "—" })));
      setFixtures(((fx ?? []) as any[]).map((r) => ({
        home: map.get(r.home_team_id) ?? "—",
        away: map.get(r.away_team_id) ?? "—",
        status: r.status,
      })));
    })();
    return () => { off = true; };
  }, [form.competition_id, form.matchday?.number]);

  function availableFor(role: string, currentId?: string) {
    const others = selectedIds.filter((id) => id && id !== currentId);
    const otherPlayers = others.map((id) => byId.get(id)).filter(Boolean) as Player[];
    const usedTeams = new Set(otherPlayers.map((p) => norm(p.team)));
    const topUsed = otherPlayers.some((p) => topNames.has(norm(p.team)));

    return form.players
      .filter((p) => p.role === role)
      .filter((p) => {
        if (p.id === currentId) return true;
        if (selectedIds.includes(p.id)) return false;
        const key = norm(p.team);
        if (usedTeams.has(key)) return false;
        if (topUsed && topNames.has(key)) return false;
        return true;
      })
      .sort((a, b) => label(a).localeCompare(label(b)));
  }

  function selectPlayer(role: string, index: number, playerId: string) {
    setSelected((prev) => {
      const next = { ...prev };
      const arr = [...(next[role] ?? [])];
      arr[index] = playerId;
      next[role] = arr;
      return next;
    });
  }

  function validate() {
    for (const [role, count] of roles) {
      const ids = selected[role] ?? [];
      if (ids.filter(Boolean).length !== count) return `Completa il ruolo ${ROLE_LABELS[role] ?? role}.`;
    }
    if (new Set(selectedIds).size !== selectedIds.length) return "Non puoi selezionare due volte lo stesso giocatore.";
    return null;
  }

  async function save() {
    setErr(null);
    setMsg(null);
    if (!app.activeLeagueCompetitionId || !form.matchday?.id) return setErr("Nessuna giornata aperta.");
    if (!form.is_participant) return setErr("Non partecipi a questa competizione.");
    const v = validate();
    if (v) return setErr(v);

    const payload = Object.entries(selected).flatMap(([role, ids]) =>
      ids.filter(Boolean).map((real_player_id) => ({ role, real_player_id }))
    );

    setSaving(true);
    try {
      const { error } = await supabase.rpc("submit_lineup", {
        p_league_competition_id: app.activeLeagueCompetitionId,
        p_matchday_id: form.matchday.id,
        p_players: payload,
      });
      if (error) throw error;
      setSaved(true);
      setMsg("Rosa inviata ✅");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!app.ready || loading) return <LoadingScreen />;

  const locked = saved || !form.is_participant || !form.matchday;
  const accent = app.competitionTheme.primary;

  return (
    <>
      <AppBar league={app.leagueName} team={app.teamName} onMenuOpen={app.openDrawer} />

      <main style={s.container}>
        <div style={{ ...s.header, borderLeft: `4px solid ${accent}` }}>
          <div style={s.headerTop}>
            <CompetitionBadge name={app.competitionName} type={app.competitionType} />
            <span style={s.statusPill}>{form.matchday?.status ?? "chiusa"}</span>
          </div>
          <div style={s.headerRow}>
            <h1 style={s.title}>Rosa</h1>
            <div style={s.gj}>Giornata <b>{form.matchday?.number ?? "—"}</b></div>
          </div>
          <div style={s.rulesMini}>
            {roles.map(([role, count]) => (
              <span key={role} style={s.rulePill}>{count} {role}</span>
            ))}
            <span style={s.ruleTotal}>{totalPlayers} giocatori</span>
          </div>

          {!form.is_participant && <div style={s.warn}>Non partecipi a questa competizione.</div>}
          {form.is_participant && !form.matchday && <div style={s.warn}>Nessuna giornata aperta.</div>}
          {saved && <div style={s.ok}>Rosa già inviata. Per modificarla serve il reset admin.</div>}
        </div>

        <div style={s.card}>
          <h2 style={s.cardTitle}>Scegli i giocatori</h2>

          {roles.map(([role, count]) => (
            <div key={role} style={s.roleBlock}>
              <div style={s.roleTitle}>
                <RoleBadge role={role} />
                <span>{ROLE_LABELS[role] ?? role}</span>
                <small>{count}</small>
              </div>

              {Array.from({ length: Number(count) || 0 }).map((_, index) => (
                <PlayerPicker
                  key={`${role}-${index}`}
                  role={role}
                  index={index}
                  disabled={locked}
                  options={availableFor(role, selected[role]?.[index])}
                  currentId={selected[role]?.[index] ?? ""}
                  onSelect={(id) => selectPlayer(role, index, id)}
                  onClear={() => selectPlayer(role, index, "")}
                />
              ))}
            </div>
          ))}

          {!saved && (
            <button
              type="button"
              onClick={save}
              disabled={saving || !form.is_participant || !form.matchday}
              style={{ ...s.btn, background: form.is_participant && form.matchday ? accent : "#d1d5db" }}
            >
              {saving ? "Invio..." : "Invia rosa"}
            </button>
          )}
          {msg && <div style={s.ok}>{msg}</div>}
          {err && <div style={s.err}>{err}</div>}
        </div>

        <div style={s.duo}>
          <div style={s.card}>
            <h3 style={s.duoTitle}>Partite</h3>
            {fixtures.length === 0 ? (
              <div style={s.duoEmpty}>Nessuna partita.</div>
            ) : (
              <div style={s.duoList}>
                {fixtures.map((f, i) => (
                  <div key={i} style={s.fixtureRow}>
                    <span style={s.fxTeam}>{f.home}</span>
                    <span style={s.fxVs}>vs</span>
                    <span style={s.fxTeam}>{f.away}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={s.card}>
            <h3 style={s.duoTitle}>Top squadre</h3>
            {top.length === 0 ? (
              <div style={s.duoEmpty}>Nessuna Top.</div>
            ) : (
              <div style={s.duoList}>
                {top.map((t, i) => (
                  <div key={i} style={s.topRow}>
                    <b style={{ color: accent }}>#{t.rank}</b>
                    <span style={s.fxTeam}>{t.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <Campo players={form.players} selected={selected} roles={roles} />
      </main>

      <BottomNav />
    </>
  );
}

function PlayerPicker(props: {
  role: string;
  index: number;
  disabled: boolean;
  options: Player[];
  currentId: string;
  onSelect: (id: string) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const current = props.currentId ? props.options.find((p) => p.id === props.currentId) : null;
  const isGK = props.role === "P";

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return props.options.slice(0, 8);
    return props.options
      .filter((p) => (p.name + " " + (p.team ?? "")).toLowerCase().includes(needle))
      .slice(0, 15);
  }, [q, props.options]);

  if (current) {
    return (
      <div style={s.chip}>
        <RoleBadge role={props.role} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.chipName}>{label(current)}</div>
          <div style={s.chipTeam}>{sub(current)}</div>
        </div>
        {!props.disabled && (
          <button type="button" onClick={props.onClear} style={s.chipClear} aria-label="Rimuovi">✕</button>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        disabled={props.disabled}
        placeholder={isGK ? `Cerca la nazionale (portiere)` : `Cerca ${ROLE_LABELS[props.role] ?? props.role} #${props.index + 1}`}
        style={s.search}
      />
      {open && !props.disabled && (
        <div style={s.dropdown}>
          {matches.map((p) => (
            <button key={p.id} type="button" onMouseDown={() => { props.onSelect(p.id); setOpen(false); setQ(""); }} style={s.option}>
              <b>{label(p)}</b>
              {sub(p) ? <small>{sub(p)}</small> : null}
            </button>
          ))}
          {matches.length === 0 && <div style={s.optionEmpty}>Nessun risultato.</div>}
        </div>
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const c = ROLE_COLORS[role] ?? { bg: "#f3f4f6", color: "#6b7280" };
  return <span style={{ ...s.roleBadge, background: c.bg, color: c.color }}>{role}</span>;
}

function Campo(props: { players: Player[]; selected: Record<string, string[]>; roles: [string, number][] }) {
  const byId = new Map(props.players.map((p) => [p.id, p]));

  const rows = props.roles
    .map(([role]) => {
      const ids = props.selected[role] ?? [];
      return { role, players: ids.map((id) => byId.get(id)).filter(Boolean) as Player[], slots: ids.length };
    })
    .filter((r) => r.slots > 0)
    .sort((a, b) => roleOrder(a.role) - roleOrder(b.role));

  const topByIndex = (i: number, total: number) => {
    if (total <= 1) return "50%";
    return `${16 + ((84 - 16) / (total - 1)) * i}%`;
  };

  return (
    <div style={s.field}>
      <div style={s.grass} />
      <svg style={s.lines} viewBox="0 0 300 454" preserveAspectRatio="none">
        <rect x="10" y="10" width="280" height="434" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2" rx="4" />
        <line x1="10" y1="227" x2="290" y2="227" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
        <circle cx="150" cy="227" r="40" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
        <circle cx="150" cy="227" r="2.5" fill="rgba(255,255,255,0.6)" />
        <rect x="95" y="10" width="110" height="56" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <rect x="125" y="10" width="50" height="24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <rect x="95" y="388" width="110" height="56" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <rect x="125" y="420" width="50" height="24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      </svg>

      {rows.map((row, rowIndex) => {
        const count = Math.max(row.slots, 1);
        return (
          <div key={row.role} style={{ ...s.fieldRow, top: topByIndex(rowIndex, rows.length) }}>
            {Array.from({ length: count }).map((_, i) => {
              const p = row.players[i];
              const offset = count === 1 ? 0 : (i - (count - 1) / 2) * Math.min(96, 260 / count);
              const c = ROLE_COLORS[row.role] ?? { bg: "#f3f4f6", color: "#6b7280" };
              const text = p ? (row.role === "P" ? p.team : p.name) : "—";
              return (
                <div key={`${row.role}-${i}`} style={{ ...s.playerDot, transform: `translate(calc(-50% + ${offset}px), -50%)` }}>
                  <span style={{ ...s.jersey, background: c.bg, color: c.color }}>{row.role}</span>
                  <span style={s.playerName}>{text}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function normalizeFormData(value: any): FormData {
  const ppr = value?.players_per_role && typeof value.players_per_role === "object" ? value.players_per_role : { P: 1, D: 1, C: 1, A: 1 };
  return {
    competition_id: value?.competition_id ?? null,
    is_participant: Boolean(value?.is_participant),
    matchday: value?.matchday ?? null,
    players_per_role: ppr,
    players: Array.isArray(value?.players) ? value.players : [],
    lineup: value?.lineup ?? null,
  };
}

function buildInitialSelected(ppr: Record<string, number>, lineup: LineupData | null) {
  const initial: Record<string, string[]> = {};
  Object.entries(ppr ?? {}).forEach(([role, count]) => {
    initial[role] = Array.from({ length: Number(count) || 0 }, () => "");
  });
  if (!lineup?.players?.length) return initial;
  for (const p of lineup.players) {
    if (!initial[p.role]) initial[p.role] = [];
    const idx = initial[p.role].findIndex((x) => !x);
    if (idx >= 0) initial[p.role][idx] = p.real_player_id;
    else initial[p.role].push(p.real_player_id);
  }
  return initial;
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 520, margin: "0 auto", padding: "14px 14px 100px", display: "grid", gap: 12 },
  header: { background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 14, boxShadow: "0 4px 16px rgba(15,23,42,0.06)" },
  headerTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  statusPill: { borderRadius: 999, padding: "3px 10px", background: "#f3f4f6", fontSize: 11, fontWeight: 900, color: "#6b7280" },
  headerRow: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 8 },
  title: { margin: 0, fontSize: 20, fontWeight: 1000, color: "#111827" },
  gj: { color: "#6b7280", fontWeight: 800, fontSize: 13 },
  rulesMini: { marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" },
  rulePill: { background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 900, color: "#374151" },
  ruleTotal: { marginLeft: "auto", fontSize: 11, fontWeight: 900, color: "#15803d" },
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: 14, boxShadow: "0 4px 16px rgba(15,23,42,0.05)" },
  cardTitle: { margin: "0 0 12px", fontSize: 18, fontWeight: 1000, color: "#111827" },
  roleBlock: { display: "grid", gap: 8, marginBottom: 14 },
  roleTitle: { display: "flex", alignItems: "center", gap: 8, fontWeight: 1000, color: "#111827" },
  roleBadge: { width: 28, height: 28, borderRadius: 8, display: "inline-grid", placeItems: "center", fontWeight: 1000, fontSize: 12 },
  search: { width: "100%", padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", fontFamily: "inherit", fontWeight: 700, background: "white" },
  dropdown: { position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20, background: "white", border: "1px solid #e5e7eb", borderRadius: 12, boxShadow: "0 12px 30px rgba(15,23,42,0.16)", maxHeight: 260, overflowY: "auto", display: "grid" },
  option: { display: "grid", gap: 1, textAlign: "left", border: "none", borderBottom: "1px solid #f3f4f6", background: "white", padding: "10px 12px", cursor: "pointer", fontFamily: "inherit" },
  optionEmpty: { padding: 12, color: "#6b7280", fontWeight: 700, fontSize: 13 },
  chip: { display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, border: "1px solid #e5e7eb", background: "#f9fafb" },
  chipName: { fontWeight: 900, color: "#111827", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  chipTeam: { fontSize: 12, fontWeight: 700, color: "#6b7280", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  chipClear: { border: "none", background: "#e5e7eb", color: "#374151", width: 26, height: 26, borderRadius: 8, fontWeight: 900, cursor: "pointer", flexShrink: 0 },
  btn: { width: "100%", padding: 14, border: "none", color: "white", borderRadius: 12, fontWeight: 1000, fontFamily: "inherit", cursor: "pointer", marginTop: 4 },
  duo: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" },
  duoTitle: { margin: "0 0 10px", fontSize: 14, fontWeight: 1000, color: "#111827" },
  duoList: { display: "grid", gap: 7 },
  duoEmpty: { color: "#9ca3af", fontWeight: 800, fontSize: 12 },
  fixtureRow: { display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 5, alignItems: "center", fontSize: 12, fontWeight: 800, color: "#374151" },
  fxTeam: { overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  fxVs: { color: "#9ca3af", fontSize: 10, fontWeight: 900 },
  topRow: { display: "grid", gridTemplateColumns: "30px 1fr", gap: 6, alignItems: "center", fontSize: 13, fontWeight: 800, color: "#374151" },
  field: { position: "relative", width: "100%", aspectRatio: "0.66", borderRadius: 20, overflow: "hidden", boxShadow: "0 10px 28px rgba(15,23,42,0.16)" },
  grass: { position: "absolute", inset: 0, background: "repeating-linear-gradient(180deg, #2f9e54 0, #2f9e54 12.5%, #2a9350 12.5%, #2a9350 25%)" },
  lines: { position: "absolute", inset: 0, width: "100%", height: "100%" },
  fieldRow: { position: "absolute", left: 0, width: "100%", height: 1 },
  playerDot: { position: "absolute", left: "50%", top: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 },
  jersey: { width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", fontWeight: 1000, fontSize: 14, boxShadow: "0 3px 8px rgba(0,0,0,0.28)", border: "2px solid rgba(255,255,255,0.85)" },
  playerName: { maxWidth: 92, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", background: "rgba(0,0,0,0.62)", color: "white", borderRadius: 7, padding: "3px 8px", fontSize: 11, fontWeight: 900 },
  ok: { marginTop: 10, background: "#f0fdf4", border: "1px solid #86efac", color: "#15803d", borderRadius: 12, padding: 12, fontWeight: 900 },
  warn: { marginTop: 10, background: "#fff7ed", border: "1px solid #fed7aa", color: "#b85c0a", borderRadius: 12, padding: 12, fontWeight: 900 },
  err: { marginTop: 10, background: "#fff1f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 12, padding: 12, fontWeight: 900 },
};