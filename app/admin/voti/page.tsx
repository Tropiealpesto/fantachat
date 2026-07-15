"use client";

import { useEffect, useState } from "react";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import CompetitionBadge from "../../components/CompetitionBadge";
import { useRequireLeagueAdmin } from "../../hooks/useRequireApp";
import { supabase } from "../../../lib/supabaseClient";
import { signedFmt } from "../../../lib/rpc";

type Row = {
  player_id: string;
  player_name: string;
  role: string;
  team_name: string | null;
  picked_count: number;
  points: number | null;
};

const ROLE_META: Record<string, { bg: string; fg: string }> = {
  P: { bg: "#FEF3C7", fg: "#B45309" },
  D: { bg: "#DCFCE7", fg: "#15803D" },
  C: { bg: "#DBEAFE", fg: "#2563EB" },
  A: { bg: "#FEE2E2", fg: "#DC2626" },
};

export default function AdminVoti() {
  const app = useRequireLeagueAdmin();
  const [rows, setRows] = useState<Row[]>([]);
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!app.activeLeagueCompetitionId) return;

    let off = false;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_admin_picked_players", {
        p_league_competition_id: app.activeLeagueCompetitionId,
      });

      if (off) return;
      if (error) setErr(error.message);

      const list = (data ?? []) as Row[];
      setRows(list);
      const init: Record<string, string> = {};
      list.forEach((r) => {
        init[r.player_id] = r.points != null ? String(r.points) : "";
      });
      setVotes(init);
      setLoading(false);
    }

    load();

    return () => {
      off = true;
    };
  }, [app.activeLeagueCompetitionId]);

  async function save() {
    setMsg(null);
    setErr(null);
    setSaving(true);

    const items = Object.entries(votes)
      .filter(([, v]) => v.trim())
      .map(([real_player_id, v]) => ({
        real_player_id,
        points: Number(v.replace(",", ".")),
      }));

    const { error } = await supabase.rpc("admin_upsert_manual_scores", {
      p_league_competition_id: app.activeLeagueCompetitionId,
      p_items: items,
    });

    setSaving(false);
    if (error) return setErr(error.message);
    setMsg("Voti salvati e classifica aggiornata");
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
          <h1 style={s.title}>Voti competizione</h1>
          <p style={s.subtitle}>
            Correggi manualmente solo i giocatori schierati nella lega.
          </p>
        </section>

        <section style={s.toolbar}>
          <div>
            <span style={s.kicker}>Giocatori</span>
            <strong style={s.count}>{rows.length}</strong>
          </div>
          <button type="button" onClick={save} disabled={saving} style={s.primaryBtn}>
            {saving ? "Salvataggio..." : "Salva voti"}
          </button>
        </section>

        {msg && <div style={s.ok}>{msg}</div>}
        {err && <div style={s.err}>{err}</div>}

        <section style={s.list}>
          {loading ? (
            <div style={s.empty}>Caricamento voti...</div>
          ) : rows.length === 0 ? (
            <div style={s.empty}>Nessun giocatore schierato da correggere.</div>
          ) : (
            rows.map((r) => {
              const role = ROLE_META[r.role] ?? { bg: "#f1f5f9", fg: "#475569" };
              return (
                <article key={r.player_id} style={s.row}>
                  <span style={{ ...s.role, background: role.bg, color: role.fg }}>
                    {r.role}
                  </span>
                  <div style={s.player}>
                    <b>{r.player_name}</b>
                    <small>
                      {r.team_name ?? "Senza squadra"} · scelto x{r.picked_count} · attuale {signedFmt(r.points)}
                    </small>
                  </div>
                  <input
                    inputMode="decimal"
                    value={votes[r.player_id] ?? ""}
                    onChange={(e) =>
                      setVotes((p) => ({ ...p, [r.player_id]: e.target.value }))
                    }
                    style={s.vote}
                  />
                </article>
              );
            })
          )}
        </section>
      </main>

      <BottomNav />
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 520, margin: "0 auto", padding: "12px 14px calc(72px + env(safe-area-inset-bottom, 0px) + 18px)", display: "grid", gap: 10 },
  hero: { background: "white", border: "1px solid rgba(226,232,240,.92)", borderRadius: 12, padding: 14, boxShadow: "0 3px 12px rgba(15,23,42,.035)" },
  title: { margin: "12px 0 3px", color: "#0f172a", fontSize: 22, lineHeight: 1.05, fontWeight: 900, letterSpacing: "-0.025em" },
  subtitle: { margin: 0, color: "#64748b", fontSize: 12.5, lineHeight: 1.35, fontWeight: 750 },
  toolbar: { background: "white", border: "1px solid rgba(226,232,240,.92)", borderRadius: 12, padding: 12, display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 10, boxShadow: "0 3px 12px rgba(15,23,42,.035)" },
  kicker: { display: "block", color: "#64748b", fontSize: 10.5, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".02em" },
  count: { color: "#0f172a", fontSize: 20, fontWeight: 900 },
  primaryBtn: { border: 0, borderRadius: 10, background: "#16a34a", color: "white", padding: "10px 14px", fontWeight: 900, fontFamily: "inherit", cursor: "pointer" },
  list: { display: "grid", gap: 7 },
  row: { background: "white", border: "1px solid rgba(226,232,240,.92)", borderRadius: 11, padding: 10, display: "grid", gridTemplateColumns: "28px 1fr 76px", gap: 9, alignItems: "center", boxShadow: "0 2px 10px rgba(15,23,42,.03)" },
  role: { width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 900, border: "1px solid rgba(255,255,255,.8)" },
  player: { display: "grid", gap: 2, minWidth: 0 },
  vote: { width: "100%", padding: "9px 8px", borderRadius: 9, border: "1px solid #e5e7eb", textAlign: "center", fontWeight: 900, outline: "none" },
  empty: { background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, color: "#64748b", fontWeight: 800 },
  ok: { background: "#f0fdf4", border: "1px solid #86efac", color: "#15803d", borderRadius: 10, padding: 10, fontWeight: 850, fontSize: 13 },
  err: { background: "#fff3e4", border: "1px solid #f4c99d", color: "#b85c0a", borderRadius: 10, padding: 10, fontWeight: 850, fontSize: 13 },
};
