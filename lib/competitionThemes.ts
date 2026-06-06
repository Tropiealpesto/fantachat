export type CompetitionTheme = {
  key: string;
  primary: string;
  primaryDark: string;
  accent: string;
  badgeBg: string;
  badgeText: string;
  hero: string;
  label: string;

  pageBg: string;
  cardBg: string;
  appbarBg: string;
  navBg: string;
  border: string;
  text: string;
  muted: string;
  soft: string;
  shadow: string;
};

export const DEFAULT_THEME: CompetitionTheme = {
  key: "campionato",
  primary: "#16a34a",
  primaryDark: "#15803d",
  accent: "#f97316",
  badgeBg: "#dcfce7",
  badgeText: "#15803d",
  hero: "linear-gradient(160deg,#14532d,#16a34a)",
  label: "Campionato",

  pageBg: "#f1f5f1",
  cardBg: "#ffffff",
  appbarBg: "rgba(255,255,255,0.88)",
  navBg: "rgba(255,255,255,0.96)",
  border: "#e5e7eb",
  text: "#0f172a",
  muted: "#64748b",
  soft: "#dcfce7",
  shadow: "0 4px 16px rgba(15,23,42,0.07)",
};

export const THEMES: Record<string, CompetitionTheme> = {
  campionato: DEFAULT_THEME,

  champions: {
    key: "champions",
    primary: "#3b82f6",
    primaryDark: "#020617",
    accent: "#c8a24a",
    badgeBg: "rgba(59,130,246,0.14)",
    badgeText: "#bfdbfe",
    hero:
      "radial-gradient(circle at 90% 18%, rgba(96,165,250,0.55), transparent 23%), radial-gradient(circle at 10% 0%, rgba(200,162,74,0.10), transparent 18%), linear-gradient(160deg,#020617 0%,#07142f 44%,#123a8c 100%)",
    label: "Champions",

    pageBg: "#edf3ff",
    cardBg: "#ffffff",
    appbarBg: "rgba(2,6,23,0.88)",
    navBg: "rgba(2,6,23,0.94)",
    border: "rgba(59,130,246,0.24)",
    text: "#0f172a",
    muted: "#64748b",
    soft: "#dbeafe",
    shadow: "0 8px 28px rgba(15,23,42,0.12)",
  },

  mondiale: {
    key: "mondiale",
    primary: "#d4a017",
    primaryDark: "#111827",
    accent: "#0ea5e9",
    badgeBg: "#fef3c7",
    badgeText: "#b45309",
    hero:
      "radial-gradient(circle at 50% 0%, rgba(212,160,23,0.28), transparent 24%), radial-gradient(circle at 8% 30%, rgba(0,0,0,0.40), transparent 24%), radial-gradient(circle at 95% 18%, rgba(14,165,233,0.18), transparent 22%), linear-gradient(160deg,#ffffff 0%,#f8fafc 46%,#111827 100%)",
    label: "Mondiale",

    pageBg: "#f7f7f2",
    cardBg: "#ffffff",
    appbarBg: "rgba(255,255,255,0.92)",
    navBg: "rgba(255,255,255,0.97)",
    border: "rgba(17,24,39,0.12)",
    text: "#111827",
    muted: "#64748b",
    soft: "#fff7d6",
    shadow: "0 8px 28px rgba(17,24,39,0.10)",
  },
};

export function themeFromType(type?: string | null): CompetitionTheme {
  if (!type) return DEFAULT_THEME;

  const key = String(type).toLowerCase();

  if (key.includes("champions")) return THEMES.champions;
  if (key.includes("mondiale") || key.includes("world") || key.includes("europeo")) return THEMES.mondiale;
  if (key.includes("campionato") || key.includes("serie")) return THEMES.campionato;

  return DEFAULT_THEME;
}

export function themeFromSlug(slug?: string | null): CompetitionTheme {
  if (!slug) return DEFAULT_THEME;

  const key = String(slug).toLowerCase();

  if (key.includes("champions")) return THEMES.champions;
  if (key.includes("mondiale") || key.includes("world") || key.includes("europeo")) return THEMES.mondiale;
  if (key.includes("serie") || key.includes("campionato")) return THEMES.campionato;

  return DEFAULT_THEME;
}
