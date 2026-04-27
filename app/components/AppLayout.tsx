"use client";

import React, { useState } from "react";
import { useApp } from "./AppContext";
import BottomNav from "./BottomNav";
import SideDrawer from "./SideDrawer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { teamName, leagueName, role, openDrawer } = useApp();

  const isAdmin = role === "admin";

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <main style={{ flex: 1 }}>
        {children}
      </main>

      <BottomNav
        onMenuOpen={() => setDrawerOpen(true)}
      />

      <SideDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        teamName={teamName}
        leagueName={leagueName}
        isAdmin={isAdmin}
        isSuperAdmin={isAdmin}
      />
    </div>
  );
}