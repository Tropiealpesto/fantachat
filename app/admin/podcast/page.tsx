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

function pLabel(p: Player) { return p.role === "P" ? (p.team || p.name) : p.name; }

function buildPrompt(detail: Detail, comp: string): string {
  if (!detail.rows.length) return "";
  const standings = detail.rows.map((r) => `${r.rank}. ${r.team_name} — ${fmt(r.total_score)} punti`).join("\n");
  const all = detail.rows.flatMap((r) => (r.players ?? []).filter((p) => p.points != null).map((p) => ({ ...p, owner: r.team_name })));
  const sorted = [...all].sort((a, b) => Number(b.points) - Number(a.points));
  const top = sorted.slice(0, 3).map((p) => `- ${pLabel(p)} (${p.role}${p.team ? ", " + p.team : ""}): ${signedFmt(Number(p.points))} punti, schierato da ${p.owner}`).join("\n") || "- nessuno";
  const flop = sorted.length ? sorted[sorted.length - 1] : null;
  const flopLine = flop ? `- ${pLabel(flop)} (${flop.role}${flop.team ? ", " + flop.team : ""}): ${signedFmt(Number(flop.points))} punti, schierato da ${flop.owner}` : "- nessuno";

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
  const [detail, setDetail] = useState<Detail>({ matchday_number: null, rows: [] });
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!app.seasonId) return;
    supabase.from("matchdays").select("id,number,status").eq("season_id", app.seasonId).order("number", { ascending: false })
      .then(({ data }) => { const list = (data ?? []) as Matchday[]; setMatchdays(list); setMatchdayId(list[0]?.id ?? ""); });
  }, [app.seasonId]);

  useEffect(() => {
    if (!matchdayId) { setDetail({ matchday_number: null, rows: [] }); return; }
    rpcJson<Detail>("get_matchday_detail", { p_matchday_id: matchdayId }, { matchday_number: null, rows: [] }).then(setDetail);
  }, [matchdayId]);

  const prompt = useMemo(() => buildPrompt(detail, app.competitionName ?? "Competizione"), [detail, app.competitionName]);

  async function copyPrompt() {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { setErr("Copia non riuscita: seleziona il testo a mano."); }
  }

  async function save() {
    setErr(null); setMsg(null);
    if (!title.trim() || !text.trim()) return setErr("Inserisci titolo e testo.");
    const { error } = await supabase.rpc("create_nyx_content", {
      p_league_id: app.activeLeagueId,
      p_league_competition_id: app.activeLeagueCompetitionId,
      p_matchday_id: matchdayId || null,
      p_title: title.trim(),
      p_text: text.trim(),
      p_audio_url: null,
    });
    if (error) return setErr(error.message);
    setMsg("Puntata Nyx salvata ✅");
    setTitle(""); setText("");
  }

  return (
    <>
      <AppBar league={app.leagueName} team={`${app.teamName} · ADMIN`} onMenuOpen={app.openDrawer} />
      <main style={s.container}>
        <div style={s.card}>
          <CompetitionBadge name={app.competitionName} type={app.competitionType} />
          <h1 style={s.h1}>Nyx / Podcast</h1>
          <p style={s.sub}>Genera il prompt, fallo scrivere a un'AI, incolla qui il risultato e salva.</p>

          <label style={s.lbl}>1 · Scegli la giornata</label>
          <select value={matchdayId} onChange={(e) => setMatchdayId(e.target.value)} style={s.input}>
            <option value="">Nessuna giornata</option>
            {matchdays.map((m) => (<option key={m.id} value={m.id}>Giornata {m.number} ({m.status})</option>))}
          </select>

          <label style={s.lbl}>2 · Prompt per l'AI</label>
          {prompt ? (
            <>
              <textarea readOnly value={prompt} style={{ ...s.input, ...s.prompt }} onFocus={(e) => e.currentTarget.select()} />
              <button onClick={copyPrompt} style={{ ...s.copy, background: copied ? "#15803d" : "#0f172a" }}>{copied ? "Copiato ✓" : "Copia prompt"}</button>
              <p style={s.hint}>Incollalo in ChatGPT/Claude/Gemini, copia la risposta e mettila qui sotto.</p>
            </>
          ) : (
            <div style={s.warn}>Scegli una giornata <b>già calcolata</b> per generare il prompt.</div>
          )}

          <label style={s.lbl}>3 · Testo del podcast (dall'AI)</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titolo della puntata" style={s.input} />
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Incolla qui il testo generato dall'AI" style={{ ...s.input, minHeight: 220 }} />
          <button onClick={save} style={s.btn}>Salva puntata</button>
          {msg && <div style={s.ok}>{msg}</div>}
          {err && <div style={s.err}>{err}</div>}
        </div>
      </main>
      <BottomNav />
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 520, margin: "0 auto", padding: "16px 14px 100px" },
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: 16, display: "grid", gap: 9, boxShadow: "0 4px 16px rgba(15,23,42,.06)" },
  h1: { fontSize: 21, fontWeight: 1000, color: "#0f172a", margin: "8px 0 1px" },
  sub: { fontSize: 12.5, color: "#64748b", fontWeight: 700, margin: "0 0 6px" },
  lbl: { fontSize: 11, fontWeight: 1000, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".05em", marginTop: 8 },
  input: { padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", fontWeight: 700, fontFamily: "inherit", fontSize: 14, outline: "none", width: "100%" },
  prompt: { minHeight: 200, fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12, fontWeight: 600, background: "#f8fafc", color: "#334155", whiteSpace: "pre-wrap" },
  copy: { padding: 12, border: 0, borderRadius: 12, color: "white", fontWeight: 1000, fontFamily: "inherit", cursor: "pointer" },
  hint: { fontSize: 11.5, color: "#64748b", fontWeight: 700, margin: "2px 0 0" },
  warn: { background: "#fff3e4", border: "1px solid #f4c99d", color: "#b85c0a", borderRadius: 12, padding: 12, fontWeight: 800, fontSize: 13 },
  btn: { padding: 13, border: 0, borderRadius: 12, background: "#15803d", color: "white", fontWeight: 1000, fontFamily: "inherit", cursor: "pointer", marginTop: 4 },
  ok: { color: "#15803d", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: 10, fontWeight: 900 },
  err: { color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 10, fontWeight: 900 },
};
