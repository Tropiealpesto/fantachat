export type CompetitionType = "campionato" | "champions" | "mondiale" | string;

export type CompetitionTheme = {
  key: string;
  primary: string;
  primaryDark: string;
  accent: string;
  badgeBg: string;
  badgeText: string;
  hero: string;
  label: string;
};

export const THEMES: Record<string, CompetitionTheme> = {
  campionato: {
    key: "campionato",
    primary: "#16a34a",
    primaryDark: "#15803d",
    accent: "#f97316",
    badgeBg: "#dcfce7",
    badgeText: "#15803d",
    hero: "linear-gradient(160deg,#14532d,#16a34a)",
    label: "Campionato",
  },
  champions: {
    key: "champions",
    primary: "#1a4fd6",
    primaryDark: "#0a1f4e",
    accent: "#facc15",
    badgeBg: "#eff6ff",
    badgeText: "#1a4fd6",
    hero: "linear-gradient(160deg,#050d1a,#0a1f4e,#1a4fd6)",
    label: "Champions",
  },
  mondiale: {
    key: "mondiale",
    primary: "#dc2626",
    primaryDark: "#991b1b",
    accent: "#2563eb",
    badgeBg: "#fee2e2",
    badgeText: "#991b1b",
    hero: "linear-gradient(135deg,#dc2626,#2563eb,#facc15,#16a34a)",
    label: "Mondiale",
  },
};

export const DEFAULT_THEME = THEMES.campionato;

export function themeFromType(type?: string | null): CompetitionTheme {
  if (!type) return DEFAULT_THEME;
  if (type.includes("champions")) return THEMES.champions;
  if (type.includes("mondial") || type.includes("europe")) return THEMES.mondiale;
  return THEMES[type] ?? DEFAULT_THEME;
}
