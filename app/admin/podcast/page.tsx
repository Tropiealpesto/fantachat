"use client";

import { useEffect, useMemo, useState } from "react";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import CompetitionBadge from "../../components/CompetitionBadge";
import { useRequireLeagueAdmin } from "../../hooks/useRequireApp";
import { supabase } from "../../../lib/supabaseClient";
import { rpcJson, fmt, signedFmt } from "../../../lib/rpc";

type Matchday = { id: string; number: number; status: string };
type Player = { role: string; name: string; team: string | null; points: number | null };
type Row = { user_id: string; team_name: string; total_score: number; rank: number; players: Player[] };
type Detail = { matchday_number: number | null; rows: Row[] };

const EMPTY_DETAIL: Detail = { matchday_number: null, rows: [] };

function pLabel(p: Player) {
  return p.role === "P" ? p.team || p.name : p.name;
}

function buildPrompt(detail: Detail, comp: string): string {
  if (!detail.rows.length) return "";
  const standings = detail.rows
    .map((r) => `${r.rank}. ${r.team_name} - ${fmt(r.total_score)} punti`)
    .join("\n");
  const all = detail.rows.flatMap((r) =>
    (r.players ?? [])
      .filter((p) => p.points != null)
      .map((p) => ({ ...p, owner: r.team_name }))
  );
  const sorted = [...all].sort((a, b) => Number(b.points) - Number(a.points));
  const top =
    sorted
      .slice(0, 3)
      .map(
        (p) =>
          `- ${pLabel(p)} (${p.role}${p.team ? ", " + p.team : ""}): ${signedFmt(
            Number(p.points)
          )} punti, schierato da ${p.owner}`
      )
      .join("\n") || "- nessuno";
  const flop = sorted.length ? sorted[sorted.length - 1] : null;
  const flopLine = flop
    ? `- ${pLabel(flop)} (${flop.role}${flop.team ? ", " + flop.team : ""}): ${signedFmt(
        Number(flop.points)
      )} punti, schierato da ${flop.owner}`
    : "- nessuno";

  return `Sei "Nyx", la voce narrante ufficiale della lega di fantacalcio (competizione: ${comp}).
Scrivi il copione di un mini-podcast che racconta la Giornata ${detail.matchday_number}.

Stile: elegante ma simpatico, scrittura curata e calzante, con ironia leggera e affetto per i partecipanti. In italiano.
Lunghezza: circa 1 minuto di lettura (150-180 parole). Testo scorrevole da leggere ad alta voce, senza elenchi puntati.
Apri con un saluto di Nyx e chiudi con una frase a effetto.
Usa SOLO i dati qui sotto, non inventare numeri o nomi.

CLASSIFICA DELLA GIORNATA:
${standings}

MIGLIORI DELLA GIORNATA:
${top}

PEGGIORE DELLA GIORNATA:
${flopLine}

Scrivi solo il copione del podcast, senza titolo e senza note.`;
}

export default function AdminPodcast() {
  const app = useRequireLeagueAdmin();
  const [matchdays, setMatchdays] = useState<Matchday[]>([]);
  const [matchdayId, setMatchdayId] = useState("");
  const [detail, setDetail] = useState<Detail>(EMPTY_DETAIL);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!app.seasonId) return;
    supabase
      .from("matchdays")
      .select("id,number,status")
      .eq("season_id", app.seasonId)
      .order("number", { ascending: false })
      .then(({ data }) => {
        const list = (data ?? []) as Matchday[];
        setMatchdays(list);
        setMatchdayId(list[0]?.id ?? "");
      });
  }, [app.seasonId]);

  useEffect(() => {
    if (!matchdayId) return;
    rpcJson<Detail>("get_matchday_detail", { p_matchday_id: matchdayId }, EMPTY_DETAIL).then(setDetail);
  }, [matchdayId]);

  const promptDetail = matchdayId ? detail : EMPTY_DETAIL;
  const prompt = useMemo(
    () => buildPrompt(promptDetail, app.competitionName ?? "Competizione"),
    [promptDetail, app.competitionName]
  );

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setErr("Copia non riuscita: seleziona il testo a mano.");
    }
  }

  async function save() {
    setErr(null);
    setMsg(null);
    if (!title.trim() || !text.trim()) return setErr("Inserisci titolo e testo.");

    setSaving(true);
    const { error } = await supabase.rpc("create_nyx_content", {
      p_league_id: app.activeLeagueId,
      p_league_competition_id: app.activeLeagueCompetitionId,
      p_matchday_id: matchdayId || null,
      p_title: title.trim(),
      p_text: text.trim(),
      p_audio_url: null,
    });
    setSaving(false);

    if (error) return setErr(error.message);
    setMsg("Puntata Nyx salvata");
    setTitle("");
    setText("");
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
          <h1 style={s.title}>Nyx / Podcast</h1>
          <p style={s.subtitle}>
            Prepara il racconto della giornata e salvalo nella lega.
          </p>
        </section>

        <section style={s.card}>
          <Step n="1" title="Giornata" />
          <select
            value={matchdayId}
            onChange={(e) => {
              setDetail(EMPTY_DETAIL);
              setMatchdayId(e.target.value);
            }}
            style={s.input}
          >
            <option value="">Nessuna giornata</option>
            {matchdays.map((m) => (
              <option key={m.id} value={m.id}>
                Giornata {m.number} ({m.status})
              </option>
            ))}
          </select>
        </section>

        <section style={s.card}>
          <Step n="2" title="Prompt per l'AI" />
          {prompt ? (
            <>
              <textarea
                readOnly
                value={prompt}
                style={{ ...s.input, ...s.prompt }}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                type="button"
                onClick={copyPrompt}
                style={{ ...s.darkBtn, background: copied ? "#15803d" : "#0f172a" }}
              >
                {copied ? "Copiato" : "Copia prompt"}
              </button>
              <p style={s.hint}>
                Incollalo nell'AI, copia la risposta e mettila nel blocco sotto.
              </p>
            </>
          ) : (
            <div style={s.warn}>
              Scegli una giornata calcolata per generare il prompt.
            </div>
          )}
        </section>

        <section style={s.card}>
          <Step n="3" title="Testo puntata" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titolo della puntata"
            style={s.input}
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Incolla qui il testo generato"
            style={{ ...s.input, minHeight: 180 }}
          />
          <button type="button" onClick={save} disabled={saving} style={s.primaryBtn}>
            {saving ? "Salvataggio..." : "Salva puntata"}
          </button>
          {msg && <div style={s.ok}>{msg}</div>}
          {err && <div style={s.err}>{err}</div>}
        </section>
      </main>

      <BottomNav />
    </>
  );
}

function Step(props: { n: string; title: string }) {
  return (
    <div style={s.step}>
      <span style={s.stepNo}>{props.n}</span>
      <h2 style={s.stepTitle}>{props.title}</h2>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 520, margin: "0 auto", padding: "12px 14px calc(72px + env(safe-area-inset-bottom, 0px) + 18px)", display: "grid", gap: 10 },
  hero: { background: "white", border: "1px solid rgba(226,232,240,.92)", borderRadius: 12, padding: 14, boxShadow: "0 3px 12px rgba(15,23,42,.035)" },
  title: { margin: "12px 0 3px", color: "#0f172a", fontSize: 22, lineHeight: 1.05, fontWeight: 900, letterSpacing: "-0.025em" },
  subtitle: { margin: 0, color: "#64748b", fontSize: 12.5, lineHeight: 1.35, fontWeight: 750 },
  card: { background: "white", border: "1px solid rgba(226,232,240,.92)", borderRadius: 12, padding: 14, display: "grid", gap: 10, boxShadow: "0 3px 12px rgba(15,23,42,.035)" },
  step: { display: "flex", alignItems: "center", gap: 8 },
  stepNo: { width: 24, height: 24, borderRadius: 8, display: "grid", placeItems: "center", background: "#eef7f0", color: "#15803d", fontSize: 12, fontWeight: 900 },
  stepTitle: { margin: 0, color: "#0f172a", fontSize: 15, fontWeight: 900 },
  input: { width: "100%", padding: 12, borderRadius: 10, border: "1px solid #e5e7eb", color: "#0f172a", fontWeight: 750, fontFamily: "inherit", fontSize: 13.5, outline: "none" },
  prompt: { minHeight: 190, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11.5, lineHeight: 1.45, background: "#f8fafc", color: "#334155", whiteSpace: "pre-wrap" },
  darkBtn: { padding: 12, border: 0, borderRadius: 10, color: "white", fontWeight: 900, fontFamily: "inherit", cursor: "pointer" },
  primaryBtn: { padding: 12, border: 0, borderRadius: 10, background: "#16a34a", color: "white", fontWeight: 900, fontFamily: "inherit", cursor: "pointer" },
  hint: { margin: 0, fontSize: 11.5, color: "#64748b", fontWeight: 750 },
  warn: { background: "#fff3e4", border: "1px solid #f4c99d", color: "#b85c0a", borderRadius: 10, padding: 10, fontWeight: 850, fontSize: 13 },
  ok: { background: "#f0fdf4", border: "1px solid #86efac", color: "#15803d", borderRadius: 10, padding: 10, fontWeight: 850, fontSize: 13 },
  err: { background: "#fff3e4", border: "1px solid #f4c99d", color: "#b85c0a", borderRadius: 10, padding: 10, fontWeight: 850, fontSize: 13 },
};
