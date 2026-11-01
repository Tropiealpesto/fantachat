import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <svg width="512" height="512" viewBox="0 0 512 512" fill="none">
        <rect width="512" height="512" fill="#ffffff" />
        <path
          d="M342 114a168 168 0 1 0-142 284"
          stroke="#E07B1A"
          strokeWidth="62"
          strokeLinecap="round"
        />
        <path
          d="M252 404V196a28 28 0 0 1 28-28h116"
          stroke="#137A3D"
          strokeWidth="62"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M254 278h116"
          stroke="#137A3D"
          strokeWidth="62"
          strokeLinecap="round"
        />
      </svg>
    ),
    { ...size }
  );
}
