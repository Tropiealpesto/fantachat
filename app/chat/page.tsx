"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRequireApp } from "../hooks/useRequireApp";
import AppBar from "../components/AppBar";
import ChatPage from "../components/ChatPage";
import BottomNav from "../components/BottomNav";

type Competition = {
  id: string;
  name: string;
  competition_type: string | null;
};

export default function Chat() {
  const app = useRequireApp(false);
  const [competitions, setCompetitions] = useState<Competition[]>([]);

  useEffect(() => {
    if (!app.activeLeagueId) return;

    supabase
      .rpc("get_league_competitions", {
        p_league_id: app.activeLeagueId,
      })
      .then(({ data }) => {
        setCompetitions(
          ((data ?? []) as any[]).map((r) => ({
            id: r.id,
            name: r.name,
            competition_type: r.competition_type,
          }))
        );
      });
  }, [app.activeLeagueId]);

  if (!app.activeLeagueId || !app.userId) {
    return (
      <div style={s.loading}>
        Caricamento...
      </div>
    );
  }

  return (
    <>
      <AppBar
        league={app.leagueName}
        team={app.teamName}
        onMenuOpen={app.openDrawer}
        right={
          <button
            style={s.topBtn}
            onClick={() => window.location.assign("/seleziona-lega")}
          >
            Leghe
          </button>
        }
      />

      <div style={s.page}>
        <ChatPage
          leagueId={app.activeLeagueId}
          currentUserId={app.userId}
          currentTeamName={app.teamName}
          activeLeagueCompetitionId={app.activeLeagueCompetitionId}
          competitions={competitions}
        />
      </div>

      <BottomNav />
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    height:
      "calc(100dvh - var(--appbar-h) - var(--appbar-safe-top) - var(--nav-h) - var(--safe-bottom))",
    background: "#f4f7f4",
  },
  loading: {
    display: "grid",
    placeItems: "center",
    height: "100dvh",
    background: "#f4f7f4",
    color: "#64748b",
    fontWeight: 900,
  },
  topBtn: {
    border: "1px solid var(--brand-orange-border)",
    background: "var(--brand-orange-soft)",
    color: "var(--brand-orange)",
    borderRadius: 14,
    padding: "8px 14px",
    fontWeight: 900,
    fontFamily: "inherit",
    cursor: "pointer",
  },
};
