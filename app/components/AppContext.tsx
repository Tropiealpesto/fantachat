"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { DEFAULT_THEME, themeFromType, type CompetitionTheme } from "../../lib/competitionThemes";

type AppRole = "player" | "admin" | "super_admin";

type AppContextRow = {
  user_id: string | null;
  user_email: string | null;
  active_league_id: string | null;
  active_league_competition_id: string | null;
  league_name: string | null;
  team_name: string | null;
  role: AppRole | null;
  competition_id: string | null;
  competition_name: string | null;
  competition_type: string | null;
  competition_slug: string | null;
  season_id: string | null;
};

type AppCtxValue = {
  ready: boolean;
  userId: string | null;
  userEmail: string | null;

  activeLeagueId: string | null;
  activeLeagueCompetitionId: string | null;

  leagueName: string;
  teamName: string;
  role: AppRole | null;

  competitionId: string | null;
  competitionName: string | null;
  competitionType: string | null;
  competitionSlug: string | null;
  competitionTheme: CompetitionTheme;
  seasonId: string | null;

  isAdmin: boolean;
  isSuperAdmin: boolean;

  refresh: () => Promise<void>;
  setActiveLeague: (leagueId: string) => Promise<void>;
  setActiveCompetition: (leagueCompetitionId: string) => Promise<void>;

  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const Ctx = createContext<AppCtxValue | null>(null);

export function useApp() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useApp must be used within <AppProvider />");
  return value;
}

const emptyCtx: AppContextRow = {
  user_id: null,
  user_email: null,
  active_league_id: null,
  active_league_competition_id: null,
  league_name: null,
  team_name: null,
  role: null,
  competition_id: null,
  competition_name: null,
  competition_type: null,
  competition_slug: null,
  season_id: null,
};

function normalizeRpcRow(data: unknown): Partial<AppContextRow> | null {
  if (!data) return null;

  const row = Array.isArray(data) ? data[0] : data;

  if (!row || typeof row !== "object") return null;

  return row as Partial<AppContextRow>;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [row, setRow] = useState<AppContextRow>(emptyCtx);
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function refresh() {
    setReady(false);

    try {
      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) {
        setRow(emptyCtx);
        setReady(true);
        return;
      }

      const fallback: AppContextRow = {
        ...emptyCtx,
        user_id: auth.user.id,
        user_email: auth.user.email ?? null,
      };

      // 1. Tentativo principale tramite RPC
      const { data, error } = await supabase.rpc("get_app_context");

      const rpcRow = !error ? normalizeRpcRow(data) : null;

      if (rpcRow) {
        setRow({
          ...fallback,
          ...rpcRow,
          user_id: rpcRow.user_id ?? auth.user.id,
          user_email: rpcRow.user_email ?? auth.user.email ?? null,
        });
        setReady(true);
        return;
      }

      if (error) {
        console.warn("get_app_context fallback:", error.message);
      }

      // 2. Fallback compatibile se la RPC non risponde correttamente
      const { data: ctx } = await supabase
        .from("user_context")
        .select("active_league_id, active_league_competition_id")
        .eq("user_id", auth.user.id)
        .maybeSingle();

      const activeLeagueId = ctx?.active_league_id ?? null;

      if (!activeLeagueId) {
        setRow(fallback);
        setReady(true);
        return;
      }

      const { data: member } = await supabase
        .from("league_members")
        .select("team_name, role")
        .eq("league_id", activeLeagueId)
        .eq("user_id", auth.user.id)
        .maybeSingle();

      const { data: league } = await supabase
        .from("leagues")
        .select("name")
        .eq("id", activeLeagueId)
        .maybeSingle();

      let leagueCompetitionId = ctx?.active_league_competition_id ?? null;
      let competitionData: Partial<AppContextRow> = {};

      // Se l'utente ha una lega attiva ma nessuna competizione attiva,
      // prende la prima competizione attiva della lega.
      if (!leagueCompetitionId) {
        const { data: firstLc } = await supabase
          .from("league_competitions")
          .select("id")
          .eq("league_id", activeLeagueId)
          .eq("status", "active")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        leagueCompetitionId = firstLc?.id ?? null;

        if (leagueCompetitionId) {
          await supabase
            .from("user_context")
            .upsert(
              {
                user_id: auth.user.id,
                active_league_id: activeLeagueId,
                active_league_competition_id: leagueCompetitionId,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "user_id" }
            );
        }
      }

      if (leagueCompetitionId) {
        const { data: lc } = await supabase
          .from("league_competitions")
          .select(`
            id,
            competition_id,
            season_id,
            competitions(name, slug, type),
            seasons(name)
          `)
          .eq("id", leagueCompetitionId)
          .maybeSingle();

        const comp = (lc as any)?.competitions;

        competitionData = {
          active_league_competition_id: leagueCompetitionId,
          competition_id: (lc as any)?.competition_id ?? null,
          season_id: (lc as any)?.season_id ?? null,
          competition_name: comp?.name ?? null,
          competition_slug: comp?.slug ?? null,
          competition_type: comp?.type ?? null,
        };
      }

      setRow({
        ...fallback,
        active_league_id: activeLeagueId,
        league_name: league?.name ?? "â€”",
        team_name: member?.team_name ?? "â€”",
        role: (member?.role as AppRole | undefined) ?? "player",
        ...competitionData,
      });

      setReady(true);
    } catch (e) {
      console.error("AppContext refresh error:", e);

      try {
        const { data: auth } = await supabase.auth.getUser();

        if (auth.user) {
          setRow({
            ...emptyCtx,
            user_id: auth.user.id,
            user_email: auth.user.email ?? null,
          });
        } else {
          setRow(emptyCtx);
        }
      } catch {
        setRow(emptyCtx);
      }

      setReady(true);
    }
  }

  async function setActiveLeague(leagueId: string) {
    const { error } = await supabase.rpc("set_active_league", {
      p_league_id: leagueId,
    });

    if (error) {
      console.error("set_active_league error:", error.message);

      const { data: auth } = await supabase.auth.getUser();

      if (auth.user) {
        await supabase
          .from("user_context")
          .upsert(
            {
              user_id: auth.user.id,
              active_league_id: leagueId,
              active_league_competition_id: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );
      }
    }

    await refresh();
  }

  async function setActiveCompetition(leagueCompetitionId: string) {
    const { error } = await supabase.rpc("set_active_competition", {
      p_league_competition_id: leagueCompetitionId,
    });

    if (error) {
      console.error("set_active_competition error:", error.message);

      const { data: auth } = await supabase.auth.getUser();

      if (auth.user) {
        await supabase
          .from("user_context")
          .update({
            active_league_competition_id: leagueCompetitionId,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", auth.user.id);
      }
    }

    await refresh();
  }

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

const isSuperAdmin =
  row.role === "super_admin" ||
  row.user_email?.toLowerCase() === "pietrparod@gmail.com";

const isAdmin =
  row.role === "admin" ||
  row.role === "super_admin" ||
  isSuperAdmin;

  const competitionTheme = useMemo(() => {
    try {
      return themeFromType(row.competition_type ?? undefined);
    } catch {
      return DEFAULT_THEME;
    }
  }, [row.competition_type]);

  useEffect(() => {
    const root = document.documentElement;
    const theme = competitionTheme;

    root.dataset.competitionTheme = theme.key;

    root.style.setProperty("--fc-primary", theme.primary);
    root.style.setProperty("--fc-primary-dark", theme.primaryDark);
    root.style.setProperty("--fc-accent", theme.accent);
    root.style.setProperty("--fc-page-bg", theme.pageBg);
    root.style.setProperty("--fc-card-bg", theme.cardBg);
    root.style.setProperty("--fc-border", theme.border);
    root.style.setProperty("--fc-text", theme.text);
    root.style.setProperty("--fc-muted", theme.muted);
    root.style.setProperty("--fc-soft", theme.soft);
    root.style.setProperty("--fc-shadow", theme.shadow);
  }, [competitionTheme]);
  const value = useMemo<AppCtxValue>(
    () => ({
      ready,
      userId: row.user_id,
      userEmail: row.user_email,

      activeLeagueId: row.active_league_id,
      activeLeagueCompetitionId: row.active_league_competition_id,

      leagueName: row.league_name ?? "â€”",
      teamName: row.team_name ?? "â€”",
      role: row.role,

      competitionId: row.competition_id,
      competitionName: row.competition_name,
      competitionType: row.competition_type,
      competitionSlug: row.competition_slug,
      competitionTheme,
      seasonId: row.season_id,

      isAdmin,
      isSuperAdmin,

      refresh,
      setActiveLeague,
      setActiveCompetition,

      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
    }),
    [
      ready,
      row,
      competitionTheme,
      isAdmin,
      isSuperAdmin,
      drawerOpen,
    ]
  );
  
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
