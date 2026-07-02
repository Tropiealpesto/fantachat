"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { themeFromType } from "../../lib/competitionThemes";
import TeamBadge from "./TeamBadge";

type DrawerCompetition = {
  id: string; name: string; competition_type: string | null; competition_slug: string | null;
  season_name: string | null; matchday_number: number | null; is_active: boolean;
};
type Props = {
  isOpen: boolean; onClose: () => void; teamName: string; leagueName: string;
  isAdmin: boolean; isSuperAdmin: boolean; competitions: DrawerCompetition[];
  activeLeagueCompetitionId: string | null; onSwitchCompetition: (id: string) => void;
  teamPrimary?: string | null; teamSecondary?: string | null;
  uiTheme: "light" | "dark"; onThemeChange: (theme: "light" | "dark") => void;
};

export default function SideDrawer(props: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const dark = props.uiTheme === "dark";
  useEffect(() => { document.body.style.overflow = props.isOpen ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [props.isOpen]);

  return (
    <>
      <div onClick={props.onClose} style={{ ...s.overlay, opacity: props.isOpen ? 1 : 0, pointerEvents: props.isOpen ? "auto" : "none" }} />
      <aside style={{ ...s.drawer, transform: props.isOpen ? "translateX(0)" : "translateX(-100%)" }}>
        <header style={s.header}>
          <div style={s.logoWrap}>
            <span style={s.mark}>FC</span>
            <div style={s.logo}><span style={{ color: "#bbf7d0" }}>Fanta</span><span style={{ color: "#f4c99d" }}>Chat</span></div>
          </div>
          <button onClick={props.onClose} style={s.close} aria-label="Chiudi menu">×</button>
          <div style={s.teamrow}>
            <span style={s.tring}><TeamBadge name={props.teamName} primary={props.teamPrimary ?? null} secondary={props.teamSecondary ?? null} size={40} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={s.tname}>{props.teamName}</div>
              <div style={s.tleague}>{props.leagueName}</div>
            </div>
          </div>
        </header>

        <div style={s.body}>
          <Section>Competizioni</Section>
          {props.competitions.length === 0 ? (
            <div style={s.empty}>Nessuna competizione attiva.</div>
          ) : props.competitions.map((comp) => {
            const theme = themeFromType(comp.competition_type);
            const active = comp.id === props.activeLeagueCompetitionId || comp.is_active;
            return (
              <button key={comp.id} onClick={() => props.onSwitchCompetition(comp.id)} style={{ ...s.comp, borderColor: active ? theme.primary : "var(--drawer-border)", background: active ? `${theme.primary}18` : "var(--drawer-card)" }}>
                <div style={{ ...s.cicon, background: theme.primary }}>{theme.label.charAt(0)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...s.cname, color: active ? theme.primary : "var(--drawer-text)" }}>{comp.name}</div>
                  <div style={s.cmeta}>{comp.season_name ?? "Stagione"}{comp.matchday_number ? ` · G${comp.matchday_number}` : ""}</div>
                </div>
                {active && <span style={{ ...s.cbadge, background: theme.primary }}>Attiva</span>}
              </button>
            );
          })}
          {props.isAdmin && (
            <button style={s.addcomp} onClick={() => { props.onClose(); router.push("/admin/competizione/nuova"); }}>+ Aggiungi competizione</button>
          )}

          <Section style={{ marginTop: 18 }}>La tua squadra</Section>
          <Item href="/personalizza" title="Personalizza" sub="Colori dello stemma" pathname={pathname} onClose={props.onClose} icon={<><path d="M12 3l5 5a7 7 0 1 1-10 0z" /></>} />

          <Section style={{ marginTop: 18 }}>Esplora</Section>
          <Item href="/storico" title="Storico" sub="Giornate passate" pathname={pathname} onClose={props.onClose} icon={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} />
          <Item href="/statistiche" title="Statistiche" sub="Giocatori" pathname={pathname} onClose={props.onClose} icon={<><path d="M4 20V11M9.5 20V5M15 20v-8M20.5 20V8" /><path d="M3 20h18" /></>} />
          <Item href="/podcast" title="Nyx / Podcast" sub="Contenuti narrativi" pathname={pathname} onClose={props.onClose} icon={<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" /></>} />
          <Item href="/regole" title="Regole" sub="Punteggi e bonus" pathname={pathname} onClose={props.onClose} icon={<><path d="M5 4a1 1 0 0 1 1-1h12v18H6a1 1 0 0 0-1 1z" /><path d="M18 3v18M9 8h6M9 12h5" /></>} />

          {props.isAdmin && (
            <>
              <Section style={{ marginTop: 18 }}>Admin competizione</Section>
              <div style={s.adminbox}>
                <AdminLink href="/admin" label="Dashboard admin" onClose={props.onClose} icon={<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>} />
                <AdminLink href="/admin/giornata" label="Giornata" onClose={props.onClose} icon={<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>} />
                <AdminLink href="/admin/voti" label="Voti" onClose={props.onClose} icon={<><path d="M5 12l4 4L19 6" /></>} />
                <AdminLink href="/admin/podcast" label="Nyx / Podcast" onClose={props.onClose} icon={<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>} />
              </div>
            </>
          )}

          {props.isSuperAdmin && (
            <>
              <Section style={{ marginTop: 18 }}>Superadmin</Section>
              <div style={s.adminbox}>
                <AdminLink href="/superadmin" label="Console globale" onClose={props.onClose} icon={<><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /></>} />
              </div>
            </>
          )}
        </div>

        <footer style={s.footer}>
          <div style={s.legalBox} aria-label="Documenti legali">
            <Link href="/privacy" onClick={props.onClose} style={s.legalLink}>Privacy</Link>
            <Link href="/termini" onClick={props.onClose} style={s.legalLink}>Termini</Link>
            <Link href="/cancellazione-account" onClick={props.onClose} style={s.legalLink}>Account</Link>
          </div>
          <div style={s.themeBox}>
            <div>
              <div style={s.themeTitle}>Tema</div>
              <div style={s.themeSub}>{dark ? "Scuro fluo" : "Chiaro classico"}</div>
            </div>
            <div style={s.themeSwitch}>
              <button
                type="button"
                onClick={() => props.onThemeChange("light")}
                style={{ ...s.themeBtn, ...(props.uiTheme === "light" ? s.themeBtnOn : {}) }}
              >
                Chiaro
              </button>
              <button
                type="button"
                onClick={() => props.onThemeChange("dark")}
                style={{ ...s.themeBtn, ...(props.uiTheme === "dark" ? s.themeBtnOnDark : {}) }}
              >
                Scuro
              </button>
            </div>
          </div>
          <button style={s.exit} onClick={() => { props.onClose(); router.push("/seleziona-lega"); }}>
            <svg viewBox="0 0 24 24" style={s.exitIco}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            Cambia lega
          </button>
        </footer>
      </aside>
    </>
  );
}

function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ ...s.section, ...style }}>{children}</div>;
}
function Item({ href, title, sub, icon, pathname, onClose }: { href: string; title: string; sub: string; icon: React.ReactNode; pathname: string; onClose: () => void }) {
  const active = pathname.startsWith(href);
  return (
    <Link href={href} onClick={onClose} style={{ ...s.item, background: active ? "var(--drawer-active-bg)" : "var(--drawer-card)", borderColor: active ? "var(--drawer-active-border)" : "var(--drawer-border)" }}>
      <svg viewBox="0 0 24 24" style={{ ...s.itemIco, stroke: active ? "var(--fc-primary)" : "var(--drawer-muted)" }}>{icon}</svg>
      <div><div style={s.itemT}>{title}</div><div style={s.itemS}>{sub}</div></div>
    </Link>
  );
}
function AdminLink({ href, label, icon, onClose }: { href: string; label: string; icon: React.ReactNode; onClose: () => void }) {
  return <Link href={href} onClick={onClose} style={s.alink}><svg viewBox="0 0 24 24" style={s.alinkIco}>{icon}</svg>{label}</Link>;
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(13,24,18,.42)", zIndex: 200, transition: "opacity .2s", backdropFilter: "blur(3px)" },
  drawer: { position: "fixed", top: 0, left: 0, bottom: 0, width: 326, maxWidth: "90vw", background: "var(--drawer-bg)", zIndex: 201, display: "flex", flexDirection: "column", transition: "transform .25s ease", boxShadow: "18px 0 46px rgba(13,24,18,.22)" },
  header: { position: "relative", padding: "calc(var(--appbar-safe-top) + 20px) 20px 18px", background: "var(--drawer-header)", color: "white", boxShadow: "inset 0 -1px 0 rgba(255,255,255,.16)" },
  logoWrap: { display: "flex", alignItems: "center", gap: 10 },
  mark: { width: 34, height: 34, borderRadius: 12, display: "grid", placeItems: "center", background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.22)", color: "white", fontWeight: 900, fontSize: 13 },
  logo: { fontSize: 23, fontWeight: 1000, letterSpacing: 0 },
  close: { position: "absolute", top: "calc(var(--appbar-safe-top) + 10px)", right: 14, width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.13)", color: "white", fontSize: 21, cursor: "pointer", lineHeight: 1 },
  teamrow: { display: "flex", alignItems: "center", gap: 10, marginTop: 14 },
  tring: { borderRadius: "50%", border: "2px solid rgba(255,255,255,.6)", padding: 1, display: "grid", placeItems: "center", flexShrink: 0 },
  tname: { fontWeight: 1000, fontSize: 15, lineHeight: 1.1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  tleague: { fontSize: 11, opacity: .8, fontWeight: 700, marginTop: 2 },
  body: { flex: 1, overflowY: "auto", padding: 14, background: "var(--drawer-bg)" },
  section: { fontSize: 10.5, fontWeight: 1000, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".07em", margin: "6px 4px 9px" },
  comp: { width: "100%", display: "flex", alignItems: "center", gap: 11, border: "1px solid var(--drawer-border)", borderRadius: 16, padding: 10, marginBottom: 8, cursor: "pointer", textAlign: "left", fontFamily: "inherit", boxShadow: "var(--drawer-shadow)" },
  cicon: { width: 36, height: 36, borderRadius: "50%", display: "grid", placeItems: "center", color: "white", fontWeight: 900, flexShrink: 0 },
  cname: { fontWeight: 1000, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  cmeta: { color: "var(--drawer-muted)", fontSize: 11, marginTop: 1, fontWeight: 700 },
  cbadge: { marginLeft: "auto", color: "white", fontSize: 9.5, fontWeight: 1000, borderRadius: 999, padding: "3px 9px" },
  addcomp: { width: "100%", border: "1px dashed var(--drawer-border)", background: "var(--drawer-card)", color: "var(--drawer-muted)", borderRadius: 14, padding: 11, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" },
  item: { display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", border: "1px solid var(--drawer-border)", borderRadius: 14, marginBottom: 7, textDecoration: "none", background: "var(--drawer-card)", boxShadow: "var(--drawer-shadow)" },
  itemIco: { width: 20, height: 20, fill: "none", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", flexShrink: 0 },
  itemT: { fontWeight: 900, fontSize: 13.5, color: "var(--drawer-text)" },
  itemS: { fontSize: 11, color: "var(--drawer-muted)", fontWeight: 700 },
  adminbox: { background: "var(--drawer-warm)", border: "1px solid var(--brand-orange-border)", borderRadius: 16, padding: 8 },
  alink: { display: "flex", alignItems: "center", gap: 10, background: "var(--drawer-card)", border: "1px solid var(--drawer-border)", borderRadius: 12, padding: "9px 11px", marginBottom: 6, fontWeight: 800, fontSize: 12.5, color: "var(--drawer-text)", textDecoration: "none" },
  alinkIco: { width: 17, height: 17, fill: "none", stroke: "#b45309", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", flexShrink: 0 },
  footer: { padding: "12px 14px calc(14px + var(--safe-bottom))", borderTop: "1px solid var(--drawer-border)", background: "var(--drawer-bg)", display: "grid", gap: 9 },
  legalBox: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 },
  legalLink: { border: "1px solid var(--drawer-border)", background: "var(--drawer-card)", borderRadius: 12, padding: "8px 4px", textAlign: "center", color: "var(--drawer-muted)", fontSize: 10.5, fontWeight: 900, textDecoration: "none" },
  themeBox: { display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 10, border: "1px solid var(--drawer-border)", background: "var(--drawer-card)", borderRadius: 14, padding: 9 },
  themeTitle: { color: "var(--drawer-text)", fontWeight: 900, fontSize: 12.5 },
  themeSub: { color: "var(--drawer-muted)", fontWeight: 700, fontSize: 10.5, marginTop: 1 },
  themeSwitch: { display: "flex", background: "var(--drawer-switch)", borderRadius: 11, padding: 3, gap: 3 },
  themeBtn: { border: 0, background: "transparent", color: "var(--drawer-muted)", borderRadius: 9, padding: "7px 8px", fontSize: 11, fontWeight: 900, fontFamily: "inherit", cursor: "pointer" },
  themeBtnOn: { background: "#ffffff", color: "#15803d", boxShadow: "0 2px 8px rgba(15,23,42,.08)" },
  themeBtnOnDark: { background: "rgba(34,226,111,0.13)", color: "#22e26f", boxShadow: "0 0 18px rgba(34,226,111,.22)" },
  exit: { width: "100%", border: "1px solid var(--drawer-border)", background: "var(--drawer-card)", borderRadius: 14, padding: 11, fontWeight: 800, fontSize: 13, color: "var(--drawer-text)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", fontFamily: "inherit" },
  exitIco: { width: 17, height: 17, fill: "none", stroke: "var(--drawer-muted)", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
  empty: { color: "var(--drawer-muted)", fontSize: 13, fontWeight: 700, padding: 8 },
};
