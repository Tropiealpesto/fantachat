"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { DEFAULT_THEME, themeFromType, type CompetitionTheme } from "../../lib/competitionThemes";
import { humanError } from "../../lib/humanError";

type AppRole = "player" | "admin" | "super_admin";
type UiTheme = "light" | "dark";

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
  contextError: string | null;
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

  uiTheme: UiTheme;
  setUiTheme: (theme: UiTheme) => void;
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
  const [contextError, setContextError] = useState<string | null>(null);
  const [row, setRow] = useState<AppContextRow>(emptyCtx);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [uiTheme, setUiThemeState] = useState<UiTheme>("light");

  const setUiTheme = useCallback((theme: UiTheme) => {
    setUiThemeState(theme);
    try {
      window.localStorage.setItem("fantachat-ui-theme", theme);
    } catch {}
  }, []);

  const refresh = useCallback(async () => {
    setReady(false);
    setContextError(null);

    try {
      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) {
        setRow(emptyCtx);
        setContextError(null);
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
        setContextError(null);
        setReady(true);
        return;
      }

      if (error) {
        console.warn("get_app_context fallback:", error.message);
      }

      setRow((current) => current.user_id === auth.user.id ? current : fallback);
      setContextError("Non riesco a caricare il contesto dell'app. Riprova tra poco.");
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

      setContextError("Connessione temporaneamente non disponibile. Riprova tra poco.");
      setReady(true);
    }
  }, []);

  const setActiveLeague = useCallback(async (leagueId: string) => {
    const { error } = await supabase.rpc("set_active_league", {
      p_league_id: leagueId,
    });

    if (error) {
      console.error("set_active_league error:", error.message);
      setContextError(humanError(error, "Non è stato possibile cambiare lega."));
    }

    await refresh();
  }, [refresh]);

  const setActiveCompetition = useCallback(async (leagueCompetitionId: string) => {
    const { error } = await supabase.rpc("set_active_competition", {
      p_league_competition_id: leagueCompetitionId,
    });

    if (error) {
      console.error("set_active_competition error:", error.message);
      setContextError(humanError(error, "Non è stato possibile cambiare competizione."));
    }

    await refresh();
  }, [refresh]);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) return;

      void refresh();

      try {
        const saved = window.localStorage.getItem("fantachat-ui-theme");
        if (saved === "dark" || saved === "light") setUiThemeState(saved);
      } catch {}
    });

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [refresh]);

const isSuperAdmin = row.role === "super_admin";

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
    const dark = uiTheme === "dark";

    root.dataset.competitionTheme = theme.key;
    root.dataset.uiTheme = uiTheme;

    root.style.setProperty("--fc-primary", dark ? "#58ff94" : theme.primary);
    root.style.setProperty("--fc-primary-dark", dark ? "#22e26f" : theme.primaryDark);
    root.style.setProperty("--fc-accent", dark ? "#ff8a26" : theme.accent);
    root.style.setProperty("--fc-page-bg", dark ? "#00030a" : theme.pageBg);
    root.style.setProperty("--fc-card-bg", dark ? "rgba(4,8,22,0.76)" : theme.cardBg);
    root.style.setProperty("--fc-border", dark ? "rgba(91,110,151,0.30)" : theme.border);
    root.style.setProperty("--fc-text", dark ? "#f8fafc" : theme.text);
    root.style.setProperty("--fc-muted", dark ? "#98a4bd" : theme.muted);
    root.style.setProperty("--fc-soft", dark ? "rgba(88,255,148,0.12)" : theme.soft);
    root.style.setProperty("--fc-shadow", dark ? "0 18px 42px rgba(0,0,0,0.54)" : theme.shadow);
  }, [competitionTheme, uiTheme]);
  const value = useMemo<AppCtxValue>(
    () => ({
      ready,
      contextError,
      userId: row.user_id,
      userEmail: row.user_email,

      activeLeagueId: row.active_league_id,
      activeLeagueCompetitionId: row.active_league_competition_id,

      leagueName: row.league_name ?? "—",
      teamName: row.team_name ?? "—",
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

      uiTheme,
      setUiTheme,
    }),
    [
      ready,
      contextError,
      row,
      competitionTheme,
      isAdmin,
      isSuperAdmin,
      drawerOpen,
      uiTheme,
      refresh,
      setActiveLeague,
      setActiveCompetition,
      setUiTheme,
    ]
  );
  
  return (
    <Ctx.Provider value={value}>
      {contextError && (
        <div role="alert" style={contextErrorStyle}>
          <span>{contextError}</span>
          <button type="button" onClick={() => void refresh()} style={contextRetryStyle}>Riprova</button>
        </div>
      )}
      {children}
    </Ctx.Provider>
  );
}

const contextErrorStyle: React.CSSProperties = {
  position: "fixed",
  top: "calc(var(--appbar-safe-top, 0px) + 8px)",
  left: 12,
  right: 12,
  zIndex: 300,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 12px",
  border: "1px solid #fed7aa",
  borderRadius: 12,
  background: "#fff7ed",
  color: "#9a3412",
  boxShadow: "0 8px 24px rgba(15,23,42,.12)",
  fontSize: 12,
  fontWeight: 800,
};

const contextRetryStyle: React.CSSProperties = {
  border: "1px solid #fdba74",
  borderRadius: 8,
  background: "#ffffff",
  color: "#9a3412",
  padding: "6px 9px",
  font: "inherit",
  fontWeight: 900,
  cursor: "pointer",
  flexShrink: 0,
};
