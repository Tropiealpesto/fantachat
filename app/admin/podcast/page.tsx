"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import { useApp } from "../../components/AppContext";

type Matchday = {
  id: string;
  number: number;
  status: string;
};

type Summary = {
  topTeam: string;
  topScore: number;
  bottomTeam: string;
  bottomScore: number;
  leaderTeam: string;
  leaderTotal: number;
};

export default function AdminPodcastPage() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamName, role, openDrawer } = useApp();

  const [loading, setLoading] = useState(true);
  const [matchdays, setMatchdays] = useState<Matchday[]>([]);
  const [matchdayId, setMatchdayId] = useState<string>("");

  const [summary, setSummary] = useState<Summary | null>(null);
  const [promptText, setPromptText] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function run() {
      if (!ready) return;
      if (!userId) return router.replace("/login");
      if (!activeLeagueId) return router.replace("/seleziona-lega");
      if (role !== "admin") return router.replace("/");

      setErr(null);
      setLoading(true);

      const { data: mds, error: mdsErr } = await supabase
        .from("matchdays")
        .select("id, number, status")
        .eq("league_id", activeLeagueId)
        .order("number", { ascending: false });

      if (mdsErr) {
        setErr(mdsErr.message);
        setLoading(false);
        return;
      }

      const list = (mds || []) as Matchday[];
      setMatchdays(list);

      const defaultMd =
        list.find((m) => m.status !== "open") ||
        list[0] ||
        null;

      setMatchdayId(defaultMd?.id || "");
      setLoading(false);
    }

    run();
  }, [ready, userId, activeLeagueId, role, router]);

  useEffect(() => {
    async function loadForMatchday() {
      if (!activeLeagueId || !matchdayId) return;

      setErr(null);
      setMsg(null);

      const currentMd = matchdays.find((m) => m.id === matchdayId);
      const mdNumber = currentMd?.number ?? 0;

      const { data: scores, error: scoresErr } = await supabase
        .from("matchday_team_scores")
        .select("team_id, total_score, teams!inner(name)")
        .eq("league_id", activeLeagueId)
        .eq("matchday_id", matchdayId);

      if (scoresErr) {
        setErr(scoresErr.message);
        return;
      }

      const rows = (scores || []).map((r: any) => ({
        teamName: String(r.teams?.name || "—"),
        totalScore: Number(r.total_score || 0),
      }));

      const sortedDesc = [...rows].sort((a, b) => b.totalScore - a.totalScore || a.teamName.localeCompare(b.teamName));
      const sortedAsc = [...rows].sort((a, b) => a.totalScore - b.totalScore || a.teamName.localeCompare(b.teamName));

      const top = sortedDesc[0];
      const bottom = sortedAsc[0];

      const { data: leaderRows, error: leaderErr } = await supabase
        .from("league_table")
        .select("total_score, teams!inner(name)")
        .eq("league_id", activeLeagueId)
        .order("total_score", { ascending: false })
        .limit(1);

      if (leaderErr) {
        setErr(leaderErr.message);
        return;
      }

      const leader: any = leaderRows?.[0];

      const s: Summary = {
        topTeam: top?.teamName || "—",
        topScore: Number(top?.totalScore || 0),
        bottomTeam: bottom?.teamName || "—",
        bottomScore: Number(bottom?.totalScore || 0),
        leaderTeam: String(leader?.teams?.name || "—"),
        leaderTotal: Number(leader?.total_score || 0),
      };

      setSummary(s);

      const generatedPrompt = [
        "Sei Nyx, la voce ufficiale di FantaChat.",
        "",
        "Scrivi il testo di una puntata podcast breve e coinvolgente.",
        "Tono: personale, diretto, elegante, mai aggressivo.",
        "Formato mobile-friendly, scorrevole, senza elenchi.",
        "",
        `Titolo richiesto: crea un titolo originale per la giornata ${mdNumber}.`,
        "",
        "Informazioni da includere obbligatoriamente:",
        `- Miglior squadra di giornata: ${s.topTeam} (${fmt(s.topScore)})`,
        `- Peggior squadra di giornata: ${s.bottomTeam} (${fmt(s.bottomScore)})`,
        `- Prima in classifica: ${s.leaderTeam} (${fmt(s.leaderTotal)})`,
        "",
        "Output richiesto:",
        "1) Titolo",
        "2) Testo completo del podcast",
        "",
        "L'estratto iniziale della Home dovrà poter suonare così nello stile:",
        `"${s.topTeam} si prende la scena con ${fmt(s.topScore)} punti, mentre ${s.bottomTeam} fa molta fatica e conclude con ${bottomPrefix(s.bottomScore)}${fmt(s.bottomScore)}.\n\nIn cima alla classifica c’è ${s.leaderTeam} con ${fmt(s.leaderTotal)}."`,
      ].join("\n");

      setPromptText(generatedPrompt);

      const { data: saved, error: savedErr } = await supabase
        .from("matchday_articles")
        .select("title, content")
        .eq("league_id", activeLeagueId)
        .eq("matchday_id", matchdayId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (savedErr) {
        setErr(savedErr.message);
        return;
      }

      setTitle(saved?.title || `Nyx si sbilancia sulla giornata ${mdNumber}`);
      setContent(saved?.content || "");
    }

    loadForMatchday();
  }, [activeLeagueId, matchdayId, matchdays]);

  const currentMatchdayNumber = useMemo(() => {
    return matchdays.find((m) => m.id === matchdayId)?.number ?? null;
  }, [matchdays, matchdayId]);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(promptText);
      setMsg("Prompt copiato ✅");
    } catch {
      setErr("Non sono riuscito a copiare il prompt.");
    }
  }

  async function savePodcast() {
    if (!activeLeagueId || !matchdayId) return;
    if (!title.trim() || !content.trim()) {
      setErr("Inserisci titolo e contenuto del podcast.");
      return;
    }

    setErr(null);
    setMsg(null);
    setSaving(true);

    const { error: delErr } = await supabase
      .from("matchday_articles")
      .delete()
      .eq("league_id", activeLeagueId)
      .eq("matchday_id", matchdayId);

    if (delErr) {
      setSaving(false);
      setErr(delErr.message);
      return;
    }

    const { error: insErr } = await supabase
      .from("matchday_articles")
      .insert({
        league_id: activeLeagueId,
        matchday_id: matchdayId,
        title: title.trim(),
        content: content.trim(),
      });

    setSaving(false);

    if (insErr) {
      setErr(insErr.message);
      return;
    }

    setMsg("Podcast salvato ✅");
  }

  if (!ready) return <main className="container">Caricamento...</main>;
  if (loading) return <main className="container">Caricamento...</main>;

  return (
    <>
      <AppBar league={leagueName} team={`${teamName} • ADMIN`} />

      <main className="container">
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 1000 }}>Podcast</div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
            Genera il prompt, crea la puntata con Nyx e salvala.
          </div>

          <select
            value={matchdayId}
            onChange={(e) => setMatchdayId(e.target.value)}
            style={{
              width: "100%",
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--border)",
              fontWeight: 900,
            }}
          >
            {matchdays.map((m) => (
              <option key={m.id} value={m.id}>
                Giornata {m.number} ({m.status})
              </option>
            ))}
          </select>
        </div>

        {summary && (
          <div className="card" style={{ padding: 16, marginTop: 12, borderLeft: "6px solid var(--accent)" }}>
            <div style={{ fontWeight: 1000, fontSize: 18 }}>
              Dati base · Giornata {currentMatchdayNumber ?? "—"}
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 8, fontWeight: 900 }}>
              <div>Miglior squadra: {summary.topTeam} ({fmt(summary.topScore)})</div>
              <div>Peggior squadra: {summary.bottomTeam} ({fmt(summary.bottomScore)})</div>
              <div>Prima in classifica: {summary.leaderTeam} ({fmt(summary.leaderTotal)})</div>
            </div>
          </div>
        )}

        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Prompt</div>
          <textarea
            value={promptText}
            readOnly
            style={{
              width: "100%",
              minHeight: 260,
              marginTop: 10,
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--border)",
              fontWeight: 700,
            }}
          />

          <button className="btn btn-primary" style={{ marginTop: 10, width: "100%" }} onClick={copyPrompt}>
            Copia prompt
          </button>
        </div>

        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Salva puntata</div>

          <div style={{ marginTop: 12, fontWeight: 900 }}>Titolo</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nyx si sbilancia sulla giornata..."
            style={inputStyle}
          />

          <div style={{ marginTop: 12, fontWeight: 900 }}>Testo completo</div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Incolla qui la puntata completa"
            style={{
              ...inputStyle,
              minHeight: 260,
              resize: "vertical",
            }}
          />

          <button
            className="btn btn-primary"
            style={{ marginTop: 12, width: "100%" }}
            onClick={savePodcast}
            disabled={saving}
          >
            {saving ? "Salvataggio..." : "Salva podcast"}
          </button>

          {msg && <div style={{ marginTop: 12, color: "var(--primary-dark)", fontWeight: 900 }}>{msg}</div>}
          {err && <div style={{ marginTop: 12, color: "var(--accent-dark)", fontWeight: 900 }}>{err}</div>}
        </div>
      </main>

      <BottomNav />
    </>
  );
}

const inputStyle: any = {
  width: "100%",
  marginTop: 8,
  padding: 12,
  borderRadius: 12,
  border: "1px solid var(--border)",
  fontWeight: 800,
  background: "white",
};

function fmt(n: number) {
  if (!Number.isFinite(n)) return "0";
  return (Math.round(n * 10) / 10).toString().replace(".", ",");
}

function bottomPrefix(n: number) {
  return n <= 0 ? "un " : "";
}
