"use client";

import { usePathname, useRouter } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const go = (p: string) => router.push(p);
  const active = (p: string) => (pathname === p ? "nav-btn active" : "nav-btn");

  return (
    <div className="bottom-nav">
      <div className="tabs">
        <button className={active("/")} onClick={() => go("/")}>Home</button>
        <button className={active("/live")} onClick={() => go("/live")}>Live</button>
        <button className={active("/rosa")} onClick={() => go("/rosa")}>Rosa</button>
        <button className={active("/classifica")} onClick={() => go("/classifica")}>Classifica</button>
      </div>
    </div>
  );
}
