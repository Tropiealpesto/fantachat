"use client";

import { themeFromType } from "../../lib/competitionThemes";

export default function CompetitionBadge(props: {
  name?: string | null;
  type?: string | null;
}) {
  const theme = themeFromType(props.type);

  const icon =
    theme.key === "champions"
      ? "✦"
      : theme.key === "mondiale"
      ? "◉"
      : "●";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        width: "fit-content",
        borderRadius: 8,
        padding: "7px 11px",
        fontSize: 12,
        fontWeight: 1000,
        letterSpacing: 0,
        color: theme.badgeText,
        background: theme.badgeBg,
        border: `1px solid ${theme.key === "champions" ? "rgba(147,197,253,0.28)" : theme.border}`,
        boxShadow: "0 5px 14px rgba(19,35,26,.06)",
      }}
    >
      <span
        style={{
          color: theme.key === "mondiale" ? "#111827" : theme.accent,
          fontSize: 13,
          lineHeight: 1,
        }}
      >
        {icon}
      </span>
      {props.name ?? theme.label}
    </span>
  );
}
