"use client";

export default function AppBar(props: {
  league: string;
  team: string;
  right?: React.ReactNode;
  onMenuOpen?: () => void;
}) {
  return (
    <div className="appbar">
      <div className="appbar-inner">
        {/* Hamburger a sinistra */}
        <button
          onClick={props.onMenuOpen}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Logo e sottotitolo */}
        <div style={{ flex: 1 }}>
          <div className="appbar-logo">
            <span className="logo-fanta">Fanta</span>
            <span className="logo-chat">Chat</span>
          </div>
          <div className="appbar-sub">
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