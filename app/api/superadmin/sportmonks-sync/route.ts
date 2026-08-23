import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ ok: false, error: "Sessione mancante." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return Response.json({ ok: false, error: "Configurazione Supabase mancante." }, { status: 500 });
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: isSuperadmin, error: roleError } = await client.rpc("is_current_user_superadmin");

  if (roleError || isSuperadmin !== true) {
    return Response.json({ ok: false, error: "Solo superadmin." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const matchday = Number(body?.matchday ?? 0);
  const mode = String(body?.mode ?? "recent");
  const startedAt = Date.now();

  try {
    const syncModule = (await import("../../../../scripts/sportmonks-sync.mjs")) as SyncModule;
    const syncOptions =
      mode === "catalog"
        ? {
            catalog: true,
            fixtures: true,
            stats: false,
            expectedLineups: false,
            matchday: matchday > 0 ? matchday : undefined,
          }
        : mode === "full"
          ? {
              catalog: true,
              fixtures: true,
              stats: true,
              expectedLineups: true,
              matchday: matchday > 0 ? matchday : undefined,
              statsWindowHoursBefore: 12,
              statsWindowHoursAfter: 3,
              expectedLineupsWindowHours: 96,
            }
          : {
              catalog: false,
              fixtures: false,
              stats: true,
              expectedLineups: false,
              matchday: matchday > 0 ? matchday : undefined,
              statsWindowHoursBefore: 72,
              statsWindowHoursAfter: 6,
            };

    const summary = await syncModule.runSportmonksSync({
      ...syncOptions,
    });

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
        duration_ms: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
