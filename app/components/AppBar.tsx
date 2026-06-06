"use client";

import type { ReactNode } from "react";
import { useApp } from "./AppContext";

export default function AppBar(props: {
  league: string;
  team: string;
  right?: ReactNode;
  onMenuOpen?: () => void;
}) {
  const { competitionTheme } = useApp();
  const isDark = competitionTheme.key === "champions";

  return (
    <div
      className="appbar fc-themed-appbar"
      style={{
        background: competitionTheme.appbarBg,
        borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : competitionTheme.border}`,
        color: isDark ? "white" : competitionTheme.text,
      }}
    >
      <div className="appbar-inner">
        <button
          onClick={props.onMenuOpen}
          aria-label="Apri menu"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: isDark ? "white" : "#374151",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="appbar-logo">
            <span style={{ color: competitionTheme.key === "champions" ? "#ffffff" : competitionTheme.primaryDark }}>
              Fanta
            </span>
            <span style={{ color: competitionTheme.key === "champions" ? competitionTheme.primary : competitionTheme.accent }}>
              Chat
            </span>
          </div>
          <div
            className="appbar-sub"
            style={{
              color: isDark ? "rgba(255,255,255,0.66)" : "var(--muted)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {props.league} · {props.team}
          </div>
        </div>

        <div className="appbar-right">
          {props.right}
        </div>
      </div>
    </div>
  );
}
