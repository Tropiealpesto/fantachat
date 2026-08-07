import type { NextRequest } from "next/server";

type SyncOptions = {
  catalog?: boolean;
  fixtures?: boolean;
  stats?: boolean;
  expectedLineups?: boolean;
  matchday?: number;
  statsWindowHoursBefore?: number;
  statsWindowHoursAfter?: number;
  expectedLineupsWindowHours?: number;
};

type SyncModule = {
  runSportmonksSync: (options: SyncOptions) => Promise<unknown>;
};

export async function runSportmonksCron(
  request: NextRequest,
  mode: string,
  options: SyncOptions
) {
  const authHeader = request.headers.get("authorization");

  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  try {
    const syncModule = (await import("../../../../scripts/sportmonks-sync.mjs")) as SyncModule;
    const summary = await syncModule.runSportmonksSync(options);

    return Response.json({
      ok: true,
      mode,
      duration_ms: Date.now() - startedAt,
      summary,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        mode,
        duration_ms: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
