"use client";

const TIPS = [
  "Anche l'allenatore può fare la differenza.",
  "La chat è parte del gioco.",
  "Non guardare solo gol e assist.",
  "Le coppe cambiano il peso di ogni scelta.",
  "Le statistiche raccontano più del risultato.",
  "Una scelta giusta può valere una giornata.",
];

export default function LoadingScreen() {
  const tip = TIPS[new Date().getSeconds() % TIPS.length];

  return (
    <div style={s.wrap}>
      <div style={s.center}>
        <div style={s.markWrap}>
          <div style={s.ring} />
          <div style={s.arc} />
          <div style={s.mark}>
            <span style={s.letters}>FC</span>
          </div>
        </div>

        <div style={s.logo} aria-label="FantaChat">
          <span style={{ color: "#137A3D" }}>Fanta</span>
          <span style={{ color: "#E07B1A" }}>Chat</span>
        </div>
      </div>

      <div style={s.tipCard}>
        <div style={s.tipLabel}>TIP DI LEGA</div>
        <div style={s.tipText}>{tip}</div>
      </div>

      <style>{`
        @keyframes fc-loading-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fc-loading-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: "100dvh",
    position: "relative",
    display: "grid",
    placeItems: "center",
    padding: "24px 24px calc(env(safe-area-inset-bottom, 0px) + 34px)",
    background: "linear-gradient(180deg,#ffffff 0%,#f7faf7 58%,#eef4ef 100%)",
    overflow: "hidden",
  },
  center: {
    display: "grid",
    justifyItems: "center",
    gap: 24,
    transform: "translateY(6px)",
    animation: "fc-loading-in .38s ease both",
  },
  markWrap: {
    width: 150,
    height: 150,
    position: "relative",
    display: "grid",
    placeItems: "center",
    filter: "drop-shadow(0 20px 24px rgba(15,23,42,.11))",
  },
  ring: {
    position: "absolute",
    inset: 8,
    borderRadius: "50%",
    border: "7px solid #e3ebe5",
  },
  arc: {
    position: "absolute",
    inset: 8,
    borderRadius: "50%",
    border: "7px solid transparent",
    borderTopColor: "#16A34A",
    borderRightColor: "#E07B1A",
    animation: "fc-loading-spin 1s linear infinite",
  },
  mark: {
    width: 110,
    height: 110,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(135deg,#22C55E 0%,#8FA334 50%,#E07B1A 100%)",
    position: "relative",
    overflow: "hidden",
  },
  letters: {
    color: "white",
    fontSize: 43,
    fontWeight: 1000,
    letterSpacing: "-0.06em",
    lineHeight: 1,
    transform: "translateX(-1px)",
  },
  logo: {
    fontFamily: "'Nunito', Arial, Helvetica, sans-serif",
    fontSize: 38,
    fontWeight: 1000,
    lineHeight: 1,
    letterSpacing: 0,
  },
  tipCard: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: "calc(env(safe-area-inset-bottom, 0px) + 42px)",
    maxWidth: 520,
    margin: "0 auto",
    minHeight: 82,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    gap: 8,
    padding: "14px 16px",
    boxShadow: "0 10px 28px rgba(15,23,42,.06)",
    animation: "fc-loading-in .42s ease .08s both",
  },
  tipLabel: {
    fontSize: 10,
    fontWeight: 1000,
    color: "#E07B1A",
    letterSpacing: "0.12em",
  },
  tipText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: 850,
    lineHeight: 1.25,
    textAlign: "center",
  },
};
