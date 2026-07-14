"use client";

import { useEffect, useMemo, useState } from "react";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import LoadingScreen from "../components/LoadingScreen";
import CompetitionBadge from "../components/CompetitionBadge";
import { BadgePattern } from "../components/TeamBadge";
import { useRequireApp } from "../hooks/useRequireApp";
import { supabase } from "../../lib/supabaseClient";

type Player = {
  id: string;
  name: string;
  role: string;
  team: string;
};

type Coach = {
  id: string;
  name: string;
  team: string;
  real_team_id?: string | null;
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
  coach?: {
    real_coach_id: string;
    name?: string | null;
    team?: string | null;
  } | null;
};

type FormData = {
  competition_id: string | null;
  is_participant: boolean;
  matchday: Matchday | null;
  players_per_role: Record<string, number>;
  players: Player[];
  coach_enabled: boolean;
  coaches: Coach[];
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

type Kit = {
  primary: string;
  secondary: string;
  pattern: BadgePattern;
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
  AL: { bg: "#F5F3FF", color: "#7C3AED" },
};

const EMPTY_FORM: FormData = {
  competition_id: null,
  is_participant: false,
  matchday: null,
  players_per_role: { P: 1, D: 1, C: 1, A: 1 },
  players: [],
  coach_enabled: false,
  coaches: [],
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

function fallbackColor(seed?: string | null) {
  const colors = ["#14532d", "#1d4ed8", "#991b1b", "#854d0e", "#0f766e", "#4338ca"];
  const value = (seed ?? "").split("").reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return colors[value % colors.length];
}

function TeamShirt({
  team,
  colors,
  size = 40,
}: {
  team?: string | null;
  colors?: Kit | null;
  size?: number;
}) {
  const primary = colors?.primary ?? fallbackColor(team);
  const secondary = colors?.secondary ?? "#ffffff";
  const stripe =
    colors?.pattern === "stripes"
      ? `repeating-linear-gradient(90deg, ${primary} 0 8px, ${secondary} 8px 13px)`
      : colors?.pattern === "split"
        ? `linear-gradient(90deg, ${primary} 0 50%, ${secondary} 50% 100%)`
        : primary;

  return (
    <span
      style={{
        width: size,
        height: Math.round(size * 0.92),
        display: "inline-block",
        position: "relative",
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <span
        style={{
          position: "absolute",
          inset: `${Math.round(size * 0.16)}px ${Math.round(size * 0.18)}px 0`,
          background: stripe,
          borderRadius: "4px 4px 3px 3px",
          border: "1px solid rgba(255,255,255,.42)",
        }}
      />
      <span
        style={{
          position: "absolute",
          left: 0,
          top: Math.round(size * 0.2),
          width: Math.round(size * 0.25),
          height: Math.round(size * 0.34),
          background: primary,
          borderRadius: "4px 1px 3px 3px",
          transform: "skewY(-16deg)",
          border: "1px solid rgba(255,255,255,.34)",
        }}
      />
      <span
        style={{
          position: "absolute",
          right: 0,
          top: Math.round(size * 0.2),
          width: Math.round(size * 0.25),
          height: Math.round(size * 0.34),
          background: primary,
          borderRadius: "1px 4px 3px 3px",
          transform: "skewY(16deg)",
          border: "1px solid rgba(255,255,255,.34)",
        }}
      />
      <span
        style={{
          position: "absolute",
          left: "50%",
          top: Math.round(size * 0.15),
          width: Math.round(size * 0.24),
          height: Math.round(size * 0.16),
          transform: "translateX(-50%)",
          background: "#ffffff",
          borderRadius: "0 0 999px 999px",
          opacity: 0.78,
        }}
      />
    </span>
  );
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
  const [coachSheetOpen, setCoachSheetOpen] = useState(false);
  const [selectedCoachId, setSelectedCoachId] = useState("");
  const [teamColors, setTeamColors] = useState<Record<string, Kit>>({});

  function kitOf(team?: string | null): Kit | null {
    if (!team) return null;
    return teamColors[team.trim().toLowerCase()] ?? null;
  }

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

  const totalRequired = totalPlayers + (form.coach_enabled ? 1 : 0);

  const byId = useMemo(
    () => new Map(form.players.map((p) => [p.id, p])),
    [form.players]
  );

  const coachById = useMemo(
    () => new Map(form.coaches.map((c) => [c.id, c])),
    [form.coaches]
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
        setSelectedCoachId(nextForm.lineup?.coach?.real_coach_id ?? "");
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

  useEffect(() => {
    const lc = app.activeLeagueCompetitionId;
    if (!lc) return;

    let off = false;

    supabase
      .rpc("get_competition_team_colors", {
        p_league_competition_id: lc,
      })
      .then(({ data }) => {
        if (off || !data) return;

        const m: Record<string, Kit> = {};

        (data as any[]).forEach((r) => {
          if (r.name && r.color_primary) {
            m[String(r.name).trim().toLowerCase()] = {
              primary: r.color_primary,
              secondary: r.color_secondary || r.color_primary,
              pattern: (r.kit_pattern || "split") as BadgePattern,
            };
          }
        });

        setTeamColors(m);
      });

    return () => {
      off = true;
    };
  }, [app.activeLeagueCompetitionId]);

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

    if (form.coach_enabled && !selectedCoachId) {
      return "Seleziona l'allenatore.";
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
        p_coach_id: form.coach_enabled ? selectedCoachId : null,
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

  const selectedCount = selectedIds.length + (form.coach_enabled && selectedCoachId ? 1 : 0);
  const completionLabel = `${selectedCount}/${totalRequired}`;
  const selectedCoach =
    selectedCoachId
      ? coachById.get(selectedCoachId) ??
        {
          id: selectedCoachId,
          name: form.lineup?.coach?.name ?? "Allenatore",
          team: form.lineup?.coach?.team ?? "",
        }
      : null;

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
              <span className="fc-dark-neon-pill" style={s.statusPill}>{form.matchday?.status ?? "chiusa"}</span>
            </div>
          </div>

          <div style={s.titleRow}>
            <div>
              <h1 style={s.title}>Rosa</h1>
              <p style={s.subtitle}>
                Tocca uno slot nel campo per scegliere il giocatore.
              </p>
            </div>

            <div className="fc-dark-neon-count" style={s.countBox}>
              <span>{completionLabel}</span>
              <small>{form.coach_enabled ? "slot" : "giocatori"}</small>
            </div>
          </div>

          <div style={s.rulesMini}>
            {roles.map(([role, count]) => (
              <span key={role} className="fc-dark-neon-pill fc-dark-role-pill" style={s.rulePill}>
                <RoleBadge role={role} small />
                {count}
              </span>
            ))}
            {form.coach_enabled && (
              <span className="fc-dark-neon-pill fc-dark-role-pill" style={s.rulePill}>
                <RoleBadge role="AL" small />
                1
              </span>
            )}
          </div>

          {!form.is_participant && (
            <div style={s.warn}>Non partecipi a questa competizione.</div>
          )}

          {form.is_participant && !form.matchday && (
            <div style={s.warn}>Nessuna giornata aperta.</div>
          )}

          {saved && (
            <div className="fc-dark-neon-message" style={s.ok}>
              Rosa già inviata. Per modificarla serve il reset admin.
            </div>
          )}

          {msg && <div className="fc-dark-neon-message" style={s.ok}>{msg}</div>}
          {err && <div className="fc-dark-neon-error" style={s.err}>{err}</div>}
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
            kitOf={kitOf}
            coachEnabled={form.coach_enabled}
            coach={selectedCoach}
            onCoachPress={() => setCoachSheetOpen(true)}
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
          <button type="button" className="fc-dark-neon-info-card" style={s.infoCard}>
            <span className="fc-dark-neon-info-icon" style={s.infoIcon}>▣</span>
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

          <button type="button" className="fc-dark-neon-info-card" style={s.infoCard}>
            <span className="fc-dark-neon-info-icon" style={s.infoIcon}>♛</span>
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
          kitOf={kitOf}
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

      {coachSheetOpen && (
        <CoachSheet
          currentId={selectedCoachId}
          options={form.coaches}
          onClose={() => setCoachSheetOpen(false)}
          onClear={() => {
            setSelectedCoachId("");
            setCoachSheetOpen(false);
          }}
          onSelect={(id) => {
            setSelectedCoachId(id);
            setCoachSheetOpen(false);
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
  kitOf: (team?: string | null) => Kit | null;
  coachEnabled: boolean;
  coach: Coach | null;
  onCoachPress: () => void;
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
          rx="6"
          fill="none"
          stroke="rgba(255,255,255,.48)"
          strokeWidth="2"
        />
        <line
          x1="210"
          y1="12"
          x2="210"
          y2="248"
          stroke="rgba(255,255,255,.36)"
          strokeWidth="2"
        />
        <circle
          cx="210"
          cy="130"
          r="40"
          fill="none"
          stroke="rgba(255,255,255,.36)"
          strokeWidth="2"
        />
        <circle cx="210" cy="130" r="2.5" fill="rgba(255,255,255,.52)" />
        <rect
          x="12"
          y="82"
          width="54"
          height="96"
          fill="none"
          stroke="rgba(255,255,255,.36)"
          strokeWidth="2"
        />
        <rect
          x="354"
          y="82"
          width="54"
          height="96"
          fill="none"
          stroke="rgba(255,255,255,.36)"
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
                  : (i - (count - 1) / 2) * Math.min(60, 152 / count);

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
                      <TeamShirt
                        team={slot.player.team}
                        colors={props.kitOf(slot.player.team)}
                        size={30}
                      />
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

      {props.coachEnabled && (
        <button
          type="button"
          disabled={props.locked}
          onClick={props.onCoachPress}
          style={{
            ...s.coachSlot,
            cursor: props.locked ? "default" : "pointer",
          }}
        >
          <RoleBadge role="AL" />
          <span style={props.coach ? s.coachName : s.slotNameMuted}>
            {props.coach ? shortName(props.coach.name) : "Allenatore"}
          </span>
          {props.coach?.team && <small style={s.coachTeam}>{props.coach.team}</small>}
        </button>
      )}
    </div>
  );
}

function PlayerSheet(props: {
  role: string;
  currentId: string;
  options: Player[];
  kitOf: (team?: string | null) => Kit | null;
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
              <TeamShirt team={p.team} colors={props.kitOf(p.team)} size={34} />

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

function CoachSheet(props: {
  currentId: string;
  options: Coach[];
  onClose: () => void;
  onClear: () => void;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState("");

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();

    if (!needle) return props.options.slice(0, 12);

    return props.options
      .filter((c) => `${c.name} ${c.team}`.toLowerCase().includes(needle))
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
            <h2 style={s.sheetTitle}>Seleziona allenatore</h2>
            <p style={s.sheetSubtitle}>Cerca per nome allenatore o squadra.</p>
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
            placeholder="Scrivi il nome dell'allenatore"
            style={s.sheetSearch}
          />
        </div>

        {props.currentId && (
          <button type="button" onClick={props.onClear} style={s.clearCurrent}>
            Rimuovi allenatore selezionato
          </button>
        )}

        <div style={s.resultList}>
          {matches.map((coach) => (
            <button
              key={coach.id}
              type="button"
              onClick={() => props.onSelect(coach.id)}
              style={{
                ...s.resultRow,
                background: coach.id === props.currentId ? "#f0fdf4" : "white",
              }}
            >
              <RoleBadge role="AL" />

              <span style={s.resultText}>
                <b>{coach.name}</b>
                <small>{coach.team}</small>
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
    bg: role === "AL" ? "#F5F3FF" : "#f3f4f6",
    color: role === "AL" ? "#7C3AED" : "#6b7280",
  };

  const size = large ? 44 : field ? 46 : small ? 22 : 34;

  return (
    <span
      className={`fc-role-badge fc-role-${role}`}
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
      {role === "AL" ? "AL" : role}
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
    coach_enabled: Boolean(value?.coach_enabled),
    coaches: Array.isArray(value?.coaches) ? value.coaches : [],
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
    padding: "9px 12px calc(76px + env(safe-area-inset-bottom, 0px) + 12px)",
    display: "grid",
    gap: 9,
  },

  headerCard: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 10,
    boxShadow: "0 3px 12px rgba(15,23,42,.04)",
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
    fontSize: 11.5,
    fontWeight: 900,
  },

  statusPill: {
    borderRadius: 8,
    padding: "5px 9px",
    background: "#f0fdf4",
    color: "#15803d",
    fontSize: 11.5,
    fontWeight: 1000,
  },

  titleRow: {
    marginTop: 10,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },

  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: 21,
    fontWeight: 1000,
    letterSpacing: "-0.035em",
  },

  subtitle: {
    margin: "3px 0 0",
    color: "#64748b",
    fontSize: 11.5,
    fontWeight: 800,
    lineHeight: 1.35,
  },

  countBox: {
    display: "grid",
    justifyItems: "center",
    gap: 1,
    background: "#f8fafc",
    color: "#15803d",
    borderRadius: 7,
    border: "1px solid #e5e7eb",
    padding: "6px 9px",
    fontWeight: 1000,
    flexShrink: 0,
  },

  rulesMini: {
    marginTop: 9,
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },

  rulePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 7,
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 1000,
    color: "#0f172a",
  },

  warn: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    background: "#fff3e4",
    border: "1px solid #f4c99d",
    color: "#c2410c",
    fontWeight: 900,
    fontSize: 13,
  },

  ok: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    background: "#f0fdf4",
    border: "1px solid #86efac",
    color: "#15803d",
    fontWeight: 900,
    fontSize: 13,
  },

  err: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    background: "#fff1f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    fontWeight: 900,
    fontSize: 13,
  },

  card: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 10,
    boxShadow: "0 3px 12px rgba(15,23,42,.04)",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 10,
  },

  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 15.5,
    fontWeight: 1000,
    letterSpacing: "-0.03em",
  },

  infoBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "white",
    color: "#64748b",
    fontWeight: 1000,
    cursor: "pointer",
  },

  field: {
    position: "relative",
    width: "100%",
    height: 214,
    borderRadius: 8,
    overflow: "hidden",
    background: "#0f5f2d",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,.2), 0 4px 12px rgba(15,23,42,.08)",
  },

  grass: {
    position: "absolute",
    inset: 0,
    background:
      "repeating-linear-gradient(180deg, #227f42 0, #227f42 12.5%, #1d733b 12.5%, #1d733b 25%)",
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
    gap: 2,
    minWidth: 52,
    fontFamily: "inherit",
  },

  plusCircle: {
    width: 30,
    height: 30,
    borderRadius: 9,
    display: "grid",
    placeItems: "center",
    color: "#f4c99d",
    background: "rgba(255,255,255,.1)",
    border: "1px dashed rgba(253,186,116,.82)",
    fontSize: 18,
    fontWeight: 1000,
    boxShadow: "0 2px 6px rgba(15,23,42,.14)",
  },

  slotName: {
    color: "white",
    background: "rgba(15,23,42,.72)",
    borderRadius: 6,
    padding: "2px 5px",
    fontSize: 9,
    maxWidth: 66,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    fontWeight: 1000,
    textShadow: "0 1px 2px rgba(0,0,0,.28)",
  },

  slotNameMuted: {
    color: "white",
    background: "rgba(15,23,42,.44)",
    borderRadius: 6,
    padding: "2px 6px",
    fontSize: 9,
    fontWeight: 1000,
    textTransform: "uppercase",
  },

  coachSlot: {
    position: "absolute",
    right: 8,
    top: 8,
    zIndex: 4,
    border: "1px solid rgba(255,255,255,.22)",
    borderRadius: 8,
    background: "rgba(15,23,42,.58)",
    padding: "6px 7px",
    display: "grid",
    justifyItems: "center",
    gap: 2,
    minWidth: 74,
    maxWidth: 92,
    color: "white",
    fontFamily: "inherit",
    boxShadow: "0 8px 18px rgba(15,23,42,.18)",
    backdropFilter: "blur(8px)",
  },

  coachName: {
    color: "white",
    fontSize: 9.5,
    lineHeight: 1.05,
    maxWidth: 74,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    fontWeight: 1000,
  },

  coachTeam: {
    color: "rgba(255,255,255,.72)",
    fontSize: 8.5,
    fontWeight: 900,
    maxWidth: 74,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },

  btn: {
    width: "100%",
    padding: 10,
    border: "none",
    color: "white",
    borderRadius: 8,
    fontWeight: 1000,
    fontFamily: "inherit",
    cursor: "pointer",
    marginTop: 9,
  },

  duo: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 9,
    alignItems: "stretch",
  },

  infoCard: {
    display: "grid",
    gridTemplateColumns: "28px 1fr auto",
    gap: 7,
    alignItems: "center",
    minHeight: 52,
    border: "1px solid #e5e7eb",
    background: "white",
    borderRadius: 10,
    padding: 9,
    boxShadow: "0 3px 12px rgba(15,23,42,.04)",
    textAlign: "left",
    fontFamily: "inherit",
    cursor: "pointer",
  },

  infoIcon: {
    width: 28,
    height: 28,
    borderRadius: 7,
    background: "#f0fdf4",
    color: "#15803d",
    display: "grid",
    placeItems: "center",
    fontWeight: 1000,
    fontSize: 13,
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
    background: "rgba(13,24,18,.28)",
    pointerEvents: "auto",
  },

  sheet: {
    position: "relative",
    zIndex: 2,
    width: "100%",
    maxWidth: 520,
    height: "62vh",
    background: "white",
    borderRadius: "16px 16px 0 0",
    padding: "10px 12px calc(14px + env(safe-area-inset-bottom, 0px))",
    boxShadow: "0 -16px 34px rgba(15,23,42,.18)",
    display: "grid",
    gridTemplateRows: "auto auto auto auto 1fr",
    gap: 9,
    pointerEvents: "auto",
  },

  sheetHandle: {
    width: 44,
    height: 4,
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
    fontSize: 19,
    fontWeight: 1000,
    letterSpacing: "-0.035em",
  },

  sheetSubtitle: {
    margin: "2px 0 0",
    color: "#64748b",
    fontWeight: 800,
    fontSize: 11.5,
  },

  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
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
    left: 12,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#94a3b8",
    fontSize: 18,
    pointerEvents: "none",
  },

  sheetSearch: {
    width: "100%",
    height: 42,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    padding: "0 12px 0 36px",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 800,
    outline: "none",
  },

  clearCurrent: {
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#dc2626",
    borderRadius: 10,
    padding: 9,
    fontFamily: "inherit",
    fontWeight: 1000,
    cursor: "pointer",
  },

  resultList: {
    overflowY: "auto",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
  },

  resultRow: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "38px 1fr 28px",
    alignItems: "center",
    gap: 10,
    minHeight: 58,
    padding: "8px 10px",
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
    fontSize: 13,
  },

  addBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    background: "#e07b1a",
    color: "white",
    fontSize: 18,
    fontWeight: 1000,
  },

  emptyResults: {
    padding: 16,
    color: "#64748b",
    fontWeight: 800,
    textAlign: "center",
  },
};
