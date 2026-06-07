"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

const ROLE_LABELS: Record<string, string> = {
  P: "Portiere",
  D: "Difensore",
  C: "Centrocampista",
  A: "Attaccante",
};

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  P: { bg: "#fefce8", color: "#a16207" },
  D: { bg: "#dcfce7", color: "#15803d" },
  C: { bg: "#dbeafe", color: "#1d4ed8" },
  A: { bg: "#fee2e2", color: "#dc2626" },
};

export default function RosaPage() {
  const app = useRequireApp(false);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [matchday, setMatchday] = useState<Matchday | null>(null);
  const [playersPerRole, setPlayersPerRole] = useState<Record<string, number>>({ P: 1, D: 1, C: 1, A: 1 });
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const roles = useMemo(
    () => Object.entries(playersPerRole).filter(([, n]) => Number(n) > 0),
    [playersPerRole]
  );

  const selectedIds = useMemo(
    () => Object.values(selected).flat().filter(Boolean),
    [selected]
  );

  useEffect(() => {
    async function load() {
      if (!app.ready || !app.activeLeagueId || !app.activeLeagueCompetitionId || !app.competitionId) return;

      setLoading(true);
      setErr(null);

      try {
        const { data: cfg } = await supabase
          .from("competition_config")
          .select("players_per_role")
          .eq("league_competition_id", app.activeLeagueCompetitionId)
          .maybeSingle();

        const configRoles = (cfg as any)?.players_per_role ?? { P: 1, D: 1, C: 1, A: 1 };
        setPlayersPerRole(configRoles);

        const initialSelected: Record<string, string[]> = {};
        Object.entries(configRoles).forEach(([role, count]) => {
          initialSelected[role] = Array.from({ length: Number(count) || 0 }, () => "");
        });

        const { data: md } = await supabase
          .from("matchdays")
          .select("id,number,status")
          .eq("league_competition_id", app.activeLeagueCompetitionId)
          .eq("status", "open")
          .order("number", { ascending: true })
          .limit(1)
          .maybeSingle();

        setMatchday((md as Matchday) ?? null);

        let loadedPlayers: Player[] = [];

        const { data: cp, error: cpErr } = await supabase
          .from("competition_players")
          .select("real_players(id,name,role,team,real_teams(name))")
          .eq("competition_id", app.competitionId)
          .eq("active", true);

        if (!cpErr && cp) {
          loadedPlayers = (cp as any[]).map((x) => {
            const p = x.real_players;
            return {
              id: p?.id,
              name: p?.name ?? "—",
              role: p?.role ?? "",
              team: p?.real_teams?.name ?? p?.team ?? "",
            };
          }).filter((p) => p.id);
        }

        if (loadedPlayers.length === 0) {
          const { data: rp } = await supabase
            .from("real_players")
            .select("id,name,role,team")
            .eq("competition_id", app.competitionId)
            .eq("active", true)
            .order("name", { ascending: true });

          loadedPlayers = ((rp ?? []) as any[]).map((p) => ({
            id: p.id,
            name: p.name,
            role: p.role,
            team: p.team ?? "",
          }));
        }

        setPlayers(loadedPlayers);

        if (md?.id) {
          const { data: lineup } = await supabase
            .from("lineups")
            .select("id,lineup_players(role,real_player_id)")
            .eq("league_competition_id", app.activeLeagueCompetitionId)
            .eq("matchday_id", md.id)
            .eq("user_id", app.userId)
            .maybeSingle();

          if (lineup && (lineup as any).lineup_players?.length) {
            const byRole: Record<string, string[]> = {};
            Object.entries(configRoles).forEach(([role, count]) => {
              byRole[role] = Array.from({ length: Number(count) || 0 }, () => "");
            });

            for (const lp of (lineup as any).lineup_players) {
              if (!byRole[lp.role]) byRole[lp.role] = [];
              const emptyIndex = byRole[lp.role].findIndex((x) => !x);
              if (emptyIndex >= 0) byRole[lp.role][emptyIndex] = lp.real_player_id;
              else byRole[lp.role].push(lp.real_player_id);
            }

            setSelected(byRole);
            setSaved(true);
          } else {
            setSelected(initialSelected);
            setSaved(false);
          }
        } else {
          setSelected(initialSelected);
          setSaved(false);
        }
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [app.ready, app.activeLeagueId, app.activeLeagueCompetitionId, app.competitionId, app.userId]);

  function playersForRole(role: string, currentId?: string) {
    return players
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

    if (!app.activeLeagueId || !app.activeLeagueCompetitionId || !matchday?.id || !app.userId) {
      return setErr("Nessuna giornata aperta.");
    }

    const validation = validate();
    if (validation) return setErr(validation);

    setSaving(true);

    try {
      const { data: lineup, error: luErr } = await supabase
        .from("lineups")
        .upsert(
          {
            league_id: app.activeLeagueId,
            league_competition_id: app.activeLeagueCompetitionId,
            matchday_id: matchday.id,
            user_id: app.userId,
            submitted_at: new Date().toISOString(),
            submitted_status: "within",
          },
          { onConflict: "league_competition_id,matchday_id,user_id" }
        )
        .select("id")
        .single();

      if (luErr) throw luErr;

      await supabase.from("lineup_players").delete().eq("lineup_id", lineup.id);

      const inserts = Object.entries(selected).flatMap(([role, ids]) =>
        ids.filter(Boolean).map((id) => ({
          lineup_id: lineup.id,
          real_player_id: id,
          role,
        }))
      );

      const { error: lpErr } = await supabase.from("lineup_players").insert(inserts);
      if (lpErr) throw lpErr;

      await supabase.from("messages").insert({
        league_id: app.activeLeagueId,
        league_competition_id: app.activeLeagueCompetitionId,
        matchday_id: matchday.id,
        user_id: app.userId,
        message_type: "lineup_notification",
        content: `${app.teamName} ha schierato la formazione`,
      });

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
      <AppBar league={app.leagueName} team={app.teamName} onMenuOpen={app.openDrawer} />

      <main style={s.container}>
        <div style={{ ...s.card, borderLeft: `4px solid ${app.competitionTheme.primary}` }}>
          <CompetitionBadge name={app.competitionName} type={app.competitionType} />
          <h1 style={s.title}>Rosa</h1>

          <div style={s.matchday}>
            Giornata: <b>{matchday?.number ?? "—"}</b>
            <span style={s.status}>{matchday?.status ?? "locked"}</span>
          </div>

          {!matchday && (
            <div style={s.warn}>Nessuna giornata aperta per questa competizione.</div>
          )}

          {saved && (
            <div style={s.ok}>Rosa già inviata. Per modifiche serve reset admin.</div>
          )}
        </div>

        <Campo players={players} selected={selected} roles={roles} />

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
                    disabled={saved}
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
            </div>
          ))}

          {!saved && (
            <button
              type="button"
              onClick={save}
              disabled={saving || !matchday}
              style={{
                ...s.btn,
                background: matchday ? app.competitionTheme.primary : "#d1d5db",
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

  const rows = props.roles.map(([role]) => {
    const ids = props.selected[role] ?? [];
    return {
      role,
      players: ids.map((id) => byId.get(id)).filter(Boolean) as Player[],
    };
  });

  const topForRole: Record<string, string> = {
    P: "12%",
    D: "36%",
    C: "60%",
    A: "84%",
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

      {rows.map((row) => {
        const top = topForRole[row.role] ?? "50%";
        const count = Math.max(row.players.length, 1);

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
              const offset = count === 1 ? 0 : (i - (count - 1) / 2) * 88;

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
  matchday: {
    color: "#6b7280",
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  status: {
    borderRadius: 999,
    padding: "3px 9px",
    background: "#f3f4f6",
    fontSize: 11,
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
};
