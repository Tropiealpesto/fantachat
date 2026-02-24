"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type AppRole = "player" | "admin";

type AppCtxValue = {
  ready: boolean;

  userId: string | null;
  userEmail: string | null;

  activeLeagueId: string | null;
  leagueName: string;

  teamId: string | null;
  teamName: string;

  role: AppRole | null;

  refresh: () => Promise<void>;
};

const Ctx = createContext<AppCtxValue | null>(null);

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used within <AppProvider />");
  return v;
}

export function AppProvider(props: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState<string>("—");

  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string>("—");

  const [role, setRole] = useState<AppRole | null>(null);

  async function refresh() {
    setReady(false);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setUserId(null);
      setUserEmail(null);
      setActiveLeagueId(null);
      setLeagueName("—");
      setTeamId(null);
      setTeamName("—");
      setRole(null);
      setReady(true);
      return;
    }

    setUserId(auth.user.id);
    setUserEmail(auth.user.email ?? null);

    // Lega attiva
    const { data: ctx } = await supabase
      .from("user_context")
      .select("active_league_id")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    const lid = ctx?.active_league_id ?? null;
    setActiveLeagueId(lid);

    if (!lid) {
      setLeagueName("—");
      setTeamId(null);
      setTeamName("—");
      setRole(null);
      setReady(true);
      return;
    }

    // Membership per lega attiva
    const { data: mem } = await supabase
      .from("memberships")
      .select("team_id, role")
      .eq("league_id", lid)
      .limit(1)
      .maybeSingle();

    if (!mem) {
      setLeagueName("—");
      setTeamId(null);
      setTeamName("—");
      setRole(null);
      setReady(true);
      return;
    }

    setTeamId(mem.team_id);
    setRole(mem.role);

    const [{ data: lg }, { data: tm }] = await Promise.all([
      supabase.from("leagues").select("name").eq("id", lid).single(),
      supabase.from("teams").select("name").eq("id", mem.team_id).single(),
    ]);

    setLeagueName(lg?.name ?? "—");
    setTeamName(tm?.name ?? "—");

    setReady(true);
  }

  useEffect(() => {
    refresh();

    // Reagisci a login/logout senza refresh manuale
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AppCtxValue>(
    () => ({
      ready,
      userId,
      userEmail,
      activeLeagueId,
      leagueName,
      teamId,
      teamName,
      role,
      refresh,
    }),
    [ready, userId, userEmail, activeLeagueId, leagueName, teamId, teamName, role]
  );

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}
