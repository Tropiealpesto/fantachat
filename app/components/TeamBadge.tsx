"use client";

import React from "react";

export type BadgePattern = "split" | "stripes" | "solid";

function hue(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}

export function initials(name?: string | null) {
  const n = (name ?? "").trim();
  if (!n) return "SQ";
  const p = n.split(/\s+/).filter(Boolean);
  return (p.length === 1 ? p[0].slice(0, 2) : p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function hexLum(hex: string) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length < 6) return 0.5;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// colori automatici (ripiego) finché l'utente non sceglie i suoi
function fallbackColors(name?: string | null): { primary: string; secondary: string } {
  const h = hue(name ?? "x");
  return { primary: `hsl(${h},60%,45%)`, secondary: `hsl(${(h + 30) % 360},60%,30%)` };
}

function buildBackground(primary: string, secondary: string, pattern: BadgePattern) {
  if (pattern === "stripes") return `repeating-linear-gradient(90deg, ${primary} 0 16%, ${secondary} 16% 32%)`;
  if (pattern === "solid") return primary;
  return `linear-gradient(135deg, ${primary} 0 50%, ${secondary} 50% 100%)`; // split (diagonale)
}

type Props = {
  /** nome squadra: usato per le iniziali e per i colori automatici se non passi i colori */
  name?: string | null;
  /** colore primario (es. "#15803d"); se assente usa i colori automatici dal nome */
  primary?: string | null;
  /** colore secondario (es. "#e07b1a") */
  secondary?: string | null;
  /** "split" = due colori in diagonale (squadre utente), "stripes" = a strisce, "solid" = tinta unita (club) */
  pattern?: BadgePattern;
  /** dimensione in px (default 40) */
  size?: number;
  /** mostra le iniziali al centro (default true per le squadre utente; metti false per le maglie club) */
  showInitials?: boolean;
  /** testo personalizzato al posto delle iniziali calcolate */
  label?: string;
  style?: React.CSSProperties;
};

export default function TeamBadge({
  name,
  primary,
  secondary,
  pattern = "split",
  size = 40,
  showInitials = true,
  label,
  style,
}: Props) {
  const fb = fallbackColors(name);
  const p = primary || fb.primary;
  const sec = secondary || fb.secondary;
  const ring = pattern === "solid" ? sec : "#ffffff";
  // colore testo leggibile: scuro solo se il primario (dove stanno le iniziali) è chiaro
  const dark = primary ? hexLum(p) > 0.62 : false;
  const text = label ?? initials(name);

  return (
    <span
      className="fc-team-badge"
      title={name ?? undefined}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        background: buildBackground(p, sec, pattern),
        border: `${Math.max(2, Math.round(size * 0.06))}px solid ${ring}`,
        boxShadow: "0 1px 3px rgba(0,0,0,.25)",
        ...style,
      }}
    >
      {showInitials && (
        <span
          style={{
            fontWeight: 1000,
            fontSize: Math.round(size * 0.36),
            letterSpacing: ".02em",
            lineHeight: 1,
            color: dark ? "#0f172a" : "#ffffff",
            textShadow: dark ? "none" : "0 1px 2px rgba(0,0,0,.3)",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
