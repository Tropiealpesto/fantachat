"use client";

export default function AppBar(props: {
  league: string;
  team: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="appbar">
      <div className="appbar-inner">
        <div style={{ lineHeight: 1.1 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 1000,
              letterSpacing: "-0.02em",
            }}
          >
            <span style={{ color: "var(--primary-dark)" }}>Fanta</span>
            <span style={{ color: "var(--accent-dark)" }}>Chat</span>
          </div>

          <div
            style={{
              marginTop: 2,
              color: "var(--muted)",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            {props.league} • {props.team}
          </div>
        </div>

        <div>{props.right}</div>
      </div>
    </div>
  );
}
