import type { NextRequest } from "next/server";
import { getRequestUser } from "../../../../lib/serverAuth";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { notifyUsers } from "../../../../lib/push";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { client, user } = await getRequestUser(request);
  if (!client || !user) {
    return Response.json({ ok: false, error: "Sessione mancante." }, { status: 401 });
  }

  const { data: isSuperadmin, error: roleError } = await client.rpc("is_current_user_superadmin");
  if (roleError || isSuperadmin !== true) {
    return Response.json({ ok: false, error: "Solo superadmin." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const competitionId = String(body?.competitionId ?? "");
  const seasonId = String(body?.seasonId ?? "");
  const matchdayNumber = Number(body?.matchdayNumber ?? 0);

  if (!competitionId || !seasonId || !matchdayNumber) {
    return Response.json({ ok: false, error: "Dati giornata mancanti." }, { status: 400 });
  }

  const { data: matchday } = await supabaseServer
    .from("matchdays")
    .select("id,number")
    .eq("season_id", seasonId)
    .eq("number", matchdayNumber)
    .maybeSingle();

  if (!matchday?.id) {
    return Response.json({ ok: false, error: "Giornata non trovata." }, { status: 404 });
  }

  const { data: leagueCompetitions, error: lcError } = await supabaseServer
    .from("league_competitions")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("season_id", seasonId)
    .eq("status", "active");

  if (lcError) {
    return Response.json({ ok: false, error: lcError.message }, { status: 500 });
  }

  const lcIds = (leagueCompetitions ?? []).map((row) => row.id);
  if (lcIds.length === 0) return Response.json({ ok: true, result: { sent: 0, skipped: 0, failed: 0 } });

  const { data: members, error: membersError } = await supabaseServer
    .from("league_competition_members")
    .select("user_id")
    .in("league_competition_id", lcIds);

  if (membersError) {
    return Response.json({ ok: false, error: membersError.message }, { status: 500 });
  }

  const result = await notifyUsers(
    (members ?? []).map((m) => m.user_id),
    {
      title: `Giornata ${matchday.number} aperta`,
      body: "Giornata aperta: scopri il tuo slot e salva pure la tua bozza.",
      url: "/rosa",
      tag: `matchday:${matchday.id}`,
    },
    { eventKey: `matchday-opened:${matchday.id}` }
  );

  return Response.json({ ok: true, result });
}
