"use client";

export default function LoadingScreen() {
  return (
    <div style={s.wrap}>
      <div style={s.logo}>
        <span style={{ color: "#16a34a" }}>Fanta</span>
        <span style={{ color: "#ea580c" }}>Chat</span>
      </div>

      <div style={s.spinnerWrap}>
        {/* anello verde fisso */}
        <div style={s.ring} />
        {/* arco verde che gira */}
        <div style={s.arc} />
        {/* immagine Nyx al centro */}
        <div style={s.imgWrap}>
          <img src="/nyx-v2.png" alt="Nyx" style={s.img} />
        </div>
      </div>

      <div style={s.label}>
        Caricamento
        <span style={s.d1}>.</span>
        <span style={s.d2}>.</span>
        <span style={s.d3}>.</span>
      </div>

      <style>{`
        @keyframes fc-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fc-blink {
          0%, 100% { opacity: 0; }
          50%       { opacity: 1; }
        }
        @keyframes fc-fadein {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fc-logo  { animation: fc-fadein 0.5s ease both; }
        .fc-spin  { animation: fc-spin 1s cubic-bezier(0.4,0,0.2,1) infinite; }
        .fc-nyx   { animation: fc-fadein 0.5s ease 0.15s both; }
        .fc-label { animation: fc-fadein 0.5s ease 0.3s both; }
        .fc-d1 { animation: fc-blink 1.2s 0.0s infinite; }
        .fc-d2 { animation: fc-blink 1.2s 0.2s infinite; }
        .fc-d3 { animation: fc-blink 1.2s 0.4s infinite; }
      `}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    gap: 28,
    background: "#f1f5f1",
  },
  logo: {
    fontFamily: "'Syne', sans-serif",
    fontSize: 32,
    fontWeight: 800,
    letterSpacing: -1,
  },
  spinnerWrap: {
    position: "relative",
    width: 80,
    height: 80,
  },
  ring: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    border: "3px solid rgba(22,163,74,0.2)",
  },
  arc: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    border: "3px solid transparent",
    borderTopColor: "#16a34a",
    borderRightColor: "#16a34a",
    animation: "fc-spin 1s cubic-bezier(0.4,0,0.2,1) infinite",
  },
  imgWrap: {
    position: "absolute",
    inset: 6,
    borderRadius: "50%",
    overflow: "hidden",
    background: "linear-gradient(135deg, #1e293b, #374151)",
  },
  img: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "top center",
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "#9ca3af",
    letterSpacing: "0.3px",
  },
  d1: { opacity: 0, animation: "fc-blink 1.2s 0.0s infinite" },
  d2: { opacity: 0, animation: "fc-blink 1.2s 0.2s infinite" },
  d3: { opacity: 0, animation: "fc-blink 1.2s 0.4s infinite" },
};
