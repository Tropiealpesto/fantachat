"use client";

import { themeFromType } from "../../lib/competitionThemes";

export default function CompetitionBadge({ name, type }: { name?: string | null; type?: string | null }) {
  const theme = themeFromType(type);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, background: theme.badgeBg, color: theme.badgeText, border: `1px solid ${theme.primary}33`, padding: "4px 10px", fontSize: 11, fontWeight: 800 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: theme.primary }} />
      {name ?? theme.label}
    </span>
  );
}
