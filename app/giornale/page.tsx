"use client";

import { Suspense } from "react";
import GiornaleClient from "./GiornaleClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>Caricamento...</div>}>
      <GiornaleClient />
    </Suspense>
  );
}
