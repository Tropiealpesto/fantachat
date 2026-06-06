"use client";

import { usePathname, useRouter } from "next/navigation";
import { useApp } from "./AppContext";

const TABS = [
  { path: "/", label: "Home", icon: "🏠" },
  { path: "/live", label: "Live", icon: "🔴" },
  { path: "/rosa", label: "Rosa", icon: "👕" },
  { path: "/chat", label: "Chat", icon: "💬" },
  { path: "/classifica", label: "Classifica", icon: "🏆" },
];

interface BottomNavProps {
  onMenuOpen?: () => void;
  unreadCount?: number;
}

export default function BottomNav({ unreadCount = 0 }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { competitionTheme } = useApp();

  const isDark = competitionTheme.key === "champions";
  const activeColor = competitionTheme.primary;
  const inactiveColor = isDark ? "rgba(255,255,255,0.64)" : "#6B7280";

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <>
      <div style={{ height: "70px" }} />
      <nav
        className="fc-themed-bottom-nav"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "70px",
          background: competitionTheme.navBg,
          borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : competitionTheme.border}`,
          display: "flex",
          alignItems: "stretch",
          zIndex: 100,
          boxShadow: isDark ? "0 -8px 24px rgba(2,6,23,0.38)" : "0 -2px 16px rgba(0,0,0,0.06)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
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
              {active && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: "16%",
                    right: "16%",
                    height: "2.5px",
                    background: activeColor,
                    borderRadius: "0 0 3px 3px",
                  }}
                />
              )}

              <div style={{ position: "relative" }}>
                <span
                  style={{
                    fontSize: "20px",
                    filter: active ? "none" : "grayscale(0.5) opacity(0.65)",
                    transition: "filter 0.15s",
                  }}
                >
                  {tab.icon}
                </span>

                {tab.path === "/chat" && unreadCount > 0 && (
                  <div
                    style={{
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
                    }}
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </div>
                )}
              </div>

              <span
                style={{
                  fontSize: "10px",
                  color: active ? activeColor : inactiveColor,
                  fontWeight: active ? 800 : 600,
                  transition: "color 0.15s",
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
