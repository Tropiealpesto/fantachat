"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

// ─── TIPI ─────────────────────────────────────────────────────────────────────

type AppRole = "player" | "admin" | "super_admin";

type AppCtxValue = {
  ready: boolean;
  userId: string | null;
  userEmail: string | null;

  // Lega attiva
  activeLeagueId: string | null;
  leagueName: string;
  teamName: string;
  role: AppRole | null;

  // Competizione attiva (per il tema)
  competitionSlug: string | null;
  competitionName: string | null;
  seasonId: string | null;

  // Azioni
  refresh: () => Promise<void>;
  setActiveLeague: (leagueId: string) => Promise<void>;

  // Drawer
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const Ctx = createContext<AppCtxValue | null>(null);

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used within <AppProvider />");
  return v;
}

// ─── PROVIDER ─────────────────────────────────────────────────────────────────

export function AppProvider(props: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("—");
  const [teamName, setTeamName] = useState("—");
  const [role, setRole] = useState<AppRole | null>(null);

  const [competitionSlug, setCompetitionSlug] = useState<string | null>(null);
  const [competitionName, setCompetitionName] = useState<string | null>(null);
  const [seasonId, setSeasonId] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);

  // ─── REFRESH ──────────────────────────────────────────────────────────────

  async function refresh() {
    setReady(false);

    // 1) Auth
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      resetState();
      setReady(true);
      return;
    }

    setUserId(auth.user.id);
    setUserEmail(auth.user.email ?? null);

    // 2) Lega attiva dal user_context
    const { data: ctx } = await supabase
      .from("user_context")
      .select("active_league_id")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    const lid = ctx?.active_league_id ?? null;
    setActiveLeagueId(lid);

    if (!lid) {
      setLeagueName("—");
      setTeamName("—");
      setRole(null);
      setCompetitionSlug(null);
      setCompetitionName(null);
      setSeasonId(null);
      setReady(true);
      return;
    }

    // 3) Membership dell'utente in questa lega
    const { data: member } = await supabase
      .from("league_members")
      .select("team_name, role")
      .eq("league_id", lid)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (!member) {
      // Utente non è membro di questa lega — reset
      setLeagueName("—");
      setTeamName("—");
      setRole(null);
      setCompetitionSlug(null);
      setCompetitionName(null);
      setSeasonId(null);
      setReady(true);
      return;
    }

    setTeamName(member.team_name ?? "—");
    setRole(member.role as AppRole ?? "player");

    // 4) Info lega + stagione + competizione
    const { data: leagueData } = await supabase
      .from("leagues")
      .select(`
        name,
        season_id,
        seasons!inner(
          id,
          name,
          competitions!inner(
            name,
            slug
          )
        )
      `)
      .eq("id", lid)
      .single();

    if (leagueData) {
      setLeagueName(leagueData.name ?? "—");

      const season = (leagueData as any).seasons;
      setSeasonId(season?.id ?? null);

      const comp = season?.competitions;
      setCompetitionSlug(comp?.slug ?? null);
      setCompetitionName(comp?.name ?? null);
    } else {
      setLeagueName("—");
      setSeasonId(null);
      setCompetitionSlug(null);
      setCompetitionName(null);
    }

    setReady(true);
  }

  // ─── SET ACTIVE LEAGUE ────────────────────────────────────────────────────

  async function setActiveLeagueAction(leagueId: string) {
    const { error } = await supabase.rpc("set_active_league", {
      p_league_id: leagueId,
    });

    if (error) {
      console.error("Errore set_active_league:", error.message);
      return;
    }

    await refresh();
  }

  // ─── RESET STATE ──────────────────────────────────────────────────────────

  function resetState() {
    setUserId(null);
    setUserEmail(null);
    setActiveLeagueId(null);
    setLeagueName("—");
    setTeamName("—");
    setRole(null);
    setCompetitionSlug(null);
    setCompetitionName(null);
    setSeasonId(null);
  }

  // ─── INIT + AUTH LISTENER ─────────────────────────────────────────────────

  useEffect(() => {
    refresh();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── VALUE ────────────────────────────────────────────────────────────────

  const value = useMemo<AppCtxValue>(
    () => ({
      ready,
      userId,
      userEmail,
      activeLeagueId,
      leagueName,
      teamName,
      role,
      competitionSlug,
      competitionName,
      seasonId,
      refresh,
      setActiveLeague: setActiveLeagueAction,
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
    }),
    [
      ready, userId, userEmail, activeLeagueId, leagueName,
      teamName, role, competitionSlug, competitionName,
      seasonId, drawerOpen,
    ]
  );

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}
