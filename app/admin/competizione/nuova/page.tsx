"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AppBar from ".../components/AppBar";
import BottomNav from ".../components/BottomNav";
import { useApp } from ".../components/AppContext";

// ─── TIPI ─────────────────────────────────────────────────────────────────────

type CompType = "campionato" | "champions" | "mondiale";

type LeagueMember = {
  user_id: string;
  team_name: string;
};

const COMP_TYPES: { key: CompType; label: string; color: string; iconBg: string }[] = [
  { key: "campionato", label: "Campionato",          color: "#16a34a", iconBg: "#16a34a" },
  { key: "champions",  label: "Champions League",    color: "#1a4fd6", iconBg: "#1a4fd6" },
  { key: "mondiale",   label: "Mondiale / Europeo",  color: "#dc2626", iconBg: "linear-gradient(135deg,#dc2626,#2563eb)" },
];

const SLUG_MAP: Record<CompType, string> = {
  campionato: "serie-a",
  champions: "champions-league",
  mondiale: "mondiale-2026",
};

// ─── COMPONENTE ───────────────────────────────────────────────────────────────

export default function AddCompetitionPage() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamName, role, openDrawer } = useApp();

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<LeagueMember[]>([]);

  const [compType, setCompType] = useState<CompType>("campionato");
  const [compName, setCompName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [totalMatchdays, setTotalMatchdays] = useState(38);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      if (!ready) return;
      if (!userId) return router.replace("/login");
      if (!activeLeagueId) return router.replace("/seleziona-lega");
      if (role !== "admin") return router.replace("/");

      const { data } = await supabase
        .from("league_members")
        .select("user_id, team_name")
        .eq("league_id", activeLeagueId)
        .order("team_name", { ascending: true });

      const list = (data ?? []) as LeagueMember[];
      setMembers(list);

      // Seleziona tutti di default
      setSelectedUsers(new Set(list.map(m => m.user_id)));
      setLoading(false);
    }
    run();
  }, [ready, userId, activeLeagueId, role, router]);

  function toggleUser(uid: string) {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  function selectAll() {
    setSelectedUsers(new Set(members.map(m => m.user_id)));
  }

  function deselectAll() {
    setSelectedUsers(new Set());
  }

  async function create() {
    setErr(null); setMsg(null);
    if (!compName.trim()) return setErr("Inserisci un nome per la competizione.");
    if (selectedUsers.size < 2) return setErr("Seleziona almeno 2 squadre.");
    if (!activeLeagueId) return;

    setSaving(true);

    try {
      // 1) Crea la competition
      const slug = `${SLUG_MAP[compType]}-${Date.now()}`;
      const { data: comp, error: compErr } = await supabase
        .from("competitions")
        .insert({ name: compName.trim(), slug })
        .select("id")
        .single();

      if (compErr) throw compErr;

      // 2) Crea la config
      const defaultRoles = [
        { key: "P", label: "Portiere" },
        { key: "D", label: "Difensore" },
        { key: "C", label: "Centrocampista" },
        { key: "A", label: "Attaccante" },
      ];
      const defaultPlayersPerRole = { P: 1, D: 1, C: 1, A: 1 };

      await supabase.from("competition_config").insert({
        competition_id: comp.id,
        roles: defaultRoles,
        players_per_role: defaultPlayersPerRole,
      });

      // 3) Crea la season
      const { data: season, error: seasonErr } = await supabase
        .from("seasons")
        .insert({
          competition_id: comp.id,
          name: compName.trim(),
          total_matchdays: totalMatchdays,
        })
        .select("id")
        .single();

      if (seasonErr) throw seasonErr;

      // 4) Crea una nuova lega collegata a questa season
      // Oppure aggiorna la lega esistente — dipende dall'architettura
      // Per ora creiamo una entry nella leagues per questa season
      const { data: newLeague, error: leagueErr } = await supabase
        .from("leagues")
        .insert({
          season_id: season.id,
          name: `${leagueName} - ${compName.trim()}`,
        })
        .select("id")
        .single();

      if (leagueErr) throw leagueErr;

      // 5) Aggiungi i membri selezionati
      const memberInserts = Array.from(selectedUsers).map(uid => {
        const member = members.find(m => m.user_id === uid);
        return {
          league_id: newLeague.id,
          user_id: uid,
          team_name: member?.team_name ?? "Squadra",
          role: uid === userId ? "admin" : "player",
        };
      });

      const { error: membErr } = await supabase
        .from("league_members")
        .insert(memberInserts);

      if (membErr) throw membErr;

      setSaving(false);
      setMsg("Competizione creata ✅");
      setTimeout(() => router.push("/seleziona-lega"), 800);

    } catch (e: any) {
      setSaving(false);
      setErr(e?.message || String(e));
    }
  }

  if (!ready || loading) {
    return <main style={{ padding: 20 }}>Caricamento...</main>;
  }

  const activeType = COMP_TYPES.find(t => t.key === compType)!;

  return (
    <>
      <AppBar league={leagueName} team={`${teamName} · ADMIN`} onMenuOpen={openDrawer} />

      <main style={s.container}>
        {/* Header */}
        <div style={s.header}>
          <button onClick={() => router.back()} style={s.backBtn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div style={s.headerTitle}>Aggiungi competizione</div>
        </div>

        {/* Tipologia */}
        <div style={s.section}>
          <div style={s.label}>Tipologia</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {COMP_TYPES.map((t) => {
              const selected = compType === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setCompType(t.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px", borderRadius: 12,
                    border: selected ? `2px solid ${t.color}` : "1px solid #e5e7eb",
                    background: selected ? `${t.color}0D` : "transparent",
                    cursor: "pointer", width: "100%", textAlign: "left",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: t.iconBg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {t.key === "champions" && <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />}
                      {t.key === "mondiale" && <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></>}
                      {t.key === "campionato" && <><path d="M6 9H4a2 2 0 01-2-2V5a2 2 0 012-2h2M18 9h2a2 2 0 002-2V5a2 2 0 00-2-2h-2M9 22h6M12 17v5" /><path d="M6 3v7a6 6 0 006 6 6 6 0 006-6V3" /></>}
                    </svg>
                  </div>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#111827" }}>
                    {t.label}
                  </div>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%",
                    border: `2px solid ${selected ? t.color : "#d1d5db"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {selected && (
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.color }} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Nome */}
        <div style={s.section}>
          <div style={s.label}>Nome competizione</div>
          <input
            value={compName}
            onChange={(e) => setCompName(e.target.value)}
            placeholder="es. Serie A 25/26"
            style={s.input}
          />
        </div>

        {/* Numero giornate */}
        <div style={s.section}>
          <div style={s.label}>Numero giornate</div>
          <input
            type="number"
            value={totalMatchdays}
            onChange={(e) => setTotalMatchdays(parseInt(e.target.value) || 1)}
            min={1}
            style={s.input}
          />
        </div>

        {/* Squadre partecipanti */}
        <div style={s.section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={s.label}>Squadre partecipanti</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={selectAll} style={s.miniBtn}>Tutte</button>
              <button type="button" onClick={deselectAll} style={s.miniBtn}>Nessuna</button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
            Seleziona le squadre che partecipano. ({selectedUsers.size}/{members.length})
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {members.map((m) => {
              const checked = selectedUsers.has(m.user_id);
              return (
                <button
                  key={m.user_id}
                  type="button"
                  onClick={() => toggleUser(m.user_id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 10,
                    border: checked ? "1px solid rgba(22,163,74,0.3)" : "1px solid #e5e7eb",
                    background: checked ? "rgba(22,163,74,0.05)" : "transparent",
                    cursor: "pointer", width: "100%", textAlign: "left",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 4,
                    background: checked ? "#16a34a" : "white",
                    border: checked ? "none" : "1px solid #d1d5db",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {checked && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: checked ? 600 : 400,
                    color: checked ? "#111827" : "#6b7280",
                  }}>
                    {m.team_name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Regole (informativo) */}
        <div style={{
          padding: "12px 14px", borderRadius: 12,
          border: "1px solid #e5e7eb", background: "#f9fafb",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14,2 14,8 20,8" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#6b7280" }}>Regole</span>
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
            Verranno applicate le regole standard FantaChat. La personalizzazione sarà disponibile in futuro.
          </div>
        </div>

        {/* Bottone crea */}
        <button
          onClick={create}
          disabled={saving}
          style={{
            width: "100%", padding: 14,
            background: `linear-gradient(135deg, ${activeType.color}, ${activeType.color}cc)`,
            color: "white", border: "none", borderRadius: 12,
            fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
            boxShadow: `0 4px 14px ${activeType.color}55`,
            fontFamily: "inherit",
          }}
        >
          {saving ? "Creazione..." : "Crea competizione"}
        </button>

        {msg && <div style={s.successMsg}>{msg}</div>}
        {err && <div style={s.errorMsg}>{err}</div>}
      </main>

      <BottomNav />
    </>
  );
}

// ─── STILI ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 520, margin: "0 auto",
    padding: "16px 14px calc(64px + env(safe-area-inset-bottom, 0px) + 20px)",
    display: "flex", flexDirection: "column", gap: 16,
  },
  header: {
    display: "flex", alignItems: "center", gap: 12,
  },
  backBtn: {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: 32, height: 32, borderRadius: 8,
    background: "#f3f4f6", border: "none", cursor: "pointer",
  },
  headerTitle: {
    fontSize: 18, fontWeight: 700, color: "#111827",
  },
  section: {
    display: "flex", flexDirection: "column", gap: 0,
  },
  label: {
    fontSize: 12, fontWeight: 700, color: "#6b7280",
    textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8,
  },
  input: {
    width: "100%", padding: "12px 14px",
    border: "1px solid #e5e7eb", borderRadius: 10,
    fontSize: 14, fontWeight: 600, color: "#111827",
    background: "#f9fafb", fontFamily: "inherit",
    boxSizing: "border-box" as const,
  },
  miniBtn: {
    fontSize: 11, fontWeight: 600, color: "#6b7280",
    background: "#f3f4f6", border: "1px solid #e5e7eb",
    borderRadius: 6, padding: "3px 8px", cursor: "pointer",
    fontFamily: "inherit",
  },
  successMsg: {
    borderRadius: 12, padding: "12px 14px", fontSize: 13, fontWeight: 700,
    background: "#e8f5ee", border: "1px solid #a3d9b8", color: "#1a5c33",
  },
  errorMsg: {
    borderRadius: 12, padding: "12px 14px", fontSize: 13, fontWeight: 700,
    background: "#fff4ea", border: "1px solid #f5c990", color: "#b85c0a",
  },
};