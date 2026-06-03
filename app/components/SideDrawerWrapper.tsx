"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { useApp } from "./AppContext";
import SideDrawer from "./SideDrawer";

type Competition = {
  id: string;
  name: string;
  slug: string;
  season_id: string;
  matchday_number: number | null;
  team_count: number;
  is_active: boolean;
};

export default function SideDrawerWrapper() {
  const router = useRouter();
  const {
    drawerOpen, closeDrawer,
    teamName, leagueName, role, userId,
    activeLeagueId, setActiveLeague,
  } = useApp();

  const isAdmin = role === "admin" || role === "super_admin";
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [activeCompId, setActiveCompId] = useState<string | null>(null);

  // Carica le competizioni della lega quando il drawer si apre
  useEffect(() => {
    if (!drawerOpen || !userId) return;

    async function load() {
      // Trova tutte le leghe dell'utente
      const { data: memberships } = await supabase
        .from("league_members")
        .select(`
          league_id,
          leagues!inner(
            id, name, season_id,
            seasons!inner(
              id, total_matchdays,
              competitions!inner(id, name, slug)
            )
          )
        `)
        .eq("user_id", userId);

      if (!memberships) return;

      const comps: Competition[] = [];

      for (const mem of memberships as any[]) {
        const league = mem.leagues;
        const season = league?.seasons;
        const comp = season?.competitions;
        if (!comp) continue;

        // Conta i membri di questa lega
        const { count } = await supabase
          .from("league_members")
          .select("*", { count: "exact", head: true })
          .eq("league_id", league.id);

        // Ultima giornata
        const { data: lastMd } = await supabase
          .from("matchdays")
          .select("number")
          .eq("season_id", season.id)
          .order("number", { ascending: false })
          .limit(1)
          .maybeSingle();

        comps.push({
          id: league.id, // usiamo league_id come ID univoco della competizione nella lega
          name: comp.name,
          slug: comp.slug,
          season_id: season.id,
          matchday_number: lastMd?.number ?? null,
          team_count: count ?? 0,
          is_active: league.id === activeLeagueId,
        });
      }

      setCompetitions(comps);
      setActiveCompId(activeLeagueId);
    }

    load();
  }, [drawerOpen, userId, activeLeagueId]);

  async function handleSwitchCompetition(leagueId: string) {
    await setActiveLeague(leagueId);
    closeDrawer();
    // Forza reload per aggiornare il tema
    window.location.href = "/";
  }

  return (
    <SideDrawer
      isOpen={drawerOpen}
      onClose={closeDrawer}
      teamName={teamName}
      leagueName={leagueName}
      isAdmin={isAdmin}
      competitions={competitions}
      activeCompetitionId={activeCompId}
      onSwitchCompetition={handleSwitchCompetition}
      onAddCompetition={() => {
        closeDrawer();
        router.push("/admin/competizione/nuova");
      }}
    />
  );
}
