"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { useApp } from "../components/AppContext";

export default function GiornaleClient() {
  const router = useRouter();
  const params = useSearchParams();
  const matchdayFromQuery = params.get("matchday");

  const { ready, userId, activeLeagueId, leagueName, teamId, teamName } = useApp();

  const [loading, setLoading] = useState(true);
  const [matchdays, setMatchdays] = useState<{ id: string; number: number }[]>([]);
  const [matchdayId, setMatchdayId] = useState<string | null>(null);

  const [title, setTitle] = useState("Il Giornale FantaChat");
  const [content, setContent] = useState("Nessun articolo ancora.");

  useEffect(() => {
    async function run() {
      if (!ready) return;
      if (!userId) return router.replace("/login");
      if (!activeLeagueId || !teamId) return router.replace("/seleziona-lega");

      const { data: mds } = await supabase
        .from("matchdays")
        .select("id, number")
        .eq("league_id", activeLeagueId)
        .order("number", { ascending: false });

      const list = (mds || []) as any[];
      setMatchdays(list.map((x) => ({ id: x.id, number: x.number })));

      const initial = matchdayFromQuery || list[0]?.id || null;
      setMatchdayId(initial);

      setLoading(false);
    }

    run();
  }, [ready, userId, activeLeagueId, teamId, matchdayFromQuery, router]);

  useEffect(() => {
    async function loadArticle() {
      if (!activeLeagueId || !matchdayId) return;

      const { data } = await supabase
        .from("matchday_articles")
        .select("title, content")
        .eq("league_id", activeLeagueId)
        .eq("matchday_id", matchdayId)
        .maybeSingle();

      setTitle(data?.title ?? "Il Giornale FantaChat");
      setContent(data?.content ?? "Nessun articolo ancora per questa giornata.");
    }

    loadArticle();
  }, [activeLeagueId, matchdayId]);

  const matchdayNumber = useMemo(
    () => matchdays.find((x) => x.id === matchdayId)?.number,
    [matchdays, matchdayId]
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${title}\n\n${content}`);
    } catch {}
  }

  if (!ready) return <div style={{ padding: 20 }}>Caricamento...</div>;
  if (loading) return <div style={{ padding: 20 }}>Caricamento...</div>;

  return (
    <>
      <AppBar league={leagueName} team={teamName} />
      <main className="container">
        <div className="card" style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 1000 }}>
            {title}{matchdayNumber ? ` • Giornata ${matchdayNumber}` : ""}
          </div>

          <div style={{ marginTop: 12 }}>
            <select
              value={matchdayId ?? ""}
              onChange={(e) => setMatchdayId(e.target.value)}
              style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid var(--border)", fontWeight: 900 }}
            >
              {matchdays.map((m) => (
                <option key={m.id} value={m.id}>
                  Giornata {m.number}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 12, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
            {content}
          </div>

          <button className="btn" style={{ marginTop: 12, border: "2px solid var(--accent)" }} onClick={copy}>
            Copia testo
          </button>
        </div>
      </main>
      <BottomNav />
    </>
  );
}
