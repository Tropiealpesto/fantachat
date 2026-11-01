import type { NextRequest } from "next/server";
import { runSportmonksCron } from "../_lib/sportmonksCron";

export const runtime = "nodejs";
export const maxDuration = 300;

export function GET(request: NextRequest) {
  return runSportmonksCron(request, "expected-lineups", {
    expectedLineups: true,
    expectedLineupsWindowHours: 72,
  });
}
