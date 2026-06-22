const s: Record<string, React.CSSProperties> = {
  topBtn: {
    border: "1px solid #fed7aa",
    borderRadius: 999,
    background: "white",
    color: "#ea580c",
    padding: "8px 18px",
    fontWeight: 1000,
    cursor: "pointer",
  },

  hero: {
    color: "white",
    padding: "20px 18px 88px",
    marginBottom: -68,
    position: "relative",
    overflow: "hidden",
  },

  heroInner: {
    maxWidth: 520,
    margin: "0 auto",
  },

  heroRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginTop: 18,
  },

  badgeRing: {
    borderRadius: "50%",
    padding: 4,
    border: "2px solid rgba(255,255,255,.88)",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    boxShadow: "0 10px 24px rgba(0,0,0,.16)",
  },

  hello: {
    opacity: 0.82,
    fontWeight: 900,
    fontSize: 15,
  },

  team: {
    fontSize: 32,
    lineHeight: 1.04,
    margin: "3px 0 0",
    fontWeight: 1000,
    letterSpacing: "-0.04em",
  },

  kpis: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 9,
    marginTop: 19,
  },

  kpi: {
    background: "rgba(255,255,255,.14)",
    border: "1px solid rgba(255,255,255,.22)",
    borderRadius: 17,
    padding: "13px 8px",
    display: "grid",
    gap: 4,
    textAlign: "center",
    backdropFilter: "blur(12px)",
  },

  container: {
    maxWidth: 520,
    margin: "0 auto",
    padding: "0 14px calc(76px + env(safe-area-inset-bottom, 0px) + 18px)",
    display: "grid",
    gap: 13,
  },

  card: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 22,
    padding: 15,
    boxShadow: "0 10px 28px rgba(15,23,42,.08)",
  },

  matchdayCard: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 12px 30px rgba(15,23,42,.10)",
    display: "grid",
    gridTemplateColumns: "52px 1fr auto",
    gap: 12,
    alignItems: "center",
  },

  matchdayIcon: {
    width: 50,
    height: 50,
    borderRadius: "50%",
    background: "#eaf7ee",
    color: "#15803d",
    display: "grid",
    placeItems: "center",
    fontSize: 20,
    fontWeight: 1000,
  },

  label: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 1000,
    textTransform: "uppercase",
    letterSpacing: ".02em",
  },

  matchday: {
    fontSize: 38,
    fontWeight: 1000,
    lineHeight: 1,
    color: "#0f172a",
  },

  status: {
    borderRadius: 999,
    padding: "7px 14px",
    fontWeight: 1000,
    fontSize: 14,
  },

  primaryBtn: {
    gridColumn: "1 / -1",
    width: "100%",
    border: 0,
    color: "white",
    borderRadius: 13,
    padding: 13,
    fontWeight: 1000,
    cursor: "pointer",
    marginTop: 0,
    boxShadow: "inset 0 -1px 0 rgba(0,0,0,.08)",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 11,
  },

  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 20,
    fontWeight: 1000,
    letterSpacing: "-0.03em",
  },

  textLink: {
    border: 0,
    background: "transparent",
    color: "#15803d",
    fontWeight: 1000,
    fontSize: 13,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  standingsBox: {
    display: "grid",
    gap: 7,
  },

  srow: {
    display: "grid",
    gridTemplateColumns: "32px 34px 1fr auto",
    gap: 10,
    alignItems: "center",
    padding: "9px 10px",
    borderRadius: 14,
  },

  srank: {
    fontWeight: 1000,
    color: "#64748b",
    fontSize: 16,
    textAlign: "center",
  },

  sname: {
    fontWeight: 1000,
    fontSize: 15,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  spts: {
    fontWeight: 1000,
    color: "#0f172a",
    fontSize: 14,
  },

  dots: {
    textAlign: "center",
    color: "#94a3b8",
    fontWeight: 1000,
    padding: "1px 0",
  },

  compactPitch: {
    position: "relative",
    height: 205,
    overflow: "hidden",
    background: "linear-gradient(180deg, #75be67 0%, #4fae55 100%)",
    borderRadius: 18,
    border: "4px solid #6dbf70",
    display: "grid",
    alignContent: "space-around",
    padding: "13px 18px",
    boxShadow: "inset 0 0 0 2px rgba(255,255,255,.35)",
  },

  pitchHalfway: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: 2,
    background: "rgba(255,255,255,.42)",
  },

  pitchCircleSmall: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 74,
    height: 74,
    marginLeft: -37,
    marginTop: -37,
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,.42)",
  },

  compactPitchRow: {
    position: "relative",
    zIndex: 2,
    display: "flex",
    justifyContent: "center",
    gap: 16,
    alignItems: "center",
    minHeight: 36,
  },

  compactPlayer: {
    display: "grid",
    justifyItems: "center",
    gap: 4,
    minWidth: 56,
  },

  compactPlayerName: {
    maxWidth: 78,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "white",
    fontWeight: 1000,
    fontSize: 10.5,
    textShadow: "0 1px 2px rgba(0,0,0,.35)",
  },

  modulePill: {
    background: "#dcfce7",
    color: "#15803d",
    borderRadius: 999,
    padding: "6px 12px",
    fontWeight: 1000,
    fontSize: 13,
  },

  secondaryBtn: {
    marginTop: 11,
    width: "100%",
    border: "1px solid #d1d5db",
    background: "white",
    borderRadius: 12,
    padding: 10,
    color: "#15803d",
    fontWeight: 1000,
    cursor: "pointer",
  },

  roleTabs: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 8,
    marginBottom: 11,
  },

  roleTab: {
    border: 0,
    borderRadius: 999,
    padding: "8px 0",
    fontWeight: 1000,
    cursor: "pointer",
  },

  topEmpty: {
    border: "1px dashed #cbd5e1",
    borderRadius: 14,
    padding: "14px 13px",
    display: "grid",
    gap: 5,
    color: "#64748b",
    textAlign: "center",
    fontWeight: 800,
    fontSize: 13,
  },

  topGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 8,
  },

  topPlayerCard: {
    display: "grid",
    gridTemplateColumns: "26px 38px 1fr auto",
    alignItems: "center",
    gap: 9,
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 10,
  },

  topRank: {
    color: "#64748b",
    fontWeight: 1000,
    textAlign: "center",
  },

  topName: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 1000,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  topSub: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
  },

  ppUp: {
    background: "#dcfce7",
    color: "#15803d",
    borderRadius: 999,
    padding: "4px 9px",
  },

  ppDown: {
    background: "#fee2e2",
    color: "#dc2626",
    borderRadius: 999,
    padding: "4px 9px",
  },

  ppFlat: {
    background: "#f1f5f9",
    color: "#475569",
    borderRadius: 999,
    padding: "4px 9px",
  },

  rulesRow: {
    width: "100%",
    border: "1px solid #e5e7eb",
    background: "white",
    borderRadius: 18,
    padding: "13px 15px",
    display: "grid",
    gridTemplateColumns: "32px 1fr auto",
    alignItems: "center",
    gap: 10,
    boxShadow: "0 6px 18px rgba(15,23,42,.06)",
    cursor: "pointer",
    color: "#0f172a",
  },

  rulesIcon: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "#f0fdf4",
    color: "#15803d",
    display: "grid",
    placeItems: "center",
    fontWeight: 1000,
  },

  rulesArrow: {
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 1,
  },

  adminCard: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 22,
    padding: 14,
    boxShadow: "0 10px 28px rgba(15,23,42,.08)",
    display: "flex",
    alignItems: "center",
    gap: 13,
  },

  adminIcon: {
    width: 48,
    height: 48,
    borderRadius: "50%",
    background: "#f1f5f9",
    display: "grid",
    placeItems: "center",
    fontSize: 23,
    flexShrink: 0,
  },

  adminTitle: {
    margin: 0,
    fontSize: 19,
    lineHeight: 1.05,
    color: "#0f172a",
    fontWeight: 1000,
  },

  adminText: {
    margin: "5px 0 0",
    color: "#64748b",
    fontWeight: 800,
    fontSize: 13,
    lineHeight: 1.35,
  },

  adminBtn: {
    border: "1px solid #16a34a",
    background: "white",
    color: "#15803d",
    borderRadius: 14,
    padding: "10px 14px",
    fontWeight: 1000,
    cursor: "pointer",
    flexShrink: 0,
  },

  muted: {
    color: "#6b7280",
    fontWeight: 700,
    fontSize: 13,
    marginTop: 10,
  },

  emptySmall: {
    color: "#64748b",
    fontWeight: 800,
    fontSize: 13,
    background: "#f8fafc",
    borderRadius: 14,
    padding: 14,
  },

  recapCard: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderTop: "3px solid #ea580c",
    borderRadius: 18,
    padding: 15,
    boxShadow: "0 4px 16px rgba(0,0,0,.06)",
  },

  recapRow: {
    display: "flex",
    gap: 13,
    alignItems: "center",
  },

  recapMascot: {
    width: 72,
    height: 72,
    borderRadius: 16,
    objectFit: "cover",
    flexShrink: 0,
    border: "2px solid #fff",
    boxShadow: "0 4px 12px rgba(0,0,0,.12)",
  },

  recapLabel: {
    fontSize: 10.5,
    fontWeight: 1000,
    color: "#ea580c",
    textTransform: "uppercase",
    letterSpacing: ".05em",
  },

  recapText: {
    fontSize: 13.5,
    fontWeight: 600,
    color: "#334155",
    lineHeight: 1.5,
    margin: "4px 0 0",
  },

  recapBtn: {
    width: "100%",
    marginTop: 13,
    background: "#15803d",
    color: "white",
    border: 0,
    borderRadius: 12,
    padding: 12,
    fontWeight: 1000,
    fontSize: 14,
    cursor: "pointer",
  },

  error: {
    padding: 12,
    borderRadius: 12,
    background: "#fff1f2",
    color: "#991b1b",
    fontWeight: 800,
  },

  closedText: {
    margin: "0",
    color: "rgba(255,255,255,0.78)",
    fontWeight: 750,
    lineHeight: 1.45,
  },

  closedTitle: {
    margin: "0 0 12px",
    color: "#111827",
    fontWeight: 1000,
    fontSize: 22,
  },

  finalTable: {
    display: "grid",
    gap: 8,
  },

  finalRow: {
    display: "grid",
    gridTemplateColumns: "44px 1fr 70px",
    gap: 8,
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
  },
};