"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppBar from "../../../components/AppBar";
import BottomNav from "../../../components/BottomNav";
import CompetitionBadge from "../../../components/CompetitionBadge";
import { useRequireLeagueAdmin } from "../../../hooks/useRequireApp";
import { supabase } from "../../../../lib/supabaseClient";

type Competition = {
  id: string;
  name: string;
  slug: string;
  type: string;
  description?: string | null;
  rules_summary?: string | null;
  launch_label?: string | null;
  visibility_status?: string | null;
  default_total_matchdays?: number | null;
  default_top_n?: number | null;
  scope?: string | null;
};

type Season = {
  id: string;
  name: string;
  competition_id: string;
  total_matchdays?: number | null;
};

type Member = {
  user_id: string;
  team_name: string;
};

type Step = 1 | 2 | 3 | 4;
type Ruleset = "classico" | "pro";

const ROLE_LABELS: Record<string, string> = {
  P: "Portieri",
  D: "Difensori",
  C: "Centrocampisti",
  A: "Attaccanti",
};

const DEFAULT_ROLES = { P: 1, D: 1, C: 1, A: 1 };

export default function NuovaCompetizione() {
  const app = useRequireLeagueAdmin();
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const [competitionId, setCompetitionId] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [name, setName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [roles, setRoles] = useState<Record<string, number>>(DEFAULT_ROLES);
  const [ruleset, setRuleset] = useState<Ruleset>("classico");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const accent = app.competitionTheme.primary;

  const selectedCompetition = useMemo(
    () => competitions.find((c) => c.id === competitionId) ?? null,
    [competitions, competitionId]
  );

  const grouped = useMemo(() => {
    return {
      campionato: competitions.filter((c) => c.type === "campionato"),
      champions: competitions.filter((c) => c.type === "champions"),
      coppa: competitions.filter((c) => c.type === "coppa"),
    };
  }, [competitions]);

  const totalPlayers = useMemo(
    () => Object.values(roles).reduce((sum, n) => sum + (Number(n) || 0), 0),
    [roles]
  );

  useEffect(() => {
    async function load() {
      if (!app.activeLeagueId) return;

      const { data: comps } = await supabase
        .from("competitions")
        .select("id,name,slug,type,description,rules_summary,launch_label,visibility_status,default_total_matchdays,default_top_n,scope")
        .eq("active", true)
        .order("type", { ascending: true })
        .order("name", { ascending: true });

      const list = (comps ?? []) as Competition[];
      setCompetitions(list);

      const firstAvailable = list.find((c) => c.visibility_status !== "wip");
      setCompetitionId(firstAvailable?.id ?? "");

      const { data: mems } = await supabase
        .from("league_members")
        .select("user_id,team_name")
        .eq("league_id", app.activeLeagueId)
        .order("team_name", { ascending: true });

      const membersList = (mems ?? []) as Member[];
      setMembers(membersList);
      setSelectedUsers(new Set(membersList.map((m) => m.user_id)));
    }

    load();
  }, [app.activeLeagueId]);

  useEffect(() => {
    async function loadSeasons() {
      if (!competitionId) return;

      const { data } = await supabase
        .from("seasons")
        .select("id,name,competition_id,total_matchdays")
        .eq("competition_id", competitionId)
        .eq("active", true)
        .order("created_at", { ascending: false });

      const list = (data ?? []) as Season[];
      setSeasons(list);
      setSeasonId(list[0]?.id ?? "");

      const comp = competitions.find((c) => c.id === competitionId);
      setName(list[0]?.name ?? comp?.name ?? "");
    }

    loadSeasons();
  }, [competitionId, competitions]);

  function toggleUser(userId: string) {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function setRoleCount(role: string, value: number) {
    setRoles((prev) => ({
      ...prev,
      [role]: Math.max(0, Math.min(5, Number(value) || 0)),
    }));
  }

  function renderCompetitionCard(c: Competition) {
    const disabled = c.visibility_status === "wip";
    const active = c.id === competitionId;

    return (
      <button
        key={c.id}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setCompetitionId(c.id);
          setStep(2);
        }}
        style={{
          ...s.compCard,
          borderColor: active ? accent : "#e5e7eb",
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <div>
          <CompetitionBadge name={c.name} type={c.type} />
          <div style={s.compName}>{c.name}</div>
          <div style={s.compDesc}>
            {disabled ? "Working progress" : c.description ?? "Competizione disponibile"}
          </div>
        </div>

        <div style={s.compMeta}>
          <span>{c.default_total_matchdays ?? "—"} giornate</span>
          <span>Top {c.default_top_n ?? 6}</span>
        </div>
      </button>
    );
  }

  async function create() {
    setErr(null);

    if (!app.activeLeagueId) return setErr("Nessuna lega attiva.");
    if (!competitionId) return setErr("Seleziona una competizione.");
    if (!seasonId) return setErr("Seleziona una stagione.");
    if (selectedUsers.size < 1) return setErr("Seleziona almeno un partecipante.");
    if (totalPlayers < 1) return setErr("Seleziona almeno un giocatore da schierare.");

    setBusy(true);

    const { data, error } = await supabase.rpc("create_league_competition", {
      p_league_id: app.activeLeagueId,
      p_competition_id: competitionId,
      p_season_id: seasonId,
      p_name: name.trim() || selectedCompetition?.name || "Competizione",
      p_participant_user_ids: Array.from(selectedUsers),
      p_players_per_role: roles,
    });

    if (error) { setBusy(false); return setErr(error.message); }

    const id = (data as any)?.league_competition_id ?? data;

    if (id) {
      // imposta il tipo di punteggio scelto (Classico/Pro)
      try {
        await supabase.rpc("set_scoring_ruleset", {
          p_league_competition_id: String(id),
          p_ruleset: ruleset,
        });
      } catch {}
      await app.setActiveCompetition(String(id));
    }

    setBusy(false);
    window.location.href = "/";
  }

  return (
    <>
      <AppBar
        league={app.leagueName}
        team={`${app.teamName} · ADMIN`}
        onMenuOpen={app.openDrawer}
      />

      <main style={s.container}>
        <div style={s.header}>
          <button type="button" onClick={() => router.back()} style={s.backBtn}>
            ←
          </button>
          <div>
            <h1 style={s.title}>Aggiungi competizione</h1>
            <p style={s.subtitle}>
              Scegli dal catalogo FantaChat. Le Coppe sono gestite dal superadmin.
            </p>
          </div>
        </div>

        {err && <div style={s.err}>{err}</div>}

        {step === 1 && (
          <div style={s.stack}>
            <Section title="Campionato">
              {grouped.campionato.map(renderCompetitionCard)}
            </Section>

            <Section title="Champions">
              {grouped.champions.map(renderCompetitionCard)}
            </Section>

            <Section title="Coppe">
              {grouped.coppa.map(renderCompetitionCard)}
            </Section>
          </div>
        )}

        {step === 2 && selectedCompetition && (
          <div style={s.card}>
            <CompetitionBadge name={selectedCompetition.name} type={selectedCompetition.type} />
            <h2 style={s.cardTitle}>Regole della competizione</h2>

            <p style={s.text}>
              {selectedCompetition.rules_summary ??
                "I dati globali, le partite, i voti e le Top X sono gestiti dal superadmin. L’admin della lega sceglie partecipanti e composizione della rosa."}
            </p>

            <div style={s.ruleGrid}>
              <Info label="Tipo" value={selectedCompetition.type === "coppa" ? "Coppe" : selectedCompetition.type} />
              <Info label="Giornate" value={String(selectedCompetition.default_total_matchdays ?? "—")} />
              <Info label="Top X" value={`Top ${selectedCompetition.default_top_n ?? 6}`} />
              <Info label="Ambito" value={selectedCompetition.scope === "nazionali" ? "Nazionali" : "Club"} />
            </div>

            <div>
              <div style={s.typeLabel}>Tipo di punteggio</div>
              <div style={s.typeRow}>
                <button
                  type="button"
                  onClick={() => setRuleset("classico")}
                  style={{ ...s.typeCard, ...(ruleset === "classico" ? { borderColor: accent, background: `${accent}0d` } : {}) }}
                >
                  <div style={s.typeName}>Classico</div>
                  <div style={s.typeDesc}>Bonus/malus standard: gol, assist, cartellini, rigori, clean sheet.</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRuleset("pro")}
                  style={{ ...s.typeCard, ...(ruleset === "pro" ? { borderColor: accent, background: `${accent}0d` } : {}) }}
                >
                  <div style={s.typeName}>Pro <span style={s.proTag}>PRO</span></div>
                  <div style={s.typeDesc}>Tutto il Classico più statistiche avanzate (xG, xA).</div>
                </button>
              </div>
            </div>

            <select value={seasonId} onChange={(e) => setSeasonId(e.target.value)} style={s.input}>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome competizione nella lega"
              style={s.input}
            />

            <div style={s.actions}>
              <button type="button" onClick={() => setStep(1)} style={s.secondaryBtn}>
                Indietro
              </button>
              <button type="button" onClick={() => setStep(3)} style={s.primaryBtn}>
                Continua
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={s.card}>
            <h2 style={s.cardTitle}>Partecipanti</h2>
            <p style={s.text}>
              Scegli quali squadre della lega parteciperanno a questa competizione.
            </p>

            <div style={s.memberList}>
              {members.map((m) => {
                const checked = selectedUsers.has(m.user_id);

                return (
                  <button
                    type="button"
                    key={m.user_id}
                    onClick={() => toggleUser(m.user_id)}
                    style={{
                      ...s.memberRow,
                      borderColor: checked ? "#16a34a" : "#e5e7eb",
                      background: checked ? "#f0fdf4" : "white",
                    }}
                  >
                    <span style={checked ? s.check : s.emptyCheck}>
                      {checked ? "✓" : ""}
                    </span>
                    <span>{m.team_name}</span>
                  </button>
                );
              })}
            </div>

            <div style={s.actions}>
              <button type="button" onClick={() => setStep(2)} style={s.secondaryBtn}>
                Indietro
              </button>
              <button type="button" onClick={() => setStep(4)} style={s.primaryBtn}>
                Continua
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={s.card}>
            <h2 style={s.cardTitle}>Formazione</h2>
            <p style={s.text}>
              Scegli quanti giocatori schierare e quali ruoli. La Rosa si adatterà automaticamente.
            </p>

            <div style={s.rolesGrid}>
              {Object.entries(ROLE_LABELS).map(([role, label]) => (
                <label key={role} style={s.roleRow}>
                  <span>{label}</span>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={roles[role] ?? 0}
                    onChange={(e) => setRoleCount(role, Number(e.target.value))}
                    style={s.roleInput}
                  />
                </label>
              ))}
            </div>

            <div style={s.totalPlayers}>
              Totale giocatori da schierare: <b>{totalPlayers}</b>
            </div>

            <div style={s.summaryType}>
              Punteggio: <b>{ruleset === "pro" ? "Pro (con xG / xA)" : "Classico"}</b>
            </div>

            <div style={s.actions}>
              <button type="button" onClick={() => setStep(3)} style={s.secondaryBtn}>
                Indietro
              </button>
              <button type="button" onClick={create} disabled={busy} style={s.primaryBtn}>
                {busy ? "Creazione..." : "Crea competizione"}
              </button>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <section style={s.section}>
      <h2 style={s.sectionTitle}>{props.title}</h2>
      <div style={s.stack}>{props.children}</div>
    </section>
  );
}

function Info(props: { label: string; value: string }) {
  return (
    <div style={s.infoBox}>
      <small>{props.label}</small>
      <b>{props.value}</b>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 520, margin: "0 auto", padding: "16px 14px 100px", display: "grid", gap: 14 },
  header: { display: "grid", gridTemplateColumns: "38px 1fr", gap: 12, alignItems: "start" },
  backBtn: { width: 34, height: 34, borderRadius: 10, border: "1px solid #e5e7eb", background: "white", fontWeight: 900, cursor: "pointer" },
  title: { margin: 0, fontSize: 24, fontWeight: 1000, color: "#111827" },
  subtitle: { margin: "5px 0 0", color: "#6b7280", fontWeight: 700, lineHeight: 1.35 },
  stack: { display: "grid", gap: 10 },
  section: { display: "grid", gap: 8 },
  sectionTitle: { margin: "8px 2px 2px", fontSize: 13, fontWeight: 1000, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.7px" },
  compCard: { display: "grid", gap: 10, width: "100%", textAlign: "left", padding: 15, borderRadius: 18, border: "1px solid #e5e7eb", background: "white", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(15,23,42,0.06)" },
  compName: { marginTop: 10, fontSize: 18, fontWeight: 1000, color: "#111827" },
  compDesc: { marginTop: 4, color: "#6b7280", fontSize: 13, fontWeight: 700, lineHeight: 1.4 },
  compMeta: { display: "flex", gap: 8, flexWrap: "wrap", color: "#374151", fontSize: 12, fontWeight: 900 },
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: 16, display: "grid", gap: 12, boxShadow: "0 4px 16px rgba(15,23,42,0.06)" },
  cardTitle: { margin: "4px 0 0", color: "#111827", fontSize: 22, fontWeight: 1000 },
  text: { margin: 0, color: "#6b7280", fontWeight: 700, lineHeight: 1.5, fontSize: 14 },
  ruleGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  infoBox: { background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 14, padding: 11, display: "grid", gap: 3 },
  typeLabel: { fontSize: 13, fontWeight: 1000, color: "#374151", marginBottom: 6 },
  typeRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  typeCard: { textAlign: "left", border: "1.5px solid #e5e7eb", background: "white", borderRadius: 14, padding: 12, cursor: "pointer", fontFamily: "inherit" },
  typeName: { fontWeight: 1000, color: "#111827", fontSize: 14, display: "flex", alignItems: "center", gap: 6 },
  typeDesc: { fontSize: 11.5, color: "#6b7280", fontWeight: 700, marginTop: 4, lineHeight: 1.35 },
  proTag: { fontSize: 9, fontWeight: 1000, color: "white", background: "#e07b1a", borderRadius: 6, padding: "1px 5px" },
  input: { padding: 13, borderRadius: 13, border: "1px solid #e5e7eb", fontWeight: 800, fontFamily: "inherit" },
  memberList: { display: "grid", gap: 8 },
  memberRow: { display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, border: "1px solid #e5e7eb", background: "white", fontFamily: "inherit", fontWeight: 800, textAlign: "left" },
  check: { width: 22, height: 22, borderRadius: 7, background: "#16a34a", color: "white", display: "grid", placeItems: "center", fontWeight: 1000 },
  emptyCheck: { width: 22, height: 22, borderRadius: 7, border: "1px solid #d1d5db", display: "inline-block" },
  rolesGrid: { display: "grid", gap: 9 },
  roleRow: { display: "grid", gridTemplateColumns: "1fr 86px", alignItems: "center", gap: 10, fontWeight: 900, color: "#111827" },
  roleInput: { padding: 11, borderRadius: 12, border: "1px solid #e5e7eb", fontWeight: 900, textAlign: "center" },
  totalPlayers: { background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", borderRadius: 14, padding: 12, fontWeight: 900 },
  summaryType: { background: "#f9fafb", border: "1px solid #e5e7eb", color: "#374151", borderRadius: 14, padding: 12, fontWeight: 800, fontSize: 13 },
  actions: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  primaryBtn: { padding: 14, border: "none", borderRadius: 13, background: "#16a34a", color: "white", fontWeight: 1000, fontFamily: "inherit", cursor: "pointer" },
  secondaryBtn: { padding: 14, border: "1px solid #e5e7eb", borderRadius: 13, background: "white", color: "#374151", fontWeight: 1000, fontFamily: "inherit", cursor: "pointer" },
  err: { background: "#fff3e4", border: "1px solid #f4c99d", color: "#b85c0a", padding: 12, borderRadius: 14, fontWeight: 900 },
};
