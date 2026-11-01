import type { NextRequest } from "next/server";
import { processNotificationJobs } from "../../notifications/process/route";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const summary = await processNotificationJobs();

  return Response.json({
    ok: true,
    duration_ms: Date.now() - startedAt,
    summary,
  });
}
