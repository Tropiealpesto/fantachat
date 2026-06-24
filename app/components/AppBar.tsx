"use client";

import { useApp } from "./AppContext";

export default function AppBar(props: {
  league: string;
  team: string;
  right?: React.ReactNode;
  onMenuOpen?: () => void;
}) {
  const app = useApp();
  const handleMenu = props.onMenuOpen ?? app.openDrawer;

  return (
    <div className="appbar">
      <div className="appbar-inner">
        <button
          onClick={handleMenu}
          aria-label="Apri menu"
          className="appbar-menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div className="appbar-brand" style={{ flex: 1 }}>
          <div className="appbar-mark" aria-hidden="true">FC</div>

          <div style={{ minWidth: 0 }}>
            <div className="appbar-logo">
              <span className="logo-fanta">Fanta</span>
              <span className="logo-chat">Chat</span>
            </div>

            <div className="appbar-sub">
              {props.league} · {props.team}
            </div>
          </div>
        </div>

        <div className="appbar-right">
          {props.right}
        </div>
      </div>
    </div>
  );
}
