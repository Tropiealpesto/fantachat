"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../components/AppContext";

export function useRequireApp(requireCompetition = false) {
  const app = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!app.ready) return;

    if (!app.userId) {
      router.replace("/login");
      return;
    }

    if (!app.activeLeagueId) {
      router.replace("/seleziona-lega");
      return;
    }

    // Non facciamo redirect se manca solo la competizione:
    // la Home gestisce questo caso.
    if (requireCompetition && !app.activeLeagueCompetitionId) {
      console.warn("Manca activeLeagueCompetitionId, ma non faccio redirect.");
      return;
    }
  }, [
    app.ready,
    app.userId,
    app.activeLeagueId,
    app.activeLeagueCompetitionId,
    requireCompetition,
    router,
  ]);

  return app;
}

export function useRequireLeagueAdmin() {
  const app = useRequireApp(false);
  const router = useRouter();

  useEffect(() => {
    if (!app.ready) return;
    if (!app.userId) return;
    if (!app.activeLeagueId) return;

    if (!app.isAdmin) {
      router.replace("/");
      return;
    }
  }, [
    app.ready,
    app.userId,
    app.activeLeagueId,
    app.isAdmin,
    router,
  ]);

  return app;
}

export function useRequireSuperAdmin() {
  const app = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!app.ready) return;

    if (!app.userId) {
      router.replace("/login");
      return;
    }

    if (!app.isSuperAdmin) {
      router.replace("/");
      return;
    }
  }, [
    app.ready,
    app.userId,
    app.isSuperAdmin,
    router,
  ]);

  return app;
}