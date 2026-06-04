"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import AppBar from "../../components/AppBar";
import BottomNav from "../../components/BottomNav";
import { useApp } from "../../components/AppContext";

const CLASSIC = {
  goal: 3,
  assist: 1,
  yellow: -0.5,
  red: -1,
  clean_sheet_gk: 1,
  clean_sheet_def: 1,
  goals_conceded_gk: -1,
  pen_missed: -3,
};

export default function AdminRegolePage() {
  const router = useRouter();
  const { ready, userId, activeLeagueId, leagueName, teamName, role, openDrawer } = useApp();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!userId) return router.replace("/login");
    if (!activeLeagueId) return router.replace("/seleziona-lega");
    if (role !== "admin") return router.replace("/");
    setLoading(false);
  }, [ready, userId, activeLeagueId, role, router]);

  if (!ready || loading) return <main style={{ padding: 20 }}>Caricamento...</main>;

  return (
    <>
      <AppBar league={leagueName} team={`${teamName} · ADMIN`} onMenuOpen={openDrawer} />

      <main style={s.container}>
        <div style={s.card}>
          <div style={s.title}>Regole</div>
          <div style={s.subtitle}>
            Scegli tra regole standard FantaChat oppure personalizzate.
          </div>

          {/* Regole classiche — attivo */}
          <div style={s.classicCard}>
            <div style={s.radioRow}>
              <div style={s.radioActive}>
                <div style={s.radioDot} />
              </div>
              <div>
                <div style={s.cardTitle}>Regole classiche FantaChat</div>
                <div style={s.cardDesc}>Consigliato: esperienza standard uguale per tutti.</div>
              </div>
            </div>
          </div>

          {/* Regole personalizzate — bloccato */}
          <div style={s.customCard}>
            <div style={s.radioRow}>
              <div style={s.radioDisabled} />
              <div>
                <div style={s.cardTitleDisabled}>Regole personalizzate</div>
                <div style={s.cardDescAccent}>Rimani con noi e arriveranno presto! 🚀</div>
              </div>
            </div>
            <div style={s.lockBadge}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              In arrivo
            </div>
          </div>
        </div>

        {/* Tabella regole attive */}
        <div style={s.card}>
          <div style={s.sectionTitle}>Regole attive</div>
          <div style={s.rulesGrid}>
            <RuleRow label="Gol" value={`+${CLASSIC.goal}`} positive />
            <RuleRow label="Assist" value={`+${CLASSIC.assist}`} positive />
            <RuleRow label="Ammonizione" value={`${CLASSIC.yellow}`} negative />
            <RuleRow label="Espulsione" value={`${CLASSIC.red}`} negative />
            <RuleRow label="Porta inviolata (P)" value={`+${CLASSIC.clean_sheet_gk}`} positive />
            <RuleRow label="Porta inviolata (D)" value={`+${CLASSIC.clean_sheet_def}`} positive />
            <RuleRow label="Gol subito (P)" value={`${CLASSIC.goals_conceded_gk}`} negative />
            <RuleRow label="Rigore sbagliato" value={`${CLASSIC.pen_missed}`} negative />
          </div>
        </div>
      </main>

      <BottomNav />
    </>
  );
}

function RuleRow({ label, value, positive, negative }: {
  label: string; value: string; positive?: boolean; negative?: boolean;
}) {
  return (
    <div style={s.ruleRow}>
      <div style={s.ruleLabel}>{label}</div>
      <div style={{
        ...s.ruleValue,
        color: positive ? "#15803d" : negative ? "#c2410c" : "#111827",
        background: positive ? "rgba(22,163,74,0.08)" : negative ? "rgba(234,88,12,0.08)" : "#f3f4f6",
      }}>
        {value}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 520, margin: "0 auto",
    padding: "16px 14px calc(64px + env(safe-area-inset-bottom, 0px) + 20px)",
    display: "flex", flexDirection: "column", gap: 14,
  },
  card: {
    background: "white", borderRadius: 18, padding: 16,
    border: "1px solid #e5e7eb",
  },
  title: { fontSize: 22, fontWeight: 800, color: "#111827" },
  subtitle: { marginTop: 6, color: "#6b7280", fontWeight: 600, fontSize: 13, marginBottom: 16 },

  classicCard: {
    padding: 14, borderRadius: 12,
    border: "2px solid #16a34a",
    background: "rgba(22,163,74,0.05)",
    marginBottom: 10,
  },
  customCard: {
    padding: 14, borderRadius: 12,
    border: "1.5px solid #e5e7eb",
    background: "#f9fafb",
    opacity: 0.7,
    position: "relative" as const,
    cursor: "not-allowed",
  },
  radioRow: {
    display: "flex", alignItems: "flex-start", gap: 12,
  },
  radioActive: {
    width: 20, height: 20, borderRadius: "50%",
    border: "2px solid #16a34a",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, marginTop: 2,
  },
  radioDot: {
    width: 10, height: 10, borderRadius: "50%",
    background: "#16a34a",
  },
  radioDisabled: {
    width: 20, height: 20, borderRadius: "50%",
    border: "2px solid #d1d5db",
    flexShrink: 0, marginTop: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: 700, color: "#111827" },
  cardDesc: { fontSize: 12, color: "#6b7280", fontWeight: 600, marginTop: 2 },
  cardTitleDisabled: { fontSize: 15, fontWeight: 700, color: "#9ca3af" },
  cardDescAccent: { fontSize: 12, color: "#f97316", fontWeight: 700, marginTop: 2 },
  lockBadge: {
    position: "absolute" as const, top: 14, right: 14,
    display: "flex", alignItems: "center", gap: 4,
    fontSize: 11, fontWeight: 700, color: "#9ca3af",
    background: "#f3f4f6", borderRadius: 20, padding: "3px 10px",
  },

  sectionTitle: { fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 12 },
  rulesGrid: { display: "grid", gap: 8 },
  ruleRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "10px 0", borderBottom: "1px solid #f3f4f6",
  },
  ruleLabel: { fontSize: 14, fontWeight: 600, color: "#111827" },
  ruleValue: {
    fontSize: 14, fontWeight: 800, borderRadius: 8,
    padding: "4px 12px", minWidth: 50, textAlign: "center" as const,
  },
};