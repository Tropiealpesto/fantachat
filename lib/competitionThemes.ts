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
  accent: "#e07b1a",
  badgeBg: "#dcfce7",
  badgeText: "#15803d",
  hero: "linear-gradient(160deg,#14532d,#16a34a)",
  label: "Campionato",

  pageBg: "#f4f7f4",
  cardBg: "#ffffff",
  appbarBg: "rgba(255,255,255,0.88)",
  navBg: "rgba(255,255,255,0.96)",
  border: "#e5e7eb",
  text: "#0f172a",
  muted: "#64748b",
  soft: "#dcfce7",
  shadow: "0 10px 28px rgba(15,23,42,0.08)",
};

export const THEMES: Record<string, CompetitionTheme> = {
  campionato: DEFAULT_THEME,

  champions: {
    key: "champions",
    primary: "#3b82f6",
    primaryDark: "#020617",
    accent: "#c8a24a",
    badgeBg: "rgba(59,130,246,0.14)",
    badgeText: "#1d4ed8",
    hero:
      "radial-gradient(circle at 90% 18%, rgba(96,165,250,0.55), transparent 23%), radial-gradient(circle at 10% 0%, rgba(200,162,74,0.10), transparent 18%), linear-gradient(160deg,#020617 0%,#07142f 44%,#123a8c 100%)",
    label: "Champions",

    pageBg: "#f4f7f4",
    cardBg: "#ffffff",
    appbarBg: "rgba(255,255,255,0.88)",
    navBg: "rgba(255,255,255,0.96)",
    border: "#e5e7eb",
    text: "#0f172a",
    muted: "#64748b",
    soft: "#dbeafe",
    shadow: "0 10px 28px rgba(15,23,42,0.08)",
  },

  coppe: {
    key: "coppe",
    primary: "#16a34a",
    primaryDark: "#15803d",
    accent: "#e07b1a",
    badgeBg: "#dcfce7",
    badgeText: "#15803d",
    hero:
      "radial-gradient(circle at 50% 0%, rgba(212,160,23,0.28), transparent 24%), radial-gradient(circle at 8% 30%, rgba(0,0,0,0.40), transparent 24%), radial-gradient(circle at 95% 18%, rgba(14,165,233,0.18), transparent 22%), linear-gradient(160deg,#ffffff 0%,#f8fafc 46%,#111827 100%)",
    label: "Coppe",

    pageBg: "#f4f7f4",
    cardBg: "#ffffff",
    appbarBg: "rgba(255,255,255,0.88)",
    navBg: "rgba(255,255,255,0.96)",
    border: "#e5e7eb",
    text: "#111827",
    muted: "#64748b",
    soft: "#fff3e4",
    shadow: "0 10px 28px rgba(15,23,42,0.08)",
  },

  // Alias legacy: se nel DB trovi ancora type/slug mondiale,
  // usa comunque il tema Coppe.
  mondiale: {
    key: "coppe",
    primary: "#16a34a",
    primaryDark: "#15803d",
    accent: "#e07b1a",
    badgeBg: "#dcfce7",
    badgeText: "#15803d",
    hero:
      "radial-gradient(circle at 50% 0%, rgba(212,160,23,0.28), transparent 24%), radial-gradient(circle at 8% 30%, rgba(0,0,0,0.40), transparent 24%), radial-gradient(circle at 95% 18%, rgba(14,165,233,0.18), transparent 22%), linear-gradient(160deg,#ffffff 0%,#f8fafc 46%,#111827 100%)",
    label: "Coppe",

    pageBg: "#f4f7f4",
    cardBg: "#ffffff",
    appbarBg: "rgba(255,255,255,0.88)",
    navBg: "rgba(255,255,255,0.96)",
    border: "#e5e7eb",
    text: "#111827",
    muted: "#64748b",
    soft: "#fff3e4",
    shadow: "0 10px 28px rgba(15,23,42,0.08)",
  },
};

export function themeFromType(type?: string | null): CompetitionTheme {
  if (!type) return DEFAULT_THEME;

  const key = String(type).toLowerCase();

  if (key.includes("champions")) return THEMES.champions;

  if (
    key.includes("coppa") ||
    key.includes("coppe") ||
    key.includes("mondiale") ||
    key.includes("world") ||
    key.includes("europeo") ||
    key.includes("europa") ||
    key.includes("conference") ||
    key.includes("torneo")
  ) {
    return THEMES.coppe;
  }

  if (key.includes("campionato") || key.includes("serie")) return THEMES.campionato;

  return DEFAULT_THEME;
}

export function themeFromSlug(slug?: string | null): CompetitionTheme {
  if (!slug) return DEFAULT_THEME;

  const key = String(slug).toLowerCase();

  if (key.includes("champions")) return THEMES.champions;

  if (
    key.includes("coppa") ||
    key.includes("coppe") ||
    key.includes("mondiale") ||
    key.includes("world") ||
    key.includes("europeo") ||
    key.includes("europa") ||
    key.includes("conference") ||
    key.includes("torneo")
  ) {
    return THEMES.coppe;
  }

  if (key.includes("serie") || key.includes("campionato")) return THEMES.campionato;

  return DEFAULT_THEME;
}
