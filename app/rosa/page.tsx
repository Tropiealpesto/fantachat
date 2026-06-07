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
  is_participant: boolean;
  matchday: Matchday | null;
  players_per_role: Record<string, number>;
  players: Player[];
  lineup: LineupData | null;
};

const ROLE_LABELS: Record<string, string> = {
  P: "Portiere",
  D: "Difensore",
  C: "Centrocampista",
  A: "Attaccante",
};

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  P: { bg: "#fef9c3", color: "#a16207" },
  D: { bg: "#dcfce7", color: "#15803d" },
  C: { bg: "#dbeafe", color: "#1d4ed8" },
  A: { bg: "#fee2e2", color: "#dc2626" },
};

const EMPTY_FORM: FormData = {
  is_participant: false,
  matchday: null,
  players_per_role: { P: 1, D: 1, C: 1, A: 1 },
  players: [],
  lineup: null,
};

export default function RosaPage() {
  const app = useRequireApp(false);

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

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
    () => roles.reduce((sum, [, n]) => sum + Number(n || 0), 0),
    [roles]
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

        const initial = buildInitialSelected(
          nextForm.players_per_role,
          nextForm.lineup
        );

        setSelected(initial);
        setSaved(Boolean(nextForm.lineup?.id));
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [app.ready, app.activeLeagueCompetitionId]);

  function playersForRole(role: string, currentId?: string) {
    return form.players
      .filter((p) => p.role === role)
      .filter((p) => p.id === currentId || !selectedIds.includes(p.id))
      .sort((a, b) => a.name.localeCompare(b.name));
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

    const validation = validate();
    if (validation) return setErr(validation);

    const playersPayload = Object.entries(selected).flatMap(([role, ids]) =>
      ids
        .filter(Boolean)
        .map((real_player_id) => ({
          role,
          real_player_id,
        }))
    );

    setSaving(true);

    try {
      const { error } = await supabase.rpc("submit_lineup", {
        p_league_competition_id: app.activeLeagueCompetitionId,
        p_matchday_id: form.matchday.id,
        p_players: playersPayload,
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

  return (
    <>
      <AppBar
        league={app.leagueName}
        team={app.teamName}
        onMenuOpen={app.openDrawer}
      />

      <main style={s.container}>
        <div style={{ ...s.card, borderLeft: `4px solid ${app.competitionTheme.primary}` }}>
          <CompetitionBadge name={app.competitionName} type={app.competitionType} />

          <h1 style={s.title}>Rosa</h1>

          <div style={s.summary}>
            <span>
              Giornata: <b>{form.matchday?.number ?? "—"}</b>
            </span>
            <span style={s.status}>{form.matchday?.status ?? "locked"}</span>
          </div>

          <div style={s.rulesMini}>
            {roles.map(([role, count]) => (
              <span key={role}>
                {count} {role}
              </span>
            ))}
            <b>{totalPlayers} giocatori</b>
          </div>

          {!form.is_participant && (
            <div style={s.warn}>
              Non partecipi a questa competizione.
            </div>
          )}

          {form.is_participant && !form.matchday && (
            <div style={s.warn}>
              Nessuna giornata aperta per questa competizione.
            </div>
          )}

          {saved && (
            <div style={s.ok}>
              Rosa già inviata. Per modificarla serve il reset admin.
            </div>
          )}
        </div>

        <Campo
          players={form.players}
          selected={selected}
          roles={roles}
        />

        <div style={s.card}>
          <h2 style={s.cardTitle}>Seleziona giocatori</h2>

          {roles.map(([role, count]) => (
            <div key={role} style={s.roleBlock}>
              <div style={s.roleTitle}>
                <RoleBadge role={role} />
                <span>{ROLE_LABELS[role] ?? role}</span>
                <small>{count} giocatori</small>
              </div>

              {Array.from({ length: Number(count) || 0 }).map((_, index) => {
                const currentId = selected[role]?.[index] ?? "";

                return (
                  <select
                    key={`${role}-${index}`}
                    value={currentId}
                    onChange={(e) => selectPlayer(role, index, e.target.value)}
                    disabled={saved || !form.is_participant || !form.matchday}
                    style={s.select}
                  >
                    <option value="">
                      Scegli {ROLE_LABELS[role] ?? role} #{index + 1}
                    </option>

                    {playersForRole(role, currentId).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.team ? ` (${p.team})` : ""}
                      </option>
                    ))}
                  </select>
                );
              })}

              {playersForRole(role).length === 0 && (
                <div style={s.emptyRole}>
                  Nessun giocatore disponibile per questo ruolo.
                </div>
              )}
            </div>
          ))}

          {!saved && (
            <button
              type="button"
              onClick={save}
              disabled={saving || !form.is_participant || !form.matchday}
              style={{
                ...s.btn,
                background:
                  form.is_participant && form.matchday
                    ? app.competitionTheme.primary
                    : "#d1d5db",
              }}
            >
              {saving ? "Invio..." : "Invia rosa"}
            </button>
          )}

          {msg && <div style={s.ok}>{msg}</div>}
          {err && <div style={s.err}>{err}</div>}
        </div>
      </main>

      <BottomNav />
    </>
  );
}

function normalizeFormData(value: any): FormData {
  const playersPerRole =
    value?.players_per_role && typeof value.players_per_role === "object"
      ? value.players_per_role
      : { P: 1, D: 1, C: 1, A: 1 };

  return {
    is_participant: Boolean(value?.is_participant),
    matchday: value?.matchday ?? null,
    players_per_role: playersPerRole,
    players: Array.isArray(value?.players) ? value.players : [],
    lineup: value?.lineup ?? null,
  };
}

function buildInitialSelected(
  playersPerRole: Record<string, number>,
  lineup: LineupData | null
) {
  const initial: Record<string, string[]> = {};

  Object.entries(playersPerRole ?? {}).forEach(([role, count]) => {
    initial[role] = Array.from({ length: Number(count) || 0 }, () => "");
  });

  if (!lineup?.players?.length) return initial;

  for (const p of lineup.players) {
    if (!initial[p.role]) initial[p.role] = [];

    const emptyIndex = initial[p.role].findIndex((x) => !x);

    if (emptyIndex >= 0) {
      initial[p.role][emptyIndex] = p.real_player_id;
    } else {
      initial[p.role].push(p.real_player_id);
    }
  }

  return initial;
}

function roleOrder(role: string) {
  return { A: 1, C: 2, D: 3, P: 4 }[role as "A" | "C" | "D" | "P"] ?? 10;
}

function RoleBadge({ role }: { role: string }) {
  const c = ROLE_COLORS[role] ?? { bg: "#f3f4f6", color: "#6b7280" };

  return (
    <span style={{ ...s.roleBadge, background: c.bg, color: c.color }}>
      {role}
    </span>
  );
}

function Campo(props: {
  players: Player[];
  selected: Record<string, string[]>;
  roles: [string, number][];
}) {
  const byId = new Map(props.players.map((p) => [p.id, p]));

  const rows = props.roles
    .map(([role]) => {
      const ids = props.selected[role] ?? [];
      return {
        role,
        players: ids.map((id) => byId.get(id)).filter(Boolean) as Player[],
        slots: ids.length,
      };
    })
    .filter((row) => row.slots > 0)
    .sort((a, b) => roleOrder(a.role) - roleOrder(b.role));

  const topByIndex = (index: number, total: number) => {
    if (total <= 1) return "50%";
    const min = 14;
    const max = 86;
    return `${min + ((max - min) / (total - 1)) * index}%`;
  };

  return (
    <div style={s.field}>
      <svg style={s.fieldSvg} viewBox="0 0 300 484" preserveAspectRatio="none">
        <rect width="300" height="484" fill="#2d8a4e" />
        <rect x="12" y="12" width="276" height="460" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="2" rx="3" />
        <rect x="75" y="12" width="150" height="70" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" />
        <rect x="110" y="12" width="80" height="28" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" />
        <circle cx="150" cy="242" r="42" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        <line x1="12" y1="242" x2="288" y2="242" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        <path d="M 55 472 A 95 95 0 0 1 245 472" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" />
      </svg>

      {rows.map((row, rowIndex) => {
        const top = topByIndex(rowIndex, rows.length);
        const count = Math.max(row.slots, 1);

        return (
          <div
            key={row.role}
            style={{
              ...s.fieldRow,
              top,
            }}
          >
            {Array.from({ length: count }).map((_, i) => {
              const p = row.players[i];
              const offset = count === 1 ? 0 : (i - (count - 1) / 2) * Math.min(86, 250 / count);

              return (
                <div
                  key={`${row.role}-${i}`}
                  style={{
                    ...s.playerDot,
                    transform: `translate(calc(-50% + ${offset}px), -50%)`,
                  }}
                >
                  <RoleBadge role={row.role} />
                  <span style={s.playerName}>{p?.name ?? "—"}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
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
  card: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 4px 16px rgba(15,23,42,0.06)",
  },
  title: {
    margin: "12px 0 8px",
    fontSize: 26,
    fontWeight: 1000,
    color: "#111827",
  },
  cardTitle: {
    margin: "0 0 12px",
    fontSize: 20,
    fontWeight: 1000,
    color: "#111827",
  },
  summary: {
    color: "#6b7280",
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  status: {
    borderRadius: 999,
    padding: "3px 9px",
    background: "#f3f4f6",
    fontSize: 11,
    fontWeight: 900,
  },
  rulesMini: {
    marginTop: 12,
    display: "flex",
    flexWrap: "wrap",
    gap: 7,
    color: "#374151",
    fontSize: 12,
    fontWeight: 900,
  },
  field: {
    position: "relative",
    width: "100%",
    aspectRatio: "0.62",
    borderRadius: 18,
    overflow: "hidden",
    boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
  },
  fieldSvg: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  },
  fieldRow: {
    position: "absolute",
    left: "50%",
    width: "100%",
    height: 1,
  },
  playerDot: {
    position: "absolute",
    left: "50%",
    top: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 5,
  },
  playerName: {
    maxWidth: 84,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    background: "rgba(0,0,0,0.65)",
    color: "white",
    borderRadius: 7,
    padding: "3px 7px",
    fontSize: 11,
    fontWeight: 900,
  },
  roleBlock: {
    display: "grid",
    gap: 9,
    marginBottom: 15,
  },
  roleTitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 1000,
    color: "#111827",
  },
  roleBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    display: "inline-grid",
    placeItems: "center",
    fontWeight: 1000,
    fontSize: 13,
  },
  select: {
    padding: 13,
    borderRadius: 13,
    border: "1px solid #e5e7eb",
    fontFamily: "inherit",
    fontWeight: 800,
    background: "white",
  },
  btn: {
    width: "100%",
    padding: 14,
    border: "none",
    color: "white",
    borderRadius: 13,
    fontWeight: 1000,
    fontFamily: "inherit",
    cursor: "pointer",
  },
  ok: {
    marginTop: 10,
    background: "#f0fdf4",
    border: "1px solid #86efac",
    color: "#15803d",
    borderRadius: 12,
    padding: 12,
    fontWeight: 900,
  },
  warn: {
    marginTop: 10,
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#b85c0a",
    borderRadius: 12,
    padding: 12,
    fontWeight: 900,
  },
  err: {
    marginTop: 10,
    background: "#fff1f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    borderRadius: 12,
    padding: 12,
    fontWeight: 900,
  },
  emptyRole: {
    color: "#b85c0a",
    fontSize: 12,
    fontWeight: 800,
    background: "#fff7ed",
    borderRadius: 10,
    padding: 10,
  },
};
