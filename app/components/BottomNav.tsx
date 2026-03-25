"use client";

import { usePathname, useRouter } from "next/navigation";

const TABS = [
{ path: "/",          label: "Home",      icon: "🏠" },
{ path: "/live",      label: "Live",      icon: "⚡" },
{ path: "/rosa",      label: "Rosa",      icon: "👥" },
{ path: "/classifica",label: "Classifica",icon: "🏆" },
];

export default function BottomNav() {
const pathname = usePathname();
const router = useRouter();

return (
<nav className="bottom-nav">
<div className="tabs">
{TABS.map((tab) => (
<button
key={tab.path}
className={pathname === tab.path ? "nav-btn active" : "nav-btn"}
data-icon={tab.icon}
onClick={() => router.push(tab.path)}
>
{tab.label}
</button>
))}
</div>
</nav>
);
}
