"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { useApp } from "../components/AppContext";
import { THEMES, DEFAULT_THEME } from "../page";
import type { CompetitionTheme } from "../page";
import LoadingScreen from "../components/LoadingScreen";

// ─── TIPI ─────────────────────────────────────────────────────────────────────

type RealPlayer = { id: string; name: string; team: string; competition_id: string };
type Matchday = { id: string; number: number; status: string };
type TopNRow = { rank: number; team: string };
type Fixture = { slot: number; home_team: string; away_team: string };
type FieldKey = "P" | "D" | "C" | "A" | null;

type SavedLineup = {
  gk: { name: string; team: string } | null;
  def: { name: string; team: string } | null;
  mid: { name: string; team: string } | null;
  fwd: { name: string; team: string } | null;
};

// ─── COMPONENTE PRINCIPALE ────────────────────────────────────────────────────

export default function RosaPage() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamName, openDrawer, competitionSlug } = useApp();

  const theme: CompetitionTheme = THEMES[competitionSlug ?? ""] ?? DEFAULT_THEME;

  const [loading, setLoading] = useState(true);
  const [matchday, setMatchday] = useState<Matchday | null>(null);
  const [totalMatchdays, setTotalMatchdays] = useState(38);

  // Giocatori per ruolo
  const [gks, setGks] = useState<RealPlayer[]>([]);
  const [defs, setDefs] = useState<RealPlayer[]>([]);
  const [mids, setMids] = useState<RealPlayer[]>([]);
  const [fwds, setFwds] = useState<RealPlayer[]>([]);

  // Testi input
  const [gkText, setGkText] = useState("");
  const [defText, setDefText] = useState("");
  const [midText, setMidText] = useState("");
  const [fwdText, setFwdText] = useState("");

  // Stato
  const [savedLineup, setSavedLineup] = useState<SavedLineup | null>(null);
  const [openField, setOpenField] = useState<FieldKey>(null);
  const [topN, setTopN] = useState<TopNRow[]>([]);
  const [topNLabel, setTopNLabel] = useState("Top 6");
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Refs per click outside
  const gkRef = useRef<HTMLDivElement>(null);
  const defRef = useRef<HTMLDivElement>(null);
  const midRef = useRef<HTMLDivElement>(null);
  const fwdRef = useRef<HTMLDivElement>(null);

  // Label del giocatore: "Nome (Squadra)"
  const playerLabel = (p: RealPlayer) => p.team ? `${p.name} (${p.team})` : p.name;

  // Mappe label → id
  const gkMap = useMemo(() => new Map(gks.map(p => [playerLabel(p), p.id])), [gks]);
  const defMap = useMemo(() => new Map(defs.map(p => [playerLabel(p), p.id])), [defs]);
  const midMap = useMemo(() => new Map(mids.map(p => [playerLabel(p), p.id])), [mids]);
  const fwdMap = useMemo(() => new Map(fwds.map(p => [playerLabel(p), p.id])), [fwds]);

  // ID selezionati
  const selectedIds = useMemo(() => {
    return [
      gkMap.get(gkText),
      defMap.get(defText),
      midMap.get(midText),
      fwdMap.get(fwdText),
    ].filter(Boolean) as string[];
  }, [gkText, defText, midText, fwdText, gkMap, defMap, midMap, fwdMap]);

  // Filtra scelte disponibili
  function filterChoices(list: RealPlayer[], text: string, currentMap: Map<string, string>) {
    const currentId = currentMap.get(text) || "";
    const q = text.trim().toLowerCase();
    return list.filter(p => {
      const label = playerLabel(p).toLowerCase();
      if (q && !label.includes(q)) return false;
      if (p.id === currentId) return true;
      if (selectedIds.includes(p.id)) return false;
      return true;
    }).slice(0, 30);
  }

  const gkChoices = useMemo(() => filterChoices(gks, gkText, gkMap), [gks, gkText, gkMap, selectedIds]);
  const defChoices = useMemo(() => filterChoices(defs, defText, defMap), [defs, defText, defMap, selectedIds]);
  const midChoices = useMemo(() => filterChoices(mids, midText, midMap), [mids, midText, midMap, selectedIds]);
  const fwdChoices = useMemo(() => filterChoices(fwds, fwdText, fwdMap), [fwds, fwdText, fwdMap, selectedIds]);

  // Click outside chiude dropdown
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const refs = [gkRef.current, defRef.current, midRef.current, fwdRef.current];
      if (!refs.some(ref => ref?.contains(target))) setOpenField(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ─── CARICAMENTO DATI ───────────────────────────────────────────────────────

  useEffect(() => {
    async function run() {
      if (!ready) return;
      if (!userId) return router.replace("/login");
      if (!activeLeagueId) return router.replace("/seleziona-lega");

      setLoading(true);
      setErr(null);

      try {
        // Season dalla lega
        const { data: leagueRow } = await supabase
          .from("leagues")
          .select("season_id, seasons!inner(total_matchdays, competition_id)")
          .eq("id", activeLeagueId)
          .single();

        const seasonId = leagueRow?.season_id;
        const competitionId = (leagueRow as any)?.seasons?.competition_id;
        setTotalMatchdays((leagueRow as any)?.seasons?.total_matchdays ?? 38);

        if (!seasonId) {
          setErr("Nessuna stagione trovata.");
          setLoading(false);
          return;
        }

        // Giornata open
        const { data: md } = await supabase
          .from("matchdays")
          .select("id, number, status")
          .eq("season_id", seasonId)
          .eq("status", "open")
          .order("number", { ascending: false })
          .limit(1)
          .maybeSingle();

        setMatchday(md ?? null);

        if (!md) {
          setErr("Nessuna giornata aperta per questa lega.");
          setLoading(false);
          return;
        }

        // Giocatori per ruolo
        const loadRole = async (role: string) => {
          const { data } = await supabase
            .from("real_players")
            .select("id, name, team, competition_id")
            .eq("role", role)
            .eq("competition_id", competitionId)
            .eq("active", true)
            .order("name", { ascending: true });
          return (data ?? []) as RealPlayer[];
        };

        const [g, d, m, f] = await Promise.all([
          loadRole("P"), loadRole("D"), loadRole("C"), loadRole("A"),
        ]);
        setGks(g); setDefs(d); setMids(m); setFwds(f);

        // Rosa già inviata?
        const { data: existingLineup } = await supabase
          .from("lineups")
          .select(`
            id,
            lineup_players(
              role,
              real_players!inner(name, team)
            )
          `)
          .eq("league_id", activeLeagueId)
          .eq("matchday_id", md.id)
          .eq("user_id", userId)
          .maybeSingle();

        if (existingLineup && (existingLineup as any).lineup_players?.length > 0) {
          const byRole: Record<string, { name: string; team: string }> = {};
          for (const lp of (existingLineup as any).lineup_players) {
            byRole[lp.role] = {
              name: lp.real_players?.name ?? "—",
              team: lp.real_players?.team ?? "",
            };
          }
          setSavedLineup({
            gk: byRole["P"] ?? null,
            def: byRole["D"] ?? null,
            mid: byRole["C"] ?? null,
            fwd: byRole["A"] ?? null,
          });
        }

        // TODO: caricare fixtures e topN quando le tabelle saranno pronte
        // Per ora li lasciamo vuoti, verranno aggiunti dopo

        setLoading(false);
      } catch (e: any) {
        setErr(e?.message || String(e));
        setLoading(false);
      }
    }

    run();
  }, [ready, userId, activeLeagueId, router]);

  // ─── SALVATAGGIO ────────────────────────────────────────────────────────────

  async function save() {
    setErr(null);
    setMsg(null);
    if (!matchday || !activeLeagueId || !userId) return;

    const gkId  = gkMap.get(gkText)  || "";
    const defId = defMap.get(defText) || "";
    const midId = midMap.get(midText) || "";
    const fwdId = fwdMap.get(fwdText) || "";

    if (!gkId || !defId || !midId || !fwdId) {
      setErr("Seleziona tutti e 4 i giocatori dalla lista.");
      return;
    }

    setSaving(true);

    // 1) Crea/trova la lineup
    const { data: lineupRow, error: luErr } = await supabase
      .from("lineups")
      .upsert({
        league_id: activeLeagueId,
        matchday_id: matchday.id,
        user_id: userId,
        submitted_at: new Date().toISOString(),
      }, { onConflict: "league_id,matchday_id,user_id" })
      .select("id")
      .single();

    if (luErr) {
      setSaving(false);
      setErr(luErr.message);
      return;
    }

    // 2) Cancella vecchi giocatori e inserisci nuovi
    await supabase
      .from("lineup_players")
      .delete()
      .eq("lineup_id", lineupRow.id);

    const { error: lpErr } = await supabase
      .from("lineup_players")
      .insert([
        { lineup_id: lineupRow.id, real_player_id: gkId,  role: "P" },
        { lineup_id: lineupRow.id, real_player_id: defId, role: "D" },
        { lineup_id: lineupRow.id, real_player_id: midId, role: "C" },
        { lineup_id: lineupRow.id, real_player_id: fwdId, role: "A" },
      ]);

    setSaving(false);

    if (lpErr) {
      setErr(lpErr.message);
      return;
    }

    setMsg("Rosa inviata ✅");
    // Ricarica la pagina per mostrare lo stato "inviata"
    window.location.reload();
  }

  if (!ready || loading) return <LoadingScreen />;

  // Nomi per il campo da calcio
  const fieldGk  = savedLineup?.gk?.name  ?? (gkText.split("(")[0].trim()  || "");
  const fieldDef = savedLineup?.def?.name ?? (defText.split("(")[0].trim() || "");
  const fieldMid = savedLineup?.mid?.name ?? (midText.split("(")[0].trim() || "");
  const fieldFwd = savedLineup?.fwd?.name ?? (fwdText.split("(")[0].trim() || "");

  // Colori per partite/top N (in Champions: blu, altrimenti arancione)
  const infoAccent = competitionSlug === "champions-league" ? "#1a4fd6" : "#e07b1a";
  const infoBorder = competitionSlug === "champions-league" ? "rgba(26,79,214,0.35)" : "#f5c990";

  return (
    <>
      <AppBar league={leagueName} team={teamName} onMenuOpen={openDrawer} />

      <main style={styles.container}>
        {/* ── CARD PRINCIPALE ── */}
        <div style={{ ...styles.mainCard, borderLeft: `3px solid ${theme.primary}` }}>
          {/* Giornata */}
          <div style={styles.giornataRow}>
            <div>
              <div style={styles.sectionLabel}>Giornata corrente</div>
              <div style={styles.giornataNum}>
                {matchday?.number ?? "—"}
                <span style={styles.giornataTotal}> / {totalMatchdays}</span>
              </div>
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              background: matchday ? theme.pillBg : "#f3f4f6",
              border: `1px solid ${matchday ? theme.pillBorder : "#e5e7eb"}`,
              borderRadius: 50, padding: "4px 10px",
              fontSize: 11, fontWeight: 700,
              color: matchday ? theme.pillColor : "#6b7280",
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: matchday ? theme.pillDot : "#9ca3af",
                display: "inline-block",
              }} />
              {matchday ? "OPEN" : "LOCKED"}
            </div>
          </div>

          {/* ── STATO: INVIATA ── */}
          {savedLineup ? (
            <>
              <div style={styles.title}>Rosa inviata</div>
              <div style={styles.desc}>Non modificabile per questa giornata.</div>
              <div style={{ display: "grid", gap: 10 }}>
                <ReadonlyPlayer role="P" label="Portiere"       name={savedLineup.gk  ? `${savedLineup.gk.name} (${savedLineup.gk.team})`   : "—"} />
                <ReadonlyPlayer role="D" label="Difensore"      name={savedLineup.def ? `${savedLineup.def.name} (${savedLineup.def.team})` : "—"} />
                <ReadonlyPlayer role="C" label="Centrocampista" name={savedLineup.mid ? `${savedLineup.mid.name} (${savedLineup.mid.team})` : "—"} />
                <ReadonlyPlayer role="A" label="Attaccante"     name={savedLineup.fwd ? `${savedLineup.fwd.name} (${savedLineup.fwd.team})` : "—"} />
              </div>
            </>
          ) : (
            <>
              {/* ── STATO: DA COMPILARE ── */}
              <div style={styles.title}>Scegli i 4 giocatori</div>
              <div style={styles.desc}>Tocca il campo, scrivi per cercare e seleziona dalla lista.</div>

              <PlayerPicker
                wrapRef={gkRef} role="P" label="Portiere" roleColor={ROLE_COLORS.P}
                value={gkText} onChange={setGkText}
                onFocus={() => setOpenField("P")} open={openField === "P"}
                choices={gkChoices} playerLabel={playerLabel}
                onSelect={(l) => { setGkText(l); setOpenField(null); }}
              />
              <PlayerPicker
                wrapRef={defRef} role="D" label="Difensore" roleColor={ROLE_COLORS.D}
                value={defText} onChange={setDefText}
                onFocus={() => setOpenField("D")} open={openField === "D"}
                choices={defChoices} playerLabel={playerLabel}
                onSelect={(l) => { setDefText(l); setOpenField(null); }}
              />
              <PlayerPicker
                wrapRef={midRef} role="C" label="Centrocampista" roleColor={ROLE_COLORS.C}
                value={midText} onChange={setMidText}
                onFocus={() => setOpenField("C")} open={openField === "C"}
                choices={midChoices} playerLabel={playerLabel}
                onSelect={(l) => { setMidText(l); setOpenField(null); }}
              />
              <PlayerPicker
                wrapRef={fwdRef} role="A" label="Attaccante" roleColor={ROLE_COLORS.A}
                value={fwdText} onChange={setFwdText}
                onFocus={() => setOpenField("A")} open={openField === "A"}
                choices={fwdChoices} playerLabel={playerLabel}
                onSelect={(l) => { setFwdText(l); setOpenField(null); }}
              />

              <button
                style={{
                  ...styles.submitBtn,
                  background: `linear-gradient(135deg, ${theme.primary}, ${theme.primaryDark})`,
                  boxShadow: `0 4px 14px ${theme.primary}55`,
                }}
                onClick={save}
                disabled={saving}
              >
                {saving ? "Invio..." : "Invia rosa"}
              </button>
            </>
          )}
        </div>

        {/* ── CAMPO DA CALCIO ── */}
        <div style={styles.fieldLabel}>Disposizione in campo</div>
        <CampoDaCalcio gk={fieldGk} def={fieldDef} mid={fieldMid} fwd={fieldFwd} />

        {/* ── PARTITE + TOP N ── */}
        {(fixtures.length > 0 || topN.length > 0) && (
          <div style={styles.infoGrid}>
            {fixtures.length > 0 && (
              <div style={{ ...styles.infoCard, borderColor: infoBorder }}>
                <div style={{ ...styles.infoLabel, color: infoAccent }}>Partite</div>
                <div style={styles.infoList}>
                  {fixtures.map((f) => (
                    <div key={f.slot} style={styles.fixtureRow}>
                      <span style={{ fontWeight: 600 }}>{f.home_team}</span>
                      <span style={{ color: "#9ca3af" }}>-</span>
                      <span>{f.away_team}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {topN.length > 0 && (
              <div style={{ ...styles.infoCard, borderColor: infoBorder }}>
                <div style={{ ...styles.infoLabel, color: infoAccent }}>{topNLabel}</div>
                <div style={styles.infoList}>
                  {topN.map((t) => (
                    <div key={t.rank} style={styles.topNRow}>
                      <span style={{ color: infoAccent, fontWeight: 700, minWidth: 14 }}>{t.rank}</span>
                      <span style={{ fontWeight: 600 }}>{t.team}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Messaggi */}
        {msg && <div style={styles.successMsg}>{msg}</div>}
        {err && <div style={styles.errorMsg}>{err}</div>}
      </main>

      <BottomNav />
    </>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  P: { bg: "#fefce8", color: "#a16207" },
  D: { bg: "#e8f5ee", color: "#1a5c33" },
  C: { bg: "#e6f1fb", color: "#0c447c" },
  A: { bg: "#fcebeb", color: "#a32d2d" },
};

function RoleBadge({ role }: { role: string }) {
  const c = ROLE_COLORS[role] ?? { bg: "#f3f4f6", color: "#6b7280" };
  return (
    <div style={{
      width: 30, height: 30, borderRadius: 8,
      background: c.bg, color: c.color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 13, fontWeight: 700, flexShrink: 0,
    }}>
      {role}
    </div>
  );
}

function ReadonlyPlayer({ role, label, name }: { role: string; label: string; name: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: 12, border: "1px solid #e5e7eb", borderRadius: 12,
    }}>
      <RoleBadge role={role} />
      <div>
        <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginTop: 1 }}>{name}</div>
      </div>
    </div>
  );
}

function PlayerPicker({
  wrapRef, role, label, roleColor, value, onChange, onFocus, open, choices, playerLabel, onSelect,
}: {
  wrapRef: React.RefObject<HTMLDivElement | null>;
  role: string; label: string;
  roleColor: { bg: string; color: string };
  value: string; onChange: (v: string) => void;
  onFocus: () => void; open: boolean;
  choices: RealPlayer[];
  playerLabel: (p: RealPlayer) => string;
  onSelect: (label: string) => void;
}) {
  return (
    <div ref={wrapRef} style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <RoleBadge role={role} />
        <input
          value={value}
          onChange={(e) => { onChange(e.target.value); onFocus(); }}
          onFocus={onFocus}
          placeholder={`Cerca ${label.toLowerCase()}...`}
          autoComplete="off"
          style={{
            flex: 1, padding: "10px 12px",
            border: "1px solid #e5e7eb", borderRadius: 10,
            fontSize: 13, fontWeight: 600, color: "#111827",
            background: "#f9fafb",
            fontFamily: "inherit",
          }}
        />
      </div>

      {open && (
        <div style={{
          marginTop: 8, background: "white",
          border: "1px solid #e5e7eb", borderRadius: 14,
          maxHeight: 260, overflowY: "auto",
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        }}>
          {choices.length === 0 ? (
            <div style={{ padding: 12, color: "#6b7280", fontWeight: 600 }}>
              Nessun giocatore disponibile
            </div>
          ) : (
            choices.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(playerLabel(p))}
                style={{
                  width: "100%", textAlign: "left",
                  padding: "12px 14px", border: "none",
                  background: "white", borderBottom: "1px solid #f1f5f9",
                  fontWeight: 600, fontSize: 13, cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {p.name}
                {p.team && <span style={{ color: "#6b7280", fontWeight: 500 }}> ({p.team})</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function CampoDaCalcio({ gk, def, mid, fwd }: { gk: string; def: string; mid: string; fwd: string }) {
  const positions = [
    { key: "P", label: gk,  roleColor: ROLE_COLORS.P, left: "50%", top: "12%" },
    { key: "D", label: def, roleColor: ROLE_COLORS.D, left: "63%", top: "34%" },
    { key: "C", label: mid, roleColor: ROLE_COLORS.C, left: "37%", top: "60%" },
    { key: "A", label: fwd, roleColor: ROLE_COLORS.A, left: "50%", top: "82%" },
  ];

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "0.62", borderRadius: 16, overflow: "hidden" }}>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 300 484" preserveAspectRatio="xMidYMid slice">
        <rect width="300" height="484" fill="#2d8a4e" />
        <rect x="0" y="0"   width="300" height="48" fill="#2a8249" opacity="0.5" />
        <rect x="0" y="96"  width="300" height="48" fill="#2a8249" opacity="0.5" />
        <rect x="0" y="192" width="300" height="48" fill="#2a8249" opacity="0.5" />
        <rect x="0" y="288" width="300" height="48" fill="#2a8249" opacity="0.5" />
        <rect x="0" y="384" width="300" height="48" fill="#2a8249" opacity="0.5" />
        <rect x="12" y="12" width="276" height="460" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="2" rx="3" />
        <rect x="75" y="12" width="150" height="70" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" />
        <rect x="110" y="12" width="80" height="28" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" />
        <circle cx="150" cy="104" r="3" fill="rgba(255,255,255,0.65)" />
        <path d="M 55 472 A 95 95 0 0 1 245 472" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" />
        <rect x="118" y="4" width="64" height="10" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" />
      </svg>

      {positions.map((pos) =>
        pos.label ? (
          <div key={pos.key} style={{
            position: "absolute", left: pos.left, top: pos.top,
            transform: "translate(-50%, -50%)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 9,
              background: pos.roleColor.bg, color: pos.roleColor.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, fontWeight: 900,
              border: "2px solid rgba(255,255,255,0.6)",
            }}>
              {pos.key}
            </div>
            <div style={{
              background: "rgba(0,0,0,0.65)", color: "white",
              fontSize: 12, fontWeight: 700, borderRadius: 6,
              padding: "3px 9px", whiteSpace: "nowrap",
              maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {pos.label}
            </div>
          </div>
        ) : (
          <div key={pos.key} style={{
            position: "absolute", left: pos.left, top: pos.top,
            transform: "translate(-50%, -50%)",
            width: 38, height: 38, borderRadius: 9,
            border: "2px dashed rgba(255,255,255,0.4)",
          }} />
        )
      )}
    </div>
  );
}

// ─── STILI ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 520, margin: "0 auto",
    padding: "16px 14px calc(64px + env(safe-area-inset-bottom, 0px) + 20px)",
    display: "flex", flexDirection: "column", gap: 14,
  },
  mainCard: {
    background: "#fff", borderRadius: 18, padding: 16,
    border: "1px solid #e5e7eb",
    boxShadow: "0 4px 16px rgba(0,0,0,0.07)",
  },
  giornataRow: {
    display: "flex", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: 600, textTransform: "uppercase",
    letterSpacing: "0.8px", color: "#6b7280", marginBottom: 2,
  },
  giornataNum: { fontSize: 26, fontWeight: 800, color: "#111827", lineHeight: 1 },
  giornataTotal: { fontSize: 16, fontWeight: 700, color: "#9ca3af" },
  title: { fontSize: 17, fontWeight: 800, color: "#111827", marginBottom: 4 },
  desc: { fontSize: 12, color: "#6b7280", fontWeight: 600, marginBottom: 14, lineHeight: 1.4 },
  submitBtn: {
    width: "100%", padding: 14, border: "none",
    borderRadius: 12, color: "white",
    fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 4,
  },
  fieldLabel: {
    fontSize: 11, fontWeight: 700, color: "#6b7280",
    textTransform: "uppercase", letterSpacing: "0.5px",
  },
  infoGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
  },
  infoCard: {
    borderRadius: 14, border: "1.5px solid #f5c990", padding: "13px 14px",
    background: "#fff",
  },
  infoLabel: {
    fontSize: 13, fontWeight: 700, marginBottom: 6,
  },
  infoList: {
    display: "flex", flexDirection: "column", gap: 4, fontSize: 12,
  },
  fixtureRow: {
    display: "flex", gap: 4, color: "#111827",
  },
  topNRow: {
    display: "flex", gap: 6, color: "#111827",
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
