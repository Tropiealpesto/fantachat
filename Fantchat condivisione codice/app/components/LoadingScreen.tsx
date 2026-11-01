"use client";

import LogoMark from "./LogoMark";

export default function LoadingScreen() {
  return (
    <div className="fc-loading-screen" style={s.wrap} aria-label="Caricamento FantaChat">
      <div style={s.spinner} aria-hidden="true">
        <span className="fc-loading-ring" style={{ ...s.ring, ...s.greenRing }} />
        <span className="fc-loading-ring" style={{ ...s.ring, ...s.orangeRing }} />
        <span style={s.mark}>
          <LogoMark size={30} />
        </span>
      </div>

      <style>{`
        @keyframes fc-loading-spin {
          to { transform: rotate(360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .fc-loading-ring {
            animation: none !important;
          }
        }

        html[data-ui-theme="dark"] .fc-loading-screen {
          background:
            radial-gradient(circle at 50% 45%, rgba(34,226,111,.08), transparent 30%),
            #00030a !important;
        }
      `}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: "100dvh",
    display: "grid",
    placeItems: "center",
    padding: "24px",
    background:
      "radial-gradient(circle at 50% 45%, rgba(19,122,61,.045), transparent 30%), linear-gradient(180deg,#ffffff 0%,#f4f7f4 100%)",
    overflow: "hidden",
  },
  spinner: {
    width: 84,
    height: 84,
    position: "relative",
    display: "grid",
    placeItems: "center",
    transform: "translateY(-10px)",
  },
  ring: {
    position: "absolute",
    borderRadius: "50%",
    border: "1.4px solid transparent",
  },
  greenRing: {
    inset: 0,
    borderTopColor: "#137A3D",
    borderRightColor: "rgba(19,122,61,.34)",
    borderBottomColor: "rgba(19,122,61,.10)",
    animation: "fc-loading-spin 1.25s linear infinite",
  },
  orangeRing: {
    inset: 10,
    borderLeftColor: "#E07B1A",
    borderBottomColor: "rgba(224,123,26,.34)",
    borderTopColor: "rgba(224,123,26,.10)",
    animation: "fc-loading-spin 1.65s linear infinite reverse",
  },
  mark: {
    width: 34,
    height: 34,
    display: "grid",
    placeItems: "center",
  },
};
