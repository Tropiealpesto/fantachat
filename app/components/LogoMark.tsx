"use client";

export default function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <path
        d="M171 57a84 84 0 1 0-71 142"
        stroke="#E07B1A"
        strokeWidth="31"
        strokeLinecap="round"
      />
      <path
        d="M126 202V98a14 14 0 0 1 14-14h58"
        stroke="#137A3D"
        strokeWidth="31"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M127 139h58"
        stroke="#137A3D"
        strokeWidth="31"
        strokeLinecap="round"
      />
    </svg>
  );
}
