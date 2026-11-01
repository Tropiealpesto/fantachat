import type { ReactNode } from "react";

// Admin pages depend on the authenticated Supabase session and must not be
// prerendered as public static content.
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
