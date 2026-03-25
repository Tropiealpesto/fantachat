"use client";

export default function AppBar(props: {
  league: string;
  team: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="appbar">
      <div className="appbar-inner">
        <div>
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
