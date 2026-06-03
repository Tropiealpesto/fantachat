"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "./AppContext";
import { THEMES, DEFAULT_THEME } from "../page";
import type { CompetitionTheme } from "../page";

// ─── TIPI ─────────────────────────────────────────────────────────────────────

type Competition = {
  id: string;
  name: string;
  slug: string;
  season_id: string;
  matchday_number: number | null;
  team_count: number;
  is_active: boolean;
};

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  teamName?: string;
  leagueName?: string;
  isAdmin?: boolean;
  competitions?: Competition[];
  activeCompetitionId?: string | null;
  onSwitchCompetition?: (competitionId: string) => void;
  onAddCompetition?: () => void;
}

// ─── COMPONENTE ───────────────────────────────────────────────────────────────

export default function SideDrawer({
  isOpen, onClose, teamName, leagueName,
  isAdmin = false,
  competitions = [],
  activeCompetitionId,
  onSwitchCompetition,
  onAddCompetition,
}: SideDrawerProps) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const getCompTheme = (slug: string): CompetitionTheme =>
    THEMES[slug] ?? DEFAULT_THEME;

  const getCompIcon = (slug: string) => {
    if (slug.includes("champions")) return "ti-star";
    if (slug.includes("mondial") || slug.includes("europeo")) return "ti-world";
    return "ti-trophy";
  };

  const getCompIconBg = (slug: string) => {
    if (slug.includes("champions")) return "#1a4fd6";
    if (slug.includes("mondial") || slug.includes("europeo"))
      return "linear-gradient(135deg,#dc2626,#2563eb)";
    return "#16a34a";
  };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 200,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? "all" : "none",
          transition: "opacity 0.25s ease",
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, left: 0, bottom: 0,
        width: 300, maxWidth: "85vw",
        background: "white", zIndex: 201,
        transform: isOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
        display: "flex", flexDirection: "column",
        boxShadow: "4px 0 24px rgba(0,0,0,0.12)",
      }}>

        {/* ── HEADER ── */}
        <div style={{
          background: "linear-gradient(135deg, #1a5c2e 0%, #2d7a45 100%)",
          padding: "48px 20px 20px", flexShrink: 0,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: "#4ADE80" }}>Fanta</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: "#F97316" }}>Chat</span>
              </div>
              {leagueName && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginBottom: 4 }}>
                  {leagueName}
                </div>
              )}
              {teamName && (
                <div style={{ fontSize: 16, fontWeight: 700, color: "white", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>👋</span> {teamName}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.15)", border: "none",
                borderRadius: 8, padding: 6, cursor: "pointer",
                color: "white", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── CONTENUTO SCROLLABILE ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px" }}>

          {/* Navigazione */}
          <SectionLabel>Navigazione</SectionLabel>
          <NavItem href="/rosa"        icon="users"     label="Rosa"        subtitle="Scegli i 4 giocatori"      pathname={pathname} onClose={onClose} />
          <NavItem href="/statistiche" icon="chart-bar"  label="Statistiche" subtitle="Giocatori e classifiche"   pathname={pathname} onClose={onClose} />
          <NavItem href="/storico"     icon="calendar"   label="Storico"     subtitle="Rivedi le giornate passate" pathname={pathname} onClose={onClose} />

          {/* Competizioni */}
          <SectionLabel style={{ marginTop: 20 }}>Competizioni</SectionLabel>

          {competitions.map((comp) => {
            const isActive = comp.id === activeCompetitionId;
            const iconBg = getCompIconBg(comp.slug);
            const iconClass = getCompIcon(comp.slug);
            const theme = getCompTheme(comp.slug);

            return (
              <button
                key={comp.id}
                onClick={() => {
                  if (!isActive && onSwitchCompetition) onSwitchCompetition(comp.id);
                  onClose();
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 12, marginBottom: 6,
                  border: isActive ? `1px solid ${theme.primary}4D` : "1px solid #e5e7eb",
                  background: isActive ? `${theme.primary}0A` : "transparent",
                  cursor: "pointer", width: "100%", textAlign: "left",
                  fontFamily: "inherit",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: iconBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {iconClass === "ti-star" && <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />}
                    {iconClass === "ti-world" && <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></>}
                    {iconClass === "ti-trophy" && <><path d="M6 9H4a2 2 0 01-2-2V5a2 2 0 012-2h2M18 9h2a2 2 0 002-2V5a2 2 0 00-2-2h-2M9 22h6M12 17v5" /><path d="M6 3v7a6 6 0 006 6 6 6 0 006-6V3" /></>}
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: isActive ? 700 : 500,
                    color: isActive ? theme.primary : "#111827",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {comp.name}
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
                    {comp.matchday_number ? `Giornata ${comp.matchday_number}` : "Non iniziato"}
                    {" · "}{comp.team_count} squadre
                  </div>
                </div>
                {isActive ? (
                  <span style={{
                    fontSize: 10, background: theme.primary, color: "white",
                    borderRadius: 20, padding: "2px 8px", fontWeight: 700,
                    flexShrink: 0,
                  }}>Attiva</span>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                )}
              </button>
            );
          })}

          {/* Aggiungi competizione (solo admin) */}
          {isAdmin && (
            <button
              onClick={() => {
                onClose();
                if (onAddCompetition) onAddCompetition();
                else router.push("/admin/competizione/nuova");
              }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", padding: 12, marginTop: 4,
                background: "#f9fafb", border: "1.5px dashed #d1d5db",
                borderRadius: 12, cursor: "pointer",
                fontSize: 13, fontWeight: 600, color: "#6b7280",
                fontFamily: "inherit",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Aggiungi competizione
            </button>
          )}

          {/* Admin Lega */}
          {isAdmin && (
            <>
              <SectionLabel style={{ marginTop: 20 }} icon>Admin lega</SectionLabel>
              <div style={{
                background: "#FFF7ED", borderRadius: 12, padding: 10,
                border: "1px solid #FED7AA",
              }}>
                <AdminBtn href="/admin/giornata" icon="calendar" label="Giornata" onClose={onClose} />
                <AdminBtn href="/admin/regole"   icon="file-text" label="Regole lega" onClose={onClose} />
                <AdminBtn href="/admin/podcast"  icon="microphone" label="Podcast" onClose={onClose} />
              </div>
            </>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div style={{
          padding: "16px 20px", borderTop: "1px solid #F3F4F6",
          background: "#FAFAFA", flexShrink: 0,
        }}>
          <button
            onClick={() => { onClose(); router.push("/seleziona-lega"); }}
            style={{
              width: "100%", padding: 12, background: "none",
              border: "1.5px solid #E5E7EB", borderRadius: 10, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, fontSize: 14, color: "#6B7280", fontWeight: 600,
              marginBottom: 12, fontFamily: "inherit",
            }}
          >
            🚪 Esci dalla lega
          </button>
          <div style={{ fontSize: 11, color: "#D1D5DB", textAlign: "center" }}>
            FantaChat © 2026
          </div>
        </div>
      </div>
    </>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function SectionLabel({ children, style, icon }: { children: React.ReactNode; style?: React.CSSProperties; icon?: boolean }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: "#9CA3AF",
      letterSpacing: "0.08em", textTransform: "uppercase",
      padding: "0 4px", marginBottom: 8,
      display: "flex", alignItems: "center", gap: 6,
      ...style,
    }}>
      {icon && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14" />
        </svg>
      )}
      {children}
    </div>
  );
}

function NavItem({ href, icon, label, subtitle, pathname, onClose }: {
  href: string; icon: string; label: string; subtitle: string;
  pathname: string; onClose: () => void;
}) {
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));

  const iconSvg: Record<string, React.ReactNode> = {
    "users": <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></>,
    "chart-bar": <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
    "calendar": <><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  };

  return (
    <Link href={href} onClick={onClose} style={{ textDecoration: "none" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "12px 14px", borderRadius: 12,
        background: active ? "rgba(22,163,74,0.06)" : "transparent",
        marginBottom: 4, cursor: "pointer",
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: active ? "rgba(22,163,74,0.12)" : "#F3F4F6",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: active ? "#16A34A" : "#6B7280", flexShrink: 0,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {iconSvg[icon]}
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: active ? 700 : 500, color: active ? "#16A34A" : "#111827" }}>
            {label}
          </div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 1 }}>{subtitle}</div>
        </div>
        {active && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#16A34A" }} />}
      </div>
    </Link>
  );
}

function AdminBtn({ href, icon, label, onClose }: {
  href: string; icon: string; label: string; onClose: () => void;
}) {
  const iconSvg: Record<string, React.ReactNode> = {
    "calendar": <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
    "file-text": <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14,2 14,8 20,8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>,
    "microphone": <><circle cx="12" cy="11" r="4" /><path d="M12 15v6M8 19h8M6 6.9a7 7 0 0112 0" /></>,
  };

  return (
    <Link href={href} onClick={onClose} style={{ textDecoration: "none" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px", borderRadius: 10,
        background: "white", border: "1px solid #E5E7EB",
        marginBottom: 6, cursor: "pointer",
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {iconSvg[icon]}
        </svg>
        <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{label}</span>
      </div>
    </Link>
  );
}
