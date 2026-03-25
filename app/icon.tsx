import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          borderRadius: 100,
        }}
      >
        <div
          style={{
            fontSize: 140,
            fontWeight: 1200,
            color: "#1a7a3c",
            lineHeight: 1,
          }}
        >
          Fanta
        </div>

        <div
          style={{
            fontSize: 140,
            fontWeight: 1200,
            color: "#ff7a20",
            lineHeight: 1,
          }}
        >
          Chat
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
