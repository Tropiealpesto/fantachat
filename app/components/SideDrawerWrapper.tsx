"use client";

import { useApp } from "./AppContext";
import SideDrawer from "./SideDrawer";

export default function SideDrawerWrapper() {
  const { drawerOpen, closeDrawer, teamName, leagueName, role, openDrawer } = useApp();
  const isAdmin = role === "admin";

  return (
    <SideDrawer
      isOpen={drawerOpen}
      onClose={closeDrawer}
      teamName={teamName}
      leagueName={leagueName}
      isAdmin={isAdmin}
      isSuperAdmin={isAdmin}
    />
  );
}