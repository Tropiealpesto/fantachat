"use client";
import { useEffect, useState } from "react";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import CompetitionBadge from "../../components/CompetitionBadge";
import { useRequireLeagueAdmin } from "../../hooks/useRequireApp";
import { supabase } from "../../../lib/supabaseClient";

type Matchday = { id: string; number: number; status: string };

export default function AdminPodcast() {
  const app = useRequireLeagueAdmin();
  const [matchdays, setMatchdays] = useState<Matchday[]>([]);
  const [matchdayId, setMatchdayId] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [audio, setAudio] = useState("");
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

  async function save() {
    setErr(null);
    if (!title.trim() || !text.trim()) return setErr("Inserisci titolo e testo.");
    const { error } = await supabase.rpc("create_nyx_content", {
      p_league_id: app.activeLeagueId,
      p_league_competition_id: app.activeLeagueCompetitionId,
      p_matchday_id: matchdayId || null,
      p_title: title.trim(),
      p_text: text.trim(),
      p_audio_url: audio.trim() || null,
    });
    if (error) return setErr(error.message);
    setMsg("Puntata Nyx salvata ✅");
    setTitle("");
    setText("");
    setAudio("");
  }

  return (
    <>
      <AppBar league={app.leagueName} team={`${app.teamName} · ADMIN`} onMenuOpen={app.openDrawer} />
      <main style={s.container}>
        <div style={s.card}>
          <CompetitionBadge name={app.competitionName} type={app.competitionType} />
          <h1>Nyx / Podcast</h1>
          <p>Tutti i contenuti narrativi passano da Nyx.</p>

          <select value={matchdayId} onChange={(e) => setMatchdayId(e.target.value)} style={s.input}>
            <option value="">Nessuna giornata</option>
            {matchdays.map((m) => (
              <option key={m.id} value={m.id}>Giornata {m.number} ({m.status})</option>
            ))}
          </select>

          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titolo" style={s.input} />
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Testo puntata" style={{ ...s.input, minHeight: 220 }} />
          <input value={audio} onChange={(e) => setAudio(e.target.value)} placeholder="Audio URL opzionale" style={s.input} />
          <button onClick={save} style={s.btn}>Salva Nyx</button>
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
  card: { background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: 16, display: "grid", gap: 10 },
  input: { padding: 12, borderRadius: 12, border: "1px solid #e5e7eb", fontWeight: 800, fontFamily: "inherit" },
  btn: { padding: 13, border: 0, borderRadius: 12, background: "#16a34a", color: "white", fontWeight: 900 },
  ok: { color: "#15803d", fontWeight: 900 },
  err: { color: "#b85c0a", fontWeight: 900 },
};