"use client";

import { useApp } from "../components/AppContext";
import ChatPage from "../components/ChatPage";
import BottomNav from "../components/BottomNav";

export default function Chat() {
  const { activeLeagueId, userId, teamName } = useApp();

  if (!activeLeagueId || !userId) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100dvh", color: "#9CA3AF" }}>
        Caricamento...
      </div>
    );
  }

  return (
    <>
      <div style={{ height: "calc(100dvh - 70px)" }}>
        <ChatPage
          leagueId={activeLeagueId}
          currentUserId={userId}
          currentTeamName={teamName}
        />
      </div>
      <BottomNav />
    </>
  );
}