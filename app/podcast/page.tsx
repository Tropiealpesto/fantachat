"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import { useApp } from "../components/AppContext";

type PodcastRow = {
  title: string;
  content: string;
  matchday_number: number | null;
};

export default function PodcastPage() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamName, openDrawer } = useApp();

  const [loading, setLoading] = useState(true);
  const [podcast, setPodcast] = useState<PodcastRow | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      if (!ready) return;
      if (!userId) return router.replace("/login");
      if (!activeLeagueId) return router.replace("/seleziona-lega");

      setErr(null);
      setLoading(true);

      const { data: row, error } = await supabase
        .from("matchday_articles")
        .select("title, content, matchday_id")
        .eq("league_id", activeLeagueId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }

      if (!row) {
        setPodcast(null);
        setLoading(false);
        return;
      }

      const { data: md } = await supabase
        .from("matchdays")
        .select("number")
        .eq("id", row.matchday_id)
        .maybeSingle();

      setPodcast({
        title: row.title,
        content: row.content,
        matchday_number: md?.number ?? null,
      });

      setLoading(false);
    }

    run();
  }, [ready, userId, activeLeagueId, router]);

  if (!ready) return <main className="container">Caricamento...</main>;
  if (loading) return <main className="container">Caricamento...</main>;

  return (
    <>
      <AppBar league={leagueName} team={teamName} onMenuOpen={openDrawer} />

      <main className="container">
        {!podcast ? (
          <div className="card" style={{ padding: 16, marginTop: 12 }}>
            Nessuna puntata disponibile.
          </div>
        ) : (
          <>
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "100px 1fr", gap: 12, alignItems: "start" }}>
              <img
                src="/nyx-v2.png"
                alt="Nyx"
                style={{
                  width: 100,
                  maxWidth: "100%",
                  display: "block",
                }}
              />

              <div>
                <div style={{ fontSize: 24, fontWeight: 1000, lineHeight: 1.15 }}>
                  {podcast.title}
                </div>

                {podcast.matchday_number && (
                  <div style={{ marginTop: 6, color: "var(--muted)", fontWeight: 900 }}>
                    Puntata dedicata alla giornata {podcast.matchday_number}
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                fontSize: 16,
                lineHeight: 1.7,
                fontWeight: 800,
                whiteSpace: "pre-line",
              }}
            >
              {podcast.content}
            </div>
          </>
        )}

        {err && (
          <div className="card" style={{ padding: 14, marginTop: 12, color: "var(--accent-dark)", fontWeight: 900 }}>
            {err}
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}
