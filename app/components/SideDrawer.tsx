"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { themeFromType } from "../../lib/competitionThemes";

type DrawerCompetition = {
  id: string;
  name: string;
  competition_type: string | null;
  competition_slug: string | null;
  season_name: string | null;
  matchday_number: number | null;
  is_active: boolean;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  teamName: string;
  leagueName: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  competitions: DrawerCompetition[];
  activeLeagueCompetitionId: string | null;
  onSwitchCompetition: (id: string) => void;
};

export default function SideDrawer(props: Props) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    document.body.style.overflow = props.isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [props.isOpen]);

  return (
    <>
      <div onClick={props.onClose} style={{ ...s.overlay, opacity: props.isOpen ? 1 : 0, pointerEvents: props.isOpen ? "auto" : "none" }} />
      <aside style={{ ...s.drawer, transform: props.isOpen ? "translateX(0)" : "translateX(-100%)" }}>
        <header style={s.header}>
          <div style={s.logo}><span style={{ color: "#4ade80" }}>Fanta</span><span style={{ color: "#f97316" }}>Chat</span></div>
          <div style={s.league}>{props.leagueName}</div>
          <div style={s.team}>👋 {props.teamName}</div>
          <button onClick={props.onClose} style={s.close}>×</button>
        </header>

        <div style={s.body}>
          <Section>Navigazione</Section>
          <Nav href="/" label="Home" sub="Dashboard competizione" pathname={pathname} onClose={props.onClose} />
          <Nav href="/rosa" label="Rosa" sub="Invia formazione" pathname={pathname} onClose={props.onClose} />
          <Nav href="/live" label="Live" sub="Classifica in diretta" pathname={pathname} onClose={props.onClose} />
          <Nav href="/chat" label="Chat" sub="Conversazione lega" pathname={pathname} onClose={props.onClose} />
          <Nav href="/classifica" label="Classifica" sub="Ranking competizione" pathname={pathname} onClose={props.onClose} />
          <Nav href="/storico" label="Storico" sub="Giornate passate" pathname={pathname} onClose={props.onClose} />
          <Nav href="/statistiche" label="Statistiche" sub="Giocatori" pathname={pathname} onClose={props.onClose} />
          <Nav href="/podcast" label="Nyx / Podcast" sub="Contenuti narrativi" pathname={pathname} onClose={props.onClose} />
          <AdminLink href="/regole" label="Regole" onClose={props.onClose} />

          <Section style={{ marginTop: 18 }}>Competizioni</Section>
          {props.competitions.length === 0 ? (
            <div style={s.empty}>Nessuna competizione attiva.</div>
          ) : props.competitions.map((comp) => {
            const theme = themeFromType(comp.competition_type);
            const active = comp.id === props.activeLeagueCompetitionId || comp.is_active;
            return (
              <button key={comp.id} onClick={() => props.onSwitchCompetition(comp.id)} style={{ ...s.compBtn, borderColor: active ? theme.primary : "#e5e7eb", background: active ? `${theme.primary}10` : "white" }}>
                <div style={{ ...s.compIcon, background: theme.primary }}>{theme.label.charAt(0)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...s.compName, color: active ? theme.primary : "#111827" }}>{comp.name}</div>
                  <div style={s.compMeta}>{comp.season_name ?? "Stagione"}{comp.matchday_number ? ` · G${comp.matchday_number}` : ""}</div>
                </div>
                {active && <span style={{ ...s.badge, background: theme.primary }}>Attiva</span>}
              </button>
            );
          })}

          {props.isAdmin && (
            <button style={s.addComp} onClick={() => { props.onClose(); router.push("/admin/competizione/nuova"); }}>
              + Aggiungi competizione
            </button>
          )}

          {props.isAdmin && (
            <>
              <Section style={{ marginTop: 18 }}>Admin competizione</Section>
              <div style={s.adminBox}>
                <AdminLink href="/admin" label="Dashboard admin" onClose={props.onClose} />
                <AdminLink href="/admin/giornata" label="Giornata" onClose={props.onClose} />
                <AdminLink href="/admin/regole" label="Regole" onClose={props.onClose} />
                <AdminLink href="/admin/voti" label="Voti" onClose={props.onClose} />
                <AdminLink href="/admin/podcast" label="Nyx / Podcast" onClose={props.onClose} />
              </div>
            </>
          )}

          {props.isSuperAdmin && (
            <>
              <Section style={{ marginTop: 18 }}>Superadmin</Section>
              <div style={s.adminBox}>
                <AdminLink href="/superadmin" label="Console globale" onClose={props.onClose} />
              </div>
            </>
          )}
        </div>

        <footer style={s.footer}>
          <button style={s.exit} onClick={() => { props.onClose(); router.push("/seleziona-lega"); }}>Cambia lega</button>
          <div style={s.copy}>FantaChat © 2026</div>
        </footer>
      </aside>
    </>
  );
}

function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ ...s.section, ...style }}>{children}</div>;
}

function Nav({ href, label, sub, pathname, onClose }: { href: string; label: string; sub: string; pathname: string; onClose: () => void }) {
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return <Link href={href} onClick={onClose} style={{ ...s.nav, background: active ? "#f0fdf4" : "white", borderColor: active ? "#86efac" : "#e5e7eb" }}><b>{label}</b><small>{sub}</small></Link>;
}

function AdminLink({ href, label, onClose }: { href: string; label: string; onClose: () => void }) {
  return <Link href={href} onClick={onClose} style={s.adminLink}>{label}</Link>;
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.38)", zIndex: 200, transition: "opacity .2s" },
  drawer: { position: "fixed", top: 0, left: 0, bottom: 0, width: 315, maxWidth: "88vw", background: "#fff", zIndex: 201, display: "flex", flexDirection: "column", transition: "transform .25s ease", boxShadow: "4px 0 24px rgba(0,0,0,.14)" },
  header: { position: "relative", padding: "42px 20px 20px", background: "linear-gradient(135deg,#14532d,#15803d)", color: "white" },
  close: { position: "absolute", top: 14, right: 14, width: 32, height: 32, borderRadius: 10, border: 0, background: "rgba(255,255,255,.18)", color: "white", fontSize: 24, cursor: "pointer" },
  logo: { fontSize: 24, fontWeight: 900 }, league: { marginTop: 8, opacity: .7, fontSize: 12 }, team: { marginTop: 4, fontWeight: 800 },
  body: { flex: 1, overflowY: "auto", padding: 14 },
  section: { fontSize: 11, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: ".08em", margin: "8px 4px" },
  nav: { display: "grid", gap: 2, padding: 12, border: "1px solid #e5e7eb", borderRadius: 12, marginBottom: 7, textDecoration: "none" },
  compBtn: { width: "100%", display: "flex", alignItems: "center", gap: 10, border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, marginBottom: 7, background: "white", cursor: "pointer", textAlign: "left", fontFamily: "inherit" },
  compIcon: { width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", color: "white", fontWeight: 900 },
  compName: { fontWeight: 800, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  compMeta: { color: "#6b7280", fontSize: 11, marginTop: 2 },
  badge: { color: "white", fontSize: 10, fontWeight: 800, borderRadius: 99, padding: "2px 8px" },
  addComp: { width: "100%", border: "1.5px dashed #d1d5db", background: "#f9fafb", color: "#6b7280", borderRadius: 12, padding: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" },
  adminBox: { background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: 8 },
  adminLink: { display: "block", background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10, marginBottom: 6, fontWeight: 700, fontSize: 13 },
  footer: { padding: 16, borderTop: "1px solid #f3f4f6", background: "#fafafa" },
  exit: { width: "100%", border: "1px solid #e5e7eb", background: "white", borderRadius: 10, padding: 12, fontWeight: 800, cursor: "pointer" },
  copy: { marginTop: 10, textAlign: "center", color: "#cbd5e1", fontSize: 11 },
  empty: { color: "#6b7280", fontSize: 13, fontWeight: 700, padding: 8 },
};
