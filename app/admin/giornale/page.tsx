"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import { useApp } from "../../components/AppContext";

type Matchday = { id: string; number: number; status: string };

export default function AdminGiornalePage() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamId, teamName, role } = useApp();

  const [loading, setLoading] = useState(true);

  const [matchdays, setMatchdays] = useState<Matchday[]>([]);
  const [matchdayId, setMatchdayId] = useState<string>("");

  const [promptText, setPromptText] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [content, setContent] = useState<string>("");

  const [savedList, setSavedList] = useState<{ matchday_id: string; title: string; created_at: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    async function run() {
      if (!ready) return;
      if (!userId) return router.replace("/login");
      if (!activeLeagueId || !teamId) return router.replace("/seleziona-lega");
      if (role !== "admin") return router.replace("/");

      const { data: mds } = await supabase
        .from("matchdays")
        .select("id, number, status")
        .eq("league_id", activeLeagueId)
        .order("number", { ascending: false });

      const list = (mds || []) as Matchday[];
      setMatchdays(list);

      const open = list.find((x) => x.status === "open");
      setMatchdayId(open?.id ?? list[0]?.id ?? "");

      setLoading(false);
    }

    run();
  }, [ready, userId, activeLeagueId, teamId, role, router]);

  const matchdayNumber = useMemo(() => matchdays.find((x) => x.id === matchdayId)?.number, [matchdays, matchdayId]);

  async function loadPrompt(mid: string) {
    setMsg(null); setErr(null);
    setPromptText("");
    if (!mid) return;
    const { data, error } = await supabase.rpc("get_article_prompt", { p_matchday_id: mid });
    if (error) return setErr(error.message);
    setPromptText(String(data || ""));
  }

  async function loadExistingArticle(mid: string) {
    if (!activeLeagueId || !mid) return;

    const { data } = await supabase
      .from("matchday_articles")
      .select("title, content")
      .eq("league_id", activeLeagueId)
      .eq("matchday_id", mid)
      .maybeSingle();

    setTitle(data?.title ?? `Il Giornale FantaChat – Giornata ${matchdayNumber ?? ""}`.trim());
    setContent(data?.content ?? "");
  }

  async function loadSavedList() {
    if (!activeLeagueId) return;
    const { data } = await supabase
      .from("matchday_articles")
      .select("matchday_id, title, created_at")
      .eq("league_id", activeLeagueId)
      .order("created_at", { ascending: false });

    setSavedList((data || []) as any);
  }

  useEffect(() => {
    if (!activeLeagueId || !matchdayId) return;
    loadPrompt(matchdayId);
    loadExistingArticle(matchdayId);
    loadSavedList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLeagueId, matchdayId]);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(promptText);
      setMsg("Prompt copiato ✅");
    } catch {
      setErr("Impossibile copiare. Copia manualmente.");
    }
  }

  async function saveArticle() {
    if (!activeLeagueId || !matchdayId) return;

    setMsg(null); setErr(null);
    if (!title.trim() || !content.trim()) return setErr("Inserisci titolo e contenuto.");

    setBusy(true);
    const { error } = await supabase
      .from("matchday_articles")
      .upsert(
        { league_id: activeLeagueId, matchday_id: matchdayId, title: title.trim(), content: content.trim(), updated_at: new Date().toISOString() },
        { onConflict: "league_id,matchday_id" }
      );
    setBusy(false);

    if (error) return setErr(error.message);
    setMsg("Giornale salvato ✅");
    await loadSavedList();
  }

  if (!ready) return <main className="container">Caricamento...</main>;
  if (loading) return <main className="container">Caricamento...</main>;

  return (
    <>
      <AppBar league={leagueName} team={`${teamName} • ADMIN`} />
      <main className="container">
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 1000 }}>Admin • Il Giornale FantaChat</div>
          <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 800 }}>
            Seleziona una giornata → copia prompt → ChatGPT → incolla → salva.
          </div>

          <select
            value={matchdayId}
            onChange={(e) => setMatchdayId(e.target.value)}
            style={{ width: "100%", padding: 12, marginTop: 12, borderRadius: 12, border: "1px solid var(--border)", fontWeight: 900 }}
          >
            {matchdays.map((m) => (
              <option key={m.id} value={m.id}>
                Giornata {m.number} ({m.status})
              </option>
            ))}
          </select>

          <div style={{ marginTop: 12, fontWeight: 1000 }}>Prompt (Giornata {matchdayNumber ?? "—"})</div>
          <textarea
            value={promptText}
            readOnly
            style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 12, border: "1px solid var(--border)", minHeight: 180, fontWeight: 700 }}
          />

          <button className="btn" style={{ marginTop: 10, border: "2px solid var(--accent)" }} onClick={copyPrompt}>
            Copia prompt
          </button>

          <div style={{ marginTop: 16, fontWeight: 1000 }}>Titolo</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 12, border: "1px solid var(--border)", fontWeight: 900 }}
          />

          <div style={{ marginTop: 12, fontWeight: 1000 }}>Articolo</div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 12, border: "1px solid var(--border)", minHeight: 220, fontWeight: 700 }}
          />

          <button className="btn btn-primary" style={{ marginTop: 12, width: "100%", padding: 12 }} onClick={saveArticle} disabled={busy}>
            {busy ? "Salvataggio..." : "Salva Giornale"}
          </button>

          {msg && <div style={{ marginTop: 12, color: "var(--primary-dark)", fontWeight: 900 }}>{msg}</div>}
          {err && <div style={{ marginTop: 12, color: "var(--accent-dark)", fontWeight: 900 }}>{err}</div>}
        </div>

        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Storico giornali</div>
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {savedList.length === 0 ? (
              <div style={{ color: "var(--muted)", fontWeight: 800 }}>Nessun articolo ancora.</div>
            ) : (
              savedList.map((a) => (
                <a key={a.matchday_id} href={`/giornale?matchday=${a.matchday_id}`} className="action" style={{ margin: 0 }}>
                  <div style={{ fontWeight: 1000 }}>{a.title}</div>
                  <small>{new Date(a.created_at).toLocaleString()}</small>
                </a>
              ))
            )}
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
