"use client";

export default function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <img
      src="/icons/icon-192.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0, objectFit: "cover" }}
    />
  );
}
