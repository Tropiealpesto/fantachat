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
    background:
      "linear-gradient(180deg, rgba(255,255,255,.82), rgba(255,255,255,0) 220px), repeating-linear-gradient(135deg, rgba(20,83,45,.04) 0 1px, transparent 1px 18px), #eef3ef",
  },
  logo: {
    fontFamily: "'Nunito', sans-serif",
    fontSize: 32,
    fontWeight: 1000,
    letterSpacing: 0,
  },
  spinnerWrap: {
    position: "relative",
    width: 88,
    height: 88,
  },
  ring: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    border: "3px solid rgba(22,163,74,0.18)",
    boxShadow: "0 18px 36px rgba(19,35,26,.12)",
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
    inset: 8,
    borderRadius: 8,
    overflow: "hidden",
    background: "linear-gradient(135deg, #102018, #244332)",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14)",
  },
  img: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "top center",
  },
  label: {
    fontSize: 13,
    fontWeight: 800,
    color: "#65736b",
    letterSpacing: 0,
  },
  d1: { opacity: 0, animation: "fc-blink 1.2s 0.0s infinite" },
  d2: { opacity: 0, animation: "fc-blink 1.2s 0.2s infinite" },
  d3: { opacity: 0, animation: "fc-blink 1.2s 0.4s infinite" },
};
