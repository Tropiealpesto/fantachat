"use client";

import { useApp } from "../components/AppContext";
import ChatPage from "../components/ChatPage";

export default function Chat() {
  const { activeLeagueId, teamId, teamName } = useApp();

  if (!activeLeagueId || !teamId) {
    return (
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        height: "100dvh",
        color: "#9CA3AF" 
      }}>
        Caricamento...
      </div>
    );
  }

  return (
    <div style={{ height: "calc(100dvh - 70px)" }}>
      <ChatPage
        leagueId={activeLeagueId}
        currentTeamId={teamId}
        currentTeamName={teamName}
      />
    </div>
  );
}