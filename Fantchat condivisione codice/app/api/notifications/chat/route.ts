import type { NextRequest } from "next/server";
import { getRequestUser } from "../../../../lib/serverAuth";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { notifyUsers, truncateNotificationText } from "../../../../lib/push";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { user } = await getRequestUser(request);
  if (!user) {
    return Response.json({ ok: false, error: "Sessione mancante." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const leagueId = String(body?.leagueId ?? "");
  const messageId = String(body?.messageId ?? "");
  const content = String(body?.content ?? "");

  if (!leagueId || !messageId || !content.trim()) {
    return Response.json({ ok: false, error: "Dati messaggio mancanti." }, { status: 400 });
  }

  const { data: sender } = await supabaseServer
    .from("league_members")
    .select("team_name")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!sender) {
    return Response.json({ ok: false, error: "Accesso negato." }, { status: 403 });
  }

  const { data: members, error } = await supabaseServer
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId)
    .neq("user_id", user.id);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const result = await notifyUsers(
    (members ?? []).map((m) => m.user_id),
    {
      title: "Nuovo messaggio in chat",
      body: `${sender.team_name ?? "Una squadra"}: ${truncateNotificationText(content)}`,
      url: "/chat",
      tag: `chat:${leagueId}`,
    },
    { eventKey: `chat:${messageId}` }
  );

  return Response.json({ ok: true, result });
}
