import type { NextRequest } from "next/server";
import { getRequestUser } from "../../../../lib/serverAuth";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { notifyUsers } from "../../../../lib/push";

export const runtime = "nodejs";

type Summary = {
  slotStarted: Awaited<ReturnType<typeof notifyUsers>>;
  slotEnding: Awaited<ReturnType<typeof notifyUsers>>;
  drafts: Awaited<ReturnType<typeof notifyUsers>>;
  scores: Awaited<ReturnType<typeof notifyUsers>>;
};

export async function POST(request: NextRequest) {
  return processNotifications(request, await request.json().catch(() => ({})));
}

export async function GET(request: NextRequest) {
  return processNotifications(request, {});
}

async function processNotifications(request: NextRequest, body: any) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  let allowed = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

  if (!allowed) {
    const { client, user } = await getRequestUser(request);
    if (!client || !user) {
      return Response.json({ ok: false, error: "Sessione mancante." }, { status: 401 });
    }

    const { data: isSuperadmin } = await client.rpc("is_current_user_superadmin");
    allowed = isSuperadmin === true;
  }

  if (!allowed) {
    return Response.json({ ok: false, error: "Solo superadmin." }, { status: 403 });
  }

  const [slotStarted, slotEnding, drafts, scores] = await Promise.all([
    notifySlotStarted(),
    notifySlotEndingSoon(),
    notifyDraftResults(),
    notifyScoresUpdated(body),
  ]);

  const summary: Summary = { slotStarted, slotEnding, drafts, scores };
  return Response.json({ ok: true, summary });
}

async function notifySlotStarted() {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

  const { data: slots } = await supabaseServer
    .from("lineup_slots")
    .select("id,user_id,matchday_id,starts_at,ends_at")
    .lte("starts_at", now.toISOString())
    .gte("starts_at", fiveMinutesAgo.toISOString());

  let result = { sent: 0, skipped: 0, failed: 0 };

  for (const slot of slots ?? []) {
    const partial = await notifyUsers(
      [slot.user_id],
      {
        title: "E il tuo turno",
        body: "Puoi salvare la formazione ufficiale.",
        url: "/rosa",
        tag: `slot:${slot.id}`,
      },
      { eventKey: `slot-start:${slot.id}` }
    );
    result = addResult(result, partial);
  }

  return result;
}

async function notifySlotEndingSoon() {
  const now = new Date();
  const soon = new Date(now.getTime() + 15 * 60 * 1000);

  const { data: slots } = await supabaseServer
    .from("lineup_slots")
    .select("id,user_id,league_competition_id,matchday_id,ends_at")
    .gt("ends_at", now.toISOString())
    .lte("ends_at", soon.toISOString());

  let result = { sent: 0, skipped: 0, failed: 0 };

  for (const slot of slots ?? []) {
    const { data: existing } = await supabaseServer
      .from("lineups")
      .select("id")
      .eq("league_competition_id", slot.league_competition_id)
      .eq("matchday_id", slot.matchday_id)
      .eq("user_id", slot.user_id)
      .not("submitted_at", "is", null)
      .maybeSingle();

    if (existing?.id) continue;

    const partial = await notifyUsers(
      [slot.user_id],
      {
        title: "Slot quasi finito",
        body: "Il tuo slot sta per finire. Controlla la bozza o salva la formazione.",
        url: "/rosa",
        tag: `slot:${slot.id}:ending`,
      },
      { eventKey: `slot-ending:${slot.id}` }
    );
    result = addResult(result, partial);
  }

  return result;
}

async function notifyDraftResults() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { data: drafts } = await supabaseServer
    .from("lineup_drafts")
    .select("id,user_id,status,error")
    .in("status", ["submitted", "failed"])
    .gte("processed_at", since.toISOString());

  let result = { sent: 0, skipped: 0, failed: 0 };

  for (const draft of drafts ?? []) {
    const failed = draft.status === "failed";
    const partial = await notifyUsers(
      [draft.user_id],
      {
        title: failed ? "Bozza non salvata" : "Bozza salvata automaticamente",
        body: failed
          ? "La tua squadra salvata in bozza non e stata salvata: controlla i vincoli e i giocatori disponibili."
          : "La tua bozza era valida ed e stata salvata come formazione.",
        url: "/rosa",
        tag: `draft:${draft.id}`,
      },
      { eventKey: `draft:${draft.id}:${draft.status}` }
    );
    result = addResult(result, partial);
  }

  return result;
}

async function notifyScoresUpdated(body: any) {
  const competitionId = String(body?.competitionId ?? "");
  const seasonId = String(body?.seasonId ?? "");
  const matchdayNumber = Number(body?.matchdayNumber ?? 0);

  if (!competitionId || !seasonId || !matchdayNumber) {
    return { sent: 0, skipped: 0, failed: 0 };
  }

  const { data: leagueCompetitions } = await supabaseServer
    .from("league_competitions")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("season_id", seasonId)
    .eq("status", "active");

  const lcIds = (leagueCompetitions ?? []).map((row) => row.id);
  if (lcIds.length === 0) return { sent: 0, skipped: 0, failed: 0 };

  const { data: members } = await supabaseServer
    .from("league_competition_members")
    .select("user_id")
    .in("league_competition_id", lcIds);

  const bucket = Math.floor(Date.now() / (10 * 60 * 1000));

  return notifyUsers(
    (members ?? []).map((m) => m.user_id),
    {
      title: "Punteggi aggiornati",
      body: "Punteggi aggiornati: controlla live e classifica.",
      url: "/live",
      tag: `scores:${competitionId}:${seasonId}:${matchdayNumber}`,
    },
    { eventKey: `scores-updated:${competitionId}:${seasonId}:${matchdayNumber}:${bucket}` }
  );
}

function addResult(a: Awaited<ReturnType<typeof notifyUsers>>, b: Awaited<ReturnType<typeof notifyUsers>>) {
  return {
    sent: a.sent + b.sent,
    skipped: a.skipped + b.skipped,
    failed: a.failed + b.failed,
  };
}
