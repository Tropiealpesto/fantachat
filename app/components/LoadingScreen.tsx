"use client";

export default function LoadingScreen() {
  return (
    <div style={s.wrap}>
      <div style={s.glowOne} />
      <div style={s.glowTwo} />

      <div style={s.brandBlock}>
        <div style={s.logo}>
          <span style={{ color: "#16a34a" }}>Fanta</span>
          <span style={{ color: "#e07b1a" }}>Chat</span>
        </div>
        <div style={s.sub}>La tua lega si sta preparando</div>
      </div>

      <div style={s.loaderCard}>
        <div style={s.appIcon}>
          <span style={s.letterF}>F</span>
          <span style={s.letterC}>C</span>
        </div>
        <div style={s.progress}>
          <span style={s.progressFill} />
        </div>
        <div style={s.chips}>
          <span style={s.greenChip}>classifica</span>
          <span style={s.orangeChip}>chat</span>
          <span style={s.greenChip}>rosa</span>
        </div>
      </div>

      <div style={s.label}>
        Caricamento
        <span style={s.d1}>.</span>
        <span style={s.d2}>.</span>
        <span style={s.d3}>.</span>
      </div>

      <style>{`
        @keyframes fc-blink {
          0%, 100% { opacity: 0; }
          50%       { opacity: 1; }
        }
        @keyframes fc-progress {
          0%   { transform: translateX(-88%) scaleX(.22); }
          45%  { transform: translateX(-18%) scaleX(.82); }
          100% { transform: translateX(104%) scaleX(.26); }
        }
        @keyframes fc-float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
        @keyframes fc-fadein {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fc-d1 { animation: fc-blink 1.2s 0.0s infinite; }
        .fc-d2 { animation: fc-blink 1.2s 0.2s infinite; }
        .fc-d3 { animation: fc-blink 1.2s 0.4s infinite; }
      `}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    gap: 22,
    background:
      "radial-gradient(circle at 50% 10%, rgba(224,123,26,.16), transparent 30%), radial-gradient(circle at 12% 82%, rgba(34,197,94,.18), transparent 34%), linear-gradient(180deg,#fffaf2 0%,#f4f7f4 52%,#edf6ef 100%)",
    overflow: "hidden",
    padding: 28,
  },
  glowOne: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: "50%",
    background: "rgba(34,197,94,.18)",
    filter: "blur(24px)",
    top: "18%",
    right: -74,
  },
  glowTwo: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: "50%",
    background: "rgba(224,123,26,.18)",
    filter: "blur(26px)",
    bottom: "18%",
    left: -70,
  },
  brandBlock: {
    position: "relative",
    textAlign: "center",
    animation: "fc-fadein .45s ease both",
  },
  logo: {
    fontFamily: "'Nunito', sans-serif",
    fontSize: 32,
    fontWeight: 1000,
    letterSpacing: 0,
    lineHeight: 1,
  },
  sub: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 13,
    fontWeight: 800,
  },
  loaderCard: {
    position: "relative",
    width: 184,
    minHeight: 160,
    borderRadius: 30,
    background: "rgba(255,255,255,.74)",
    border: "1px solid rgba(255,255,255,.88)",
    boxShadow: "0 24px 56px rgba(15,23,42,.12)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    display: "grid",
    justifyItems: "center",
    alignContent: "center",
    gap: 16,
    animation: "fc-float 3.2s ease-in-out infinite",
  },
  appIcon: {
    width: 74,
    height: 74,
    borderRadius: 22,
    background: "linear-gradient(135deg,#25c961 0%,#8ea12f 48%,#e07b1a 100%)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    boxShadow: "0 16px 32px rgba(22,163,74,.22), inset 0 1px 0 rgba(255,255,255,.34)",
  },
  letterF: {
    fontSize: 31,
    fontWeight: 1000,
    lineHeight: 1,
  },
  letterC: {
    fontSize: 31,
    fontWeight: 1000,
    lineHeight: 1,
  },
  progress: {
    width: 118,
    height: 7,
    borderRadius: 999,
    overflow: "hidden",
    background: "#e7efe9",
    boxShadow: "inset 0 0 0 1px rgba(15,23,42,.04)",
  },
  progressFill: {
    display: "block",
    width: "72%",
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg,#16a34a,#e07b1a)",
    transformOrigin: "left center",
    animation: "fc-progress 1.55s ease-in-out infinite",
  },
  chips: {
    display: "flex",
    gap: 6,
  },
  greenChip: {
    borderRadius: 999,
    background: "#dcfce7",
    color: "#15803d",
    padding: "5px 8px",
    fontSize: 10,
    fontWeight: 900,
  },
  orangeChip: {
    borderRadius: 999,
    background: "#fff3e4",
    color: "#e07b1a",
    padding: "5px 8px",
    fontSize: 10,
    fontWeight: 900,
  },
  label: {
    position: "relative",
    fontSize: 13,
    fontWeight: 800,
    color: "#65736b",
    letterSpacing: 0,
  },
  d1: { opacity: 0, animation: "fc-blink 1.2s 0.0s infinite" },
  d2: { opacity: 0, animation: "fc-blink 1.2s 0.2s infinite" },
  d3: { opacity: 0, animation: "fc-blink 1.2s 0.4s infinite" },
};
