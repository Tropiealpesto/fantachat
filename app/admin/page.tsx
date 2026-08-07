"use client";

import AppBar from "../components/AppBar";
import BottomNav from "../components/BottomNav";
import CompetitionBadge from "../components/CompetitionBadge";
import { useRequireLeagueAdmin } from "../hooks/useRequireApp";

const ADMIN_LINKS = [
  {
    href: "/admin/formazioni",
    title: "Formazioni e slot",
    desc: "Controlla gli invii, resetta formazioni e imposta la durata slot.",
    icon: "F",
  },
  {
    href: "/admin/competizione/nuova",
    title: "Aggiungi competizione",
    desc: "Scegli una competizione globale per la tua lega.",
    icon: "+",
  },
];

export default function AdminHome() {
  const app = useRequireLeagueAdmin();

  return (
    <>
      <AppBar
        league={app.leagueName}
        team={`${app.teamName} · ADMIN`}
        onMenuOpen={app.openDrawer}
      />

      <main style={s.container}>
        <section style={s.hero}>
          <CompetitionBadge name={app.competitionName} type={app.competitionType} />
          <h1 style={s.title}>Admin competizione</h1>
          <p style={s.subtitle}>
            Gestisci la tua lega. Giornate, dati e punteggi sono coordinati dal superadmin.
          </p>
        </section>

        <section style={s.grid}>
          {ADMIN_LINKS.map((link) => (
            <a key={link.href} href={link.href} style={s.link}>
              <span style={s.icon}>{link.icon}</span>
              <span style={s.linkText}>
                <b>{link.title}</b>
                <small>{link.desc}</small>
              </span>
              <span style={s.chev}>›</span>
            </a>
          ))}
        </section>
      </main>

      <BottomNav />
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 520,
    margin: "0 auto",
    padding: "12px 14px calc(72px + env(safe-area-inset-bottom, 0px) + 18px)",
    display: "grid",
    gap: 10,
  },
  hero: {
    background: "white",
    border: "1px solid rgba(226,232,240,.92)",
    borderRadius: 12,
    padding: 14,
    boxShadow: "0 3px 12px rgba(15,23,42,.035)",
  },
  title: {
    margin: "12px 0 3px",
    color: "#0f172a",
    fontSize: 22,
    lineHeight: 1.05,
    fontWeight: 900,
    letterSpacing: "-0.025em",
  },
  subtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: 12.5,
    lineHeight: 1.35,
    fontWeight: 750,
  },
  grid: {
    display: "grid",
    gap: 8,
  },
  link: {
    display: "grid",
    gridTemplateColumns: "34px 1fr auto",
    alignItems: "center",
    gap: 10,
    background: "white",
    border: "1px solid rgba(226,232,240,.92)",
    borderRadius: 11,
    padding: 12,
    boxShadow: "0 2px 10px rgba(15,23,42,.03)",
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    display: "grid",
    placeItems: "center",
    background: "#eef7f0",
    color: "#15803d",
    fontSize: 15,
    fontWeight: 900,
  },
  linkText: {
    minWidth: 0,
    display: "grid",
    gap: 2,
  },
  chev: {
    color: "#94a3b8",
    fontSize: 24,
    lineHeight: 1,
  },
};
