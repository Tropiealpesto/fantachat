"use client";

import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { path: "/", label: "Home" },
  { path: "/live", label: "Live" },
  { path: "/rosa", label: "Rosa" },
  { path: "/chat", label: "Chat" },
  { path: "/classifica", label: "Classifica" },
];

interface BottomNavProps { onMenuOpen?: () => void; unreadCount?: number; }

function Icon({ path, active }: { path: string; active: boolean }) {
  const p = { width: 23, height: 23, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: active ? 2.35 : 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (path) {
    case "/": return (<svg {...p}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>);
    case "/live": return (<svg {...p}><path d="M3 12h4l2 6 4-15 2 9h6" /></svg>);
    case "/rosa": return (<svg {...p}><path d="M8 3l-4 2 2 4 2-1v13h8V8l2 1 2-4-4-2-2 2h-2z" /></svg>);
    case "/chat": return (<svg {...p}><path d="M21 11.5a8 8 0 0 1-11.5 7.2L4 20.5l1.8-5.5A8 8 0 1 1 21 11.5z" /></svg>);
    case "/classifica": return (<svg {...p}><path d="M8 4h8v4a4 4 0 0 1-8 0z" /><path d="M6 4H4v1a3 3 0 0 0 3 3M18 4h2v1a3 3 0 0 1-3 3M9 14h6M10 18h4M12 12v6" /></svg>);
    default: return null;
  }
}

export default function BottomNav({ unreadCount = 0 }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (path: string) => (path === "/" ? pathname === "/" : pathname.startsWith(path));

  return (
    <>
      <div className="fc-bottom-spacer" />
      <nav className="fc-bottom-nav" aria-label="Navigazione principale">
        {TABS.map((tab) => {
          const active = isActive(tab.path);
          return (
            <button
              key={tab.path}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => router.push(tab.path)}
              className={`fc-bottom-tab${active ? " is-active" : ""}`}
            >
              <div className="fc-bottom-icon">
                <Icon path={tab.path} active={active} />
                {tab.path === "/chat" && unreadCount > 0 && (
                  <div className="fc-unread-badge">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </div>
                )}
              </div>
              <span className="fc-bottom-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
