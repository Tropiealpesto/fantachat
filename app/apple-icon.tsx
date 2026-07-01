import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg,#25c961 0%,#94a22e 48%,#ee8516 100%)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,.06)",
            clipPath: "polygon(0 100%, 24.4% 64.4%, 49.4% 43.3%, 100% 23.3%, 100% 100%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 18% 0%, rgba(255,255,255,.18), transparent 46%)",
          }}
        />

        <div
          style={{
            color: "#ffffff",
            fontSize: 214,
            fontWeight: 1000,
            letterSpacing: -16,
            lineHeight: 1,
            textShadow: "2px 3px 0 rgba(0,0,0,.10)",
          }}
        >
          FC
        </div>
      </div>
    ),
    { ...size }
  );
}
