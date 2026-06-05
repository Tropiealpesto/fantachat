"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useApp } from "./AppContext";
import SideDrawer from "./SideDrawer";

type DrawerCompetition = {
  id: string;
  name: string;
  competition_type: string | null;
  competition_slug: string | null;
  season_name: string | null;
  matchday_number: number | null;
  is_active: boolean;
};

export default function SideDrawerWrapper() {
  const app = useApp();
  const [competitions, setCompetitions] = useState<DrawerCompetition[]>([]);

  useEffect(() => {
    if (!app.drawerOpen || !app.activeLeagueId) return;

    async function load() {
      const { data, error } = await supabase.rpc("get_league_competitions", { p_league_id: app.activeLeagueId });
      if (!error && data) {
        setCompetitions(data as DrawerCompetition[]);
        return;
      }

      const { data: rows } = await supabase
        .from("league_competitions")
        .select("id, name, competitions(slug,type), seasons(name)")
        .eq("league_id", app.activeLeagueId)
        .eq("status", "active")
        .order("created_at", { ascending: true });

      setCompetitions(((rows ?? []) as any[]).map((r) => ({
        id: r.id,
        name: r.name,
        competition_type: r.competitions?.type ?? null,
        competition_slug: r.competitions?.slug ?? null,
        season_name: r.seasons?.name ?? null,
        matchday_number: null,
        is_active: r.id === app.activeLeagueCompetitionId,
      })));
    }

    load();
  }, [app.drawerOpen, app.activeLeagueId, app.activeLeagueCompetitionId]);

  async function switchCompetition(id: string) {
    await app.setActiveCompetition(id);
    app.closeDrawer();
  }

  return (
    <SideDrawer
      isOpen={app.drawerOpen}
      onClose={app.closeDrawer}
      teamName={app.teamName}
      leagueName={app.leagueName}
      isAdmin={app.isAdmin}
      isSuperAdmin={app.isSuperAdmin}
      competitions={competitions}
      activeLeagueCompetitionId={app.activeLeagueCompetitionId}
      onSwitchCompetition={switchCompetition}
    />
  );
}
