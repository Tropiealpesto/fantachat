"use client";

import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { path: "/",           label: "Home",       icon: "🏠", color: "#16A34A" },
  { path: "/live",       label: "Live",       icon: "⚡", color: "#F97316" },
  { path: "/chat",       label: "Chat",       icon: "💬", color: "#16A34A" },
  { path: "/classifica", label: "Classifica", icon: "🏆", color: "#F97316" },
];

interface BottomNavProps {
  onMenuOpen: () => void;
  unreadCount?: number;
}

export default function BottomNav({ onMenuOpen, unreadCount = 0 }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <>
      {/* Spacer per evitare che il contenuto finisca sotto la nav */}
      <div style={{ height: "70px" }} />

      <nav style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "70px",
        background: "white",
        borderTop: "1px solid #E5E7EB",
        display: "flex",
        alignItems: "stretch",
        zIndex: 100,
        boxShadow: "0 -2px 16px rgba(0,0,0,0.06)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>

        {/* Hamburger menu */}
        <button
          onClick={onMenuOpen}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "4px",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "8px 4px",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <span style={{ fontSize: "10px", color: "#6B7280", fontWeight: 500 }}>
            Menu
          </span>
        </button>

        {/* Tab principali */}
        {TABS.map((tab) => {
          const active = isActive(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => router.push(tab.path)}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "3px",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "8px 4px",
                position: "relative",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {/* Indicatore attivo in cima */}
              {active && (
                <div style={{
                  position: "absolute",
                  top: 0,
                  left: "15%",
                  right: "15%",
                  height: "2.5px",
                  background: tab.color,
                  borderRadius: "0 0 3px 3px",
                }} />
              )}

              {/* Icona con badge per Chat */}
              <div style={{ position: "relative" }}>
                <span style={{
                  fontSize: "20px",
                  filter: active ? "none" : "grayscale(0.4) opacity(0.6)",
                  transition: "filter 0.15s",
                }}>
                  {tab.icon}
                </span>

                {/* Badge messaggi non letti (solo su Chat) */}
                {tab.path === "/chat" && unreadCount > 0 && (
                  <div style={{
                    position: "absolute",
                    top: "-4px",
                    right: "-8px",
                    background: "#EF4444",
                    color: "white",
                    borderRadius: "10px",
                    fontSize: "9px",
                    fontWeight: 700,
                    padding: "1px 5px",
                    minWidth: "16px",
                    textAlign: "center",
                    lineHeight: "14px",
                    border: "1.5px solid white",
                  }}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </div>
                )}
              </div>

              {/* Label */}
              <span style={{
                fontSize: "10px",
                color: active ? tab.color : "#6B7280",
                fontWeight: active ? 700 : 500,
                transition: "color 0.15s",
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}