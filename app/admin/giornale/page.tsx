"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";

type Matchday = { id: string; number: number; status: string };

export default function AdminGiornalePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);

  const [leagueName, setLeagueName] = useState("—");
  const [teamName, setTeamName] = useState("—");

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
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");

      // 1) lega attiva
      const { data: ctx } = await supabase
        .from("user_context")
        .select("active_league_id")
        .eq("user_id", auth.user.id)
        .maybeSingle();

      if (!ctx?.active_league_id) return router.replace("/seleziona-lega");
      const activeLeagueId = ctx.active_league_id as string;
      setLeagueId(activeLeagueId);

      // 2) membership per quella lega (deve essere admin)
      const { data: mem } = await supabase
        .from("memberships")
        .select("team_id, role")
        .eq("league_id", activeLeagueId)
        .limit(1)
        .maybeSingle();

      if (!mem || mem.role !== "admin") return router.replace("/");
      setTeamId(mem.team_id);

      // 3) nomi lega e squadra
      const { data: lg } = await supabase.from("leagues").select("name").eq("id", activeLeagueId).single();
      if (lg?.name) setLeagueName(lg.name);

      const { data: tm } = await supabase.from("teams").select("name").eq("id", mem.team_id).single();
      if (tm?.name) setTeamName(tm.name);

      // 4) matchdays
      const { data: mds } = await supabase
        .from("matchdays")
        .select("id, number, status")
        .order("number", { ascending: false });

      const list = (mds || []) as Matchday[];
      setMatchdays(list);

      const open = list.find((x) => x.status === "open");
      setMatchdayId(open?.id ?? list[0]?.id ?? "");

      setLoading(false);
    }

    run();
  }, [router]);

  const matchdayNumber = useMemo(
    () => matchdays.find((x) => x.id === matchdayId)?.number,
    [matchdays, matchdayId]
  );

  async function loadPrompt(mid: string) {
    setMsg(null);
    setErr(null);
    setPromptText("");
    if (!mid) return;

    // La RPC get_article_prompt è già admin-only e usa la lega attiva
    const { data, error } = await supabase.rpc("get_article_prompt", { p_matchday_id: mid });
    if (error) {
      setErr(error.message);
      return;
    }
    setPromptText(String(data || ""));
  }

  async function loadExistingArticle(mid: string) {
    if (!leagueId || !mid) return;

    const { data } = await supabase
      .from("matchday_articles")
      .select("title, content")
      .eq("league_id", leagueId)
      .eq("matchday_id", mid)
      .maybeSingle();

    setTitle(data?.title ?? `Il Giornale FantaChat – Giornata ${matchdayNumber ?? ""}`.trim());
    setContent(data?.content ?? "");
  }

  async function loadSavedList() {
    if (!leagueId) return;

    const { data } = await supabase
      .from("matchday_articles")
      .select("matchday_id, title, created_at")
      .eq("league_id", leagueId)
      .order("created_at", { ascending: false });

    setSavedList((data || []) as any);
  }

  useEffect(() => {
    if (!leagueId || !matchdayId) return;
    loadPrompt(matchdayId);
    loadExistingArticle(matchdayId);
    loadSavedList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, matchdayId]);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(promptText);
      setMsg("Prompt copiato ✅");
    } catch {
      setErr("Impossibile copiare. Seleziona e copia manualmente.");
    }
  }

  async function saveArticle() {
    if (!leagueId || !matchdayId) return;

    setMsg(null);
    setErr(null);

    if (!title.trim() || !content.trim()) {
      setErr("Inserisci titolo e contenuto.");
      return;
    }

    setBusy(true);

    const { error } = await supabase
      .from("matchday_articles")
      .upsert(
        {
          league_id: leagueId,
          matchday_id: matchdayId,
          title: title.trim(),
          content: content.trim(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "league_id,matchday_id" }
      );

    setBusy(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setMsg("Giornale salvato ✅");
    await loadSavedList();
  }

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
            placeholder="Titolo del giornale..."
          />

          <div style={{ marginTop: 12, fontWeight: 1000 }}>Articolo</div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 12, border: "1px solid var(--border)", minHeight: 220, fontWeight: 700 }}
            placeholder="Incolla qui il testo generato da ChatGPT..."
          />

          <button className="btn btn-primary" style={{ marginTop: 12, width: "100%", padding: 12 }} onClick={saveArticle} disabled={busy}>
            {busy ? "Salvataggio..." : "Salva Giornale"}
          </button>

          {msg && <div style={{ marginTop: 12, fontWeight: 900, color: "var(--primary-dark)" }}>{msg}</div>}
          {err && <div style={{ marginTop: 12, fontWeight: 900, color: "var(--accent-dark)" }}>{err}</div>}

          <div style={{ marginTop: 12 }}>
            <a className="btn" href="/giornale" style={{ textDecoration: "none" }}>
              Vai a /giornale
            </a>
          </div>
        </div>

        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontWeight: 1000, fontSize: 18 }}>Storico giornali</div>
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {savedList.length === 0 ? (
              <div style={{ color: "var(--muted)", fontWeight: 800 }}>Nessun articolo ancora.</div>
            ) : (
              savedList.map((a) => (
                <a
                  key={a.matchday_id}
                  href={`/giornale?matchday=${a.matchday_id}`}
                  className="action"
                  style={{ margin: 0 }}
                >
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
