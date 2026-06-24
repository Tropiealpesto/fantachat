"use client";

import { useEffect, useMemo, useState } from "react";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import LoadingScreen from "../components/LoadingScreen";
import CompetitionBadge from "../components/CompetitionBadge";
import { useRequireApp } from "../hooks/useRequireApp";
import { supabase } from "../../lib/supabaseClient";

type Player = {
  id: string;
  name: string;
  role: string;
  team: string;
};

type Matchday = {
  id: string;
  number: number;
  status: string;
};

type LineupData = {
  id?: string;
  submitted_at?: string;
  players?: {
    role: string;
    real_player_id: string;
  }[];
};

type FormData = {
  competition_id: string | null;
  is_participant: boolean;
  matchday: Matchday | null;
  players_per_role: Record<string, number>;
  players: Player[];
  lineup: LineupData | null;
};

type TopRow = {
  rank: number;
  name: string;
};

type FixtureRow = {
  home: string;
  away: string;
  status: string;
};

type Slot = {
  role: string;
  index: number;
};

const ROLE_LABELS: Record<string, string> = {
  P: "Portiere",
  D: "Difensore",
  C: "Centrocampista",
  A: "Attaccante",
};

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  P: { bg: "#FEF3C7", color: "#B45309" },
  D: { bg: "#DCFCE7", color: "#15803D" },
  C: { bg: "#DBEAFE", color: "#2563EB" },
  A: { bg: "#FEE2E2", color: "#DC2626" },
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

function label(p: Player) {
  return p.role === "P" ? p.team || p.name : p.name;
}

function sub(p: Player) {
  return p.role === "P" ? "Portiere" : p.team;
}

function shortName(name?: string | null) {
  if (!name) return "—";
  const clean = name.trim();
  const parts = clean.split(" ");

  if (parts.length <= 2) return clean;

  return `${parts[0]} ${parts[1]?.[0] ?? ""}.`;
}

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
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null);

  const roles = useMemo(
    () =>
      Object.entries(form.players_per_role ?? {})
        .filter(([, n]) => Number(n) > 0)
        .sort(([a], [b]) => roleOrder(a) - roleOrder(b)),
    [form.players_per_role]
  );

  const selectedIds = useMemo(
    () => Object.values(selected).flat().filter(Boolean),
    [selected]
  );

  const totalPlayers = useMemo(
    () => roles.reduce((sum, [, count]) => sum + Number(count || 0), 0),
    [roles]
  );

  const byId = useMemo(
    () => new Map(form.players.map((p) => [p.id, p])),
    [form.players]
  );

  const topNames = useMemo(
    () => new Set(top.map((t) => norm(t.name))),
    [top]
  );

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

  useEffect(() => {
    const matchdayNumber = form.matchday?.number;
    const competitionId = form.competition_id;

    if (!competitionId || !matchdayNumber) {
      setTop([]);
      setFixtures([]);
      return;
    }

    let off = false;

    async function loadContext() {
      const { data: teams } = await supabase
        .from("real_teams")
        .select("id,name")
        .eq("competition_id", competitionId);

      const map = new Map(((teams ?? []) as any[]).map((t) => [t.id, t.name]));

      const { data: topTeams } = await supabase
        .from("top_teams")
        .select("rank,real_team_id")
        .eq("competition_id", competitionId)
        .eq("matchday_number", matchdayNumber)
        .order("rank", { ascending: true });

      const { data: games } = await supabase
        .from("fixtures")
        .select("home_team_id,away_team_id,status")
        .eq("competition_id", competitionId)
        .eq("matchday_number", matchdayNumber);

      if (off) return;

      setTop(
        ((topTeams ?? []) as any[]).map((r) => ({
          rank: r.rank,
          name: map.get(r.real_team_id) ?? "—",
        }))
      );

      setFixtures(
        ((games ?? []) as any[]).map((r) => ({
          home: map.get(r.home_team_id) ?? "—",
          away: map.get(r.away_team_id) ?? "—",
          status: r.status,
        }))
      );
    }

    loadContext();

    return () => {
      off = true;
    };
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

        const teamKey = norm(p.team);

        if (usedTeams.has(teamKey)) return false;
        if (topUsed && topNames.has(teamKey)) return false;

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
      if (ids.filter(Boolean).length !== count) {
        return `Completa il ruolo ${ROLE_LABELS[role] ?? role}.`;
      }
    }

    if (new Set(selectedIds).size !== selectedIds.length) {
      return "Non puoi selezionare due volte lo stesso giocatore.";
    }

    return null;
  }

  async function save() {
    setErr(null);
    setMsg(null);

    if (!app.activeLeagueCompetitionId || !form.matchday?.id) {
      return setErr("Nessuna giornata aperta.");
    }

    if (!form.is_participant) {
      return setErr("Non partecipi a questa competizione.");
    }

    const validationError = validate();

    if (validationError) {
      return setErr(validationError);
    }

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

      try {
        await supabase.rpc("send_chat_message", {
          p_league_id: app.activeLeagueId,
          p_league_competition_id: app.activeLeagueCompetitionId,
          p_matchday_id: form.matchday.id,
          p_content: "ha caricato la formazione",
          p_kind: "lineup",
          p_meta: null,
        });
      } catch {}

      setSaved(true);
      setMsg("Rosa inviata");
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!app.ready || loading) return <LoadingScreen />;

  const accent = app.competitionTheme.primary;
  const locked = saved || !form.is_participant || !form.matchday;

  const selectedCount = selectedIds.length;
  const completionLabel = `${selectedCount}/${totalPlayers}`;

  const currentSlotId =
    activeSlot && selected[activeSlot.role]
      ? selected[activeSlot.role][activeSlot.index] ?? ""
      : "";

  const sheetOptions = activeSlot
    ? availableFor(activeSlot.role, currentSlotId)
    : [];

  return (
    <>
      <AppBar
        league={app.leagueName}
        team={app.teamName}
        onMenuOpen={app.openDrawer}
      />

      <main style={s.container}>
        <section style={s.headerCard}>
          <div style={s.headerTop}>
            <CompetitionBadge
              name={app.competitionName}
              type={app.competitionType}
            />

            <div style={s.headerStatus}>
              <span style={s.giornata}>Giornata {form.matchday?.number ?? "—"}</span>
              <span style={s.statusPill}>{form.matchday?.status ?? "chiusa"}</span>
            </div>
          </div>

          <div style={s.titleRow}>
            <div>
              <h1 style={s.title}>Rosa</h1>
              <p style={s.subtitle}>
                Tocca uno slot nel campo per scegliere il giocatore.
              </p>
            </div>

            <div style={s.countBox}>
              <span>{completionLabel}</span>
              <small>giocatori</small>
            </div>
          </div>

          <div style={s.rulesMini}>
            {roles.map(([role, count]) => (
              <span key={role} style={s.rulePill}>
                <RoleBadge role={role} small />
                {count}
              </span>
            ))}
          </div>

          {!form.is_participant && (
            <div style={s.warn}>Non partecipi a questa competizione.</div>
          )}

          {form.is_participant && !form.matchday && (
            <div style={s.warn}>Nessuna giornata aperta.</div>
          )}

          {saved && (
            <div style={s.ok}>
              Rosa già inviata. Per modificarla serve il reset admin.
            </div>
          )}

          {msg && <div style={s.ok}>{msg}</div>}
          {err && <div style={s.err}>{err}</div>}
        </section>

        <section style={s.card}>
          <div style={s.sectionHeader}>
            <h2 style={s.sectionTitle}>Il tuo schieramento</h2>

            <button type="button" style={s.infoBtn} aria-label="Informazioni">
              i
            </button>
          </div>

          <CampoInterattivo
            players={form.players}
            selected={selected}
            roles={roles}
            locked={locked}
            onSlotPress={(role, index) => setActiveSlot({ role, index })}
          />

          {!saved && (
            <button
              type="button"
              onClick={save}
              disabled={saving || !form.is_participant || !form.matchday}
              style={{
                ...s.btn,
                background:
                  form.is_participant && form.matchday ? accent : "#d1d5db",
              }}
            >
              {saving ? "Salvataggio..." : "Salva formazione"}
            </button>
          )}
        </section>

        <div style={s.duo}>
          <button type="button" style={s.infoCard}>
            <span style={s.infoIcon}>▣</span>
            <span>
              <b>Partite</b>
              <small>
                {fixtures.length === 0
                  ? "Nessuna partita."
                  : `${fixtures.length} partite`}
              </small>
            </span>
            <span style={s.chev}>›</span>
          </button>

          <button type="button" style={s.infoCard}>
            <span style={s.infoIcon}>♛</span>
            <span>
              <b>Top squadre</b>
              <small>
                {top.length === 0 ? "Nessuna Top." : `${top.length} squadre`}
              </small>
            </span>
            <span style={s.chev}>›</span>
          </button>
        </div>
      </main>

      {activeSlot && (
        <PlayerSheet
          role={activeSlot.role}
          currentId={currentSlotId}
          options={sheetOptions}
          onClose={() => setActiveSlot(null)}
          onClear={() => {
            selectPlayer(activeSlot.role, activeSlot.index, "");
            setActiveSlot(null);
          }}
          onSelect={(id) => {
            selectPlayer(activeSlot.role, activeSlot.index, id);
            setActiveSlot(null);
          }}
        />
      )}

      <BottomNav />
    </>
  );
}

function CampoInterattivo(props: {
  players: Player[];
  selected: Record<string, string[]>;
  roles: [string, number][];
  locked: boolean;
  onSlotPress: (role: string, index: number) => void;
}) {
  const byId = new Map(props.players.map((p) => [p.id, p]));

  const rows = props.roles
    .map(([role, count]) => {
      const ids = props.selected[role] ?? [];
      const slots = Array.from({ length: Number(count) || 0 }, (_, index) => {
        const id = ids[index] ?? "";
        return {
          role,
          index,
          player: id ? byId.get(id) ?? null : null,
        };
      });

      return { role, slots };
    })
    .filter((r) => r.slots.length > 0)
    .sort((a, b) => roleOrder(a.role) - roleOrder(b.role));

  function topByIndex(index: number, total: number) {
    if (total <= 1) return "50%";
    return `${15 + ((85 - 15) / (total - 1)) * index}%`;
  }

  return (
    <div style={s.field}>
      <div style={s.grass} />

      <svg style={s.lines} viewBox="0 0 420 260" preserveAspectRatio="none">
        <rect
          x="12"
          y="12"
          width="396"
          height="236"
          rx="10"
          fill="none"
          stroke="rgba(255,255,255,.56)"
          strokeWidth="3"
        />
        <line
          x1="210"
          y1="12"
          x2="210"
          y2="248"
          stroke="rgba(255,255,255,.42)"
          strokeWidth="2"
        />
        <circle
          cx="210"
          cy="130"
          r="40"
          fill="none"
          stroke="rgba(255,255,255,.42)"
          strokeWidth="2"
        />
        <circle cx="210" cy="130" r="3" fill="rgba(255,255,255,.60)" />
        <rect
          x="12"
          y="82"
          width="54"
          height="96"
          fill="none"
          stroke="rgba(255,255,255,.42)"
          strokeWidth="2"
        />
        <rect
          x="354"
          y="82"
          width="54"
          height="96"
          fill="none"
          stroke="rgba(255,255,255,.42)"
          strokeWidth="2"
        />
      </svg>

      {rows.map((row, rowIndex) => {
        const count = Math.max(row.slots.length, 1);

        return (
          <div
            key={row.role}
            style={{
              ...s.fieldColumn,
              left: topByIndex(rowIndex, rows.length),
            }}
          >
            {row.slots.map((slot, i) => {
              const offset =
                count === 1
                  ? 0
                  : (i - (count - 1) / 2) * Math.min(86, 210 / count);

              return (
                <button
                  key={`${slot.role}-${slot.index}`}
                  type="button"
                  disabled={props.locked}
                  onClick={() => props.onSlotPress(slot.role, slot.index)}
                  style={{
                    ...s.slotBtn,
                    transform: `translate(-50%, calc(-50% + ${offset}px))`,
                    cursor: props.locked ? "default" : "pointer",
                  }}
                >
                  {slot.player ? (
                    <>
                      <RoleBadge role={slot.role} field />
                      <span style={s.slotName}>
                        {slot.role === "P"
                          ? slot.player.team || slot.player.name
                          : shortName(slot.player.name)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={s.plusCircle}>+</span>
                      <span style={s.slotNameMuted}>
                        {ROLE_LABELS[slot.role] ?? slot.role}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function PlayerSheet(props: {
  role: string;
  currentId: string;
  options: Player[];
  onClose: () => void;
  onClear: () => void;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState("");

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();

    if (!needle) return props.options.slice(0, 12);

    return props.options
      .filter((p) =>
        `${p.name} ${p.team ?? ""}`.toLowerCase().includes(needle)
      )
      .slice(0, 20);
  }, [q, props.options]);

  return (
    <div style={s.sheetLayer}>
      <button
        type="button"
        aria-label="Chiudi selezione"
        style={s.sheetBackdrop}
        onClick={props.onClose}
      />

      <div style={s.sheet}>
        <div style={s.sheetHandle} />

        <div style={s.sheetHead}>
          <div>
            <h2 style={s.sheetTitle}>
              Seleziona {ROLE_LABELS[props.role] ?? props.role}
            </h2>

            <p style={s.sheetSubtitle}>
              Cerca per nome giocatore o nazionale.
            </p>
          </div>

          <button type="button" onClick={props.onClose} style={s.closeBtn}>
            ×
          </button>
        </div>

        <div style={s.searchWrap}>
          <span style={s.searchIcon}>⌕</span>

          <input
            value={q}
            autoFocus
            onChange={(e) => setQ(e.target.value)}
            placeholder="Scrivi il nome del giocatore"
            style={s.sheetSearch}
          />
        </div>

        {props.currentId && (
          <button type="button" onClick={props.onClear} style={s.clearCurrent}>
            Rimuovi giocatore selezionato
          </button>
        )}

        <div style={s.resultList}>
          {matches.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => props.onSelect(p.id)}
              style={{
                ...s.resultRow,
                background: p.id === props.currentId ? "#f0fdf4" : "white",
              }}
            >
              <RoleBadge role={p.role} large />

              <span style={s.resultText}>
                <b>{label(p)}</b>
                <small>{sub(p)}</small>
              </span>

              <span style={s.addBtn}>+</span>
            </button>
          ))}

          {matches.length === 0 && (
            <div style={s.emptyResults}>Nessun risultato trovato.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function RoleBadge({
  role,
  small = false,
  large = false,
  field = false,
}: {
  role: string;
  small?: boolean;
  large?: boolean;
  field?: boolean;
}) {
  const c = ROLE_COLORS[role] ?? {
    bg: "#f3f4f6",
    color: "#6b7280",
  };

  const size = large ? 44 : field ? 46 : small ? 22 : 34;

  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "inline-grid",
        placeItems: "center",
        background: c.bg,
        color: c.color,
        fontWeight: 1000,
        fontSize: large ? 16 : small ? 11 : 15,
        border: field ? "3px solid rgba(255,255,255,.86)" : "2px solid white",
        boxShadow: field ? "0 5px 14px rgba(15,23,42,.18)" : "0 3px 9px rgba(15,23,42,.10)",
        flexShrink: 0,
      }}
    >
      {role}
    </span>
  );
}

function normalizeFormData(value: any): FormData {
  const ppr =
    value?.players_per_role && typeof value.players_per_role === "object"
      ? value.players_per_role
      : { P: 1, D: 1, C: 1, A: 1 };

  return {
    competition_id: value?.competition_id ?? null,
    is_participant: Boolean(value?.is_participant),
    matchday: value?.matchday ?? null,
    players_per_role: ppr,
    players: Array.isArray(value?.players) ? value.players : [],
    lineup: value?.lineup ?? null,
  };
}

function buildInitialSelected(
  ppr: Record<string, number>,
  lineup: LineupData | null
) {
  const initial: Record<string, string[]> = {};

  Object.entries(ppr ?? {}).forEach(([role, count]) => {
    initial[role] = Array.from({ length: Number(count) || 0 }, () => "");
  });

  if (!lineup?.players?.length) return initial;

  for (const p of lineup.players) {
    if (!initial[p.role]) initial[p.role] = [];

    const emptyIndex = initial[p.role].findIndex((x) => !x);

    if (emptyIndex >= 0) initial[p.role][emptyIndex] = p.real_player_id;
    else initial[p.role].push(p.real_player_id);
  }

  return initial;
}

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 520,
    margin: "0 auto",
    padding: "14px 14px calc(76px + env(safe-area-inset-bottom, 0px) + 18px)",
    display: "grid",
    gap: 14,
  },

  headerCard: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 10px 28px rgba(15,23,42,.08)",
  },

  headerTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  headerStatus: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },

  giornata: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 900,
  },

  statusPill: {
    borderRadius: 999,
    padding: "6px 12px",
    background: "#f0fdf4",
    color: "#15803d",
    fontSize: 13,
    fontWeight: 1000,
  },

  titleRow: {
    marginTop: 18,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },

  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: 30,
    fontWeight: 1000,
    letterSpacing: "-0.04em",
  },

  subtitle: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.35,
  },

  countBox: {
    display: "grid",
    justifyItems: "center",
    gap: 1,
    background: "#f0fdf4",
    color: "#15803d",
    borderRadius: 16,
    padding: "8px 12px",
    fontWeight: 1000,
    flexShrink: 0,
  },

  rulesMini: {
    marginTop: 14,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },

  rulePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 999,
    padding: "4px 9px",
    fontSize: 12,
    fontWeight: 1000,
    color: "#0f172a",
  },

  warn: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#c2410c",
    fontWeight: 900,
    fontSize: 13,
  },

  ok: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    background: "#f0fdf4",
    border: "1px solid #86efac",
    color: "#15803d",
    fontWeight: 900,
    fontSize: 13,
  },

  err: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    background: "#fff1f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontWeight: 900,
    fontSize: 13,
  },

  card: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 10px 28px rgba(15,23,42,.08)",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },

  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 21,
    fontWeight: 1000,
    letterSpacing: "-0.03em",
  },

  infoBtn: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    border: "1px solid #e5e7eb",
    background: "white",
    color: "#64748b",
    fontWeight: 1000,
    cursor: "pointer",
  },

  field: {
    position: "relative",
    width: "100%",
    height: 276,
    borderRadius: 20,
    overflow: "hidden",
    background: "#15803d",
    boxShadow: "0 14px 32px rgba(15,23,42,.16)",
  },

  grass: {
    position: "absolute",
    inset: 0,
    background:
      "repeating-linear-gradient(180deg, #2f9e54 0, #2f9e54 12.5%, #2a9350 12.5%, #2a9350 25%)",
  },

  lines: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  },

  fieldColumn: {
    position: "absolute",
    top: 0,
    height: "100%",
    width: 1,
  },

  slotBtn: {
    position: "absolute",
    left: 0,
    top: "50%",
    border: 0,
    background: "transparent",
    padding: 0,
    display: "grid",
    justifyItems: "center",
    gap: 4,
    minWidth: 78,
    fontFamily: "inherit",
  },

  plusCircle: {
    width: 46,
    height: 46,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    color: "white",
    background: "rgba(255,255,255,.14)",
    border: "2px dashed rgba(255,255,255,.72)",
    fontSize: 28,
    fontWeight: 1000,
    boxShadow: "0 5px 14px rgba(15,23,42,.18)",
  },

  slotName: {
    color: "white",
    background: "rgba(15,23,42,.78)",
    borderRadius: 999,
    padding: "3px 8px",
    fontSize: 10.5,
    maxWidth: 92,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    fontWeight: 1000,
    textShadow: "0 1px 2px rgba(0,0,0,.28)",
  },

  slotNameMuted: {
    color: "white",
    background: "rgba(15,23,42,.52)",
    borderRadius: 999,
    padding: "3px 8px",
    fontSize: 9.5,
    fontWeight: 1000,
    textTransform: "uppercase",
  },

  btn: {
    width: "100%",
    padding: 14,
    border: "none",
    color: "white",
    borderRadius: 14,
    fontWeight: 1000,
    fontFamily: "inherit",
    cursor: "pointer",
    marginTop: 14,
  },

  duo: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    alignItems: "stretch",
  },

  infoCard: {
    display: "grid",
    gridTemplateColumns: "42px 1fr auto",
    gap: 10,
    alignItems: "center",
    minHeight: 76,
    border: "1px solid #e5e7eb",
    background: "white",
    borderRadius: 18,
    padding: 12,
    boxShadow: "0 8px 22px rgba(15,23,42,.07)",
    textAlign: "left",
    fontFamily: "inherit",
    cursor: "pointer",
  },

  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: "50%",
    background: "#f0fdf4",
    color: "#15803d",
    display: "grid",
    placeItems: "center",
    fontWeight: 1000,
    fontSize: 18,
  },

  chev: {
    color: "#64748b",
    fontSize: 24,
    lineHeight: 1,
  },

  sheetLayer: {
    position: "fixed",
    inset: 0,
    zIndex: 150,
    display: "grid",
    alignItems: "end",
    justifyItems: "center",
    pointerEvents: "none",
  },

  sheetBackdrop: {
    position: "absolute",
    inset: 0,
    border: 0,
    background: "rgba(13,24,18,.34)",
    pointerEvents: "auto",
  },

  sheet: {
    position: "relative",
    zIndex: 2,
    width: "100%",
    maxWidth: 520,
    height: "58vh",
    background: "white",
    borderRadius: "28px 28px 0 0",
    padding: "12px 18px calc(18px + env(safe-area-inset-bottom, 0px))",
    boxShadow: "0 -20px 46px rgba(15,23,42,.22)",
    display: "grid",
    gridTemplateRows: "auto auto auto auto 1fr",
    gap: 12,
    pointerEvents: "auto",
  },

  sheetHandle: {
    width: 52,
    height: 5,
    borderRadius: 999,
    background: "#d1d5db",
    justifySelf: "center",
  },

  sheetHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },

  sheetTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    fontWeight: 1000,
    letterSpacing: "-0.04em",
  },

  sheetSubtitle: {
    margin: "4px 0 0",
    color: "#64748b",
    fontWeight: 800,
    fontSize: 13,
  },

  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: 24,
    lineHeight: 1,
    cursor: "pointer",
  },

  searchWrap: {
    position: "relative",
  },

  searchIcon: {
    position: "absolute",
    left: 14,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#94a3b8",
    fontSize: 20,
    pointerEvents: "none",
  },

  sheetSearch: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "0 14px 0 42px",
    fontFamily: "inherit",
    fontSize: 15,
    fontWeight: 800,
    outline: "none",
  },

  clearCurrent: {
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#dc2626",
    borderRadius: 12,
    padding: 10,
    fontFamily: "inherit",
    fontWeight: 1000,
    cursor: "pointer",
  },

  resultList: {
    overflowY: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
  },

  resultRow: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "44px 1fr 34px",
    alignItems: "center",
    gap: 12,
    minHeight: 70,
    padding: "10px 12px",
    border: 0,
    borderBottom: "1px solid #f1f5f9",
    textAlign: "left",
    fontFamily: "inherit",
    cursor: "pointer",
  },

  resultText: {
    display: "grid",
    gap: 2,
    color: "#0f172a",
    fontSize: 15,
  },

  addBtn: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    background: "#16a34a",
    color: "white",
    fontSize: 22,
    fontWeight: 1000,
  },

  emptyResults: {
    padding: 18,
    color: "#64748b",
    fontWeight: 800,
    textAlign: "center",
  },
};
