"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";

export default function GiornaleClient() {
  const router = useRouter();
  const params = useSearchParams();
  const matchdayFromQuery = params.get("matchday");

  const [loading, setLoading] = useState(true);

  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("—");
  const [leagueName, setLeagueName] = useState("—");

  const [matchdays, setMatchdays] = useState<{ id: string; number: number }[]>([]);
  const [matchdayId, setMatchdayId] = useState<string | null>(null);

  const [title, setTitle] = useState("Il Giornale FantaChat");
  const [content, setContent] = useState("Nessun articolo ancora.");

  useEffect(() => {
    async function run() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/login");

      const { data: ctx } = await supabase
        .from("user_context")
        .select("active_league_id")
        .eq("user_id", auth.user.id)
        .maybeSingle();

      if (!ctx?.active_league_id) return router.replace("/seleziona-lega");

      const activeLeagueId = ctx.active_league_id as string;
      setLeagueId(activeLeagueId);

      const { data: mem } = await supabase
        .from("memberships")
        .select("team_id")
        .eq("league_id", activeLeagueId)
        .limit(1)
        .maybeSingle();

      if (!mem) return router.replace("/seleziona-lega");

      const { data: lg } = await supabase.from("leagues").select("name").eq("id", activeLeagueId).single();
      if (lg?.name) setLeagueName(lg.name);

      const { data: tm } = await supabase.from("teams").select("name").eq("id", mem.team_id).single();
      if (tm?.name) setTeamName(tm.name);

      const { data: mds } = await supabase
        .from("matchdays")
        .select("id, number")
        .order("number", { ascending: false });

      const list = (mds || []) as any[];
      setMatchdays(list.map((x) => ({ id: x.id, number: x.number })));

      const initial = matchdayFromQuery || list[0]?.id || null;
      setMatchdayId(initial);

      setLoading(false);
    }

    run();
  }, [router, matchdayFromQuery]);

  useEffect(() => {
    async function loadArticle() {
      if (!leagueId || !matchdayId) return;

      const { data } = await supabase
        .from("matchday_articles")
        .select("title, content")
        .eq("league_id", leagueId)
        .eq("matchday_id", matchdayId)
        .maybeSingle();

      setTitle(data?.title ?? "Il Giornale FantaChat");
      setContent(data?.content ?? "Nessun articolo ancora per questa giornata.");
    }

    loadArticle();
  }, [leagueId, matchdayId]);

  const matchdayNumber = useMemo(
    () => matchdays.find((x) => x.id === matchdayId)?.number,
    [matchdays, matchdayId]
  );

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
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--border)",
                fontWeight: 900,
              }}
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
        </div>
      </main>

      <BottomNav />
    </>
  );
}
