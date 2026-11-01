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

  if (!leagueId || !messageId) {
    return Response.json({ ok: false, error: "Dati messaggio mancanti." }, { status: 400 });
  }

  const { data: sender, error: senderError } = await supabaseServer
    .from("league_members")
    .select("team_name")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (senderError || !sender) {
    return Response.json({ ok: false, error: "Accesso negato." }, { status: 403 });
  }

  // The message content must come from the database, never from the browser.
  const { data: message, error: messageError } = await supabaseServer
    .from("messages")
    .select("id,content")
    .eq("id", messageId)
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (messageError) {
    return Response.json({ ok: false, error: "Non è stato possibile preparare la notifica." }, { status: 500 });
  }

  const content = String(message?.content ?? "");
  if (!message || !content.trim()) {
    return Response.json({ ok: false, error: "Messaggio non disponibile." }, { status: 404 });
  }

  const { data: members, error } = await supabaseServer
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId)
    .neq("user_id", user.id);

  if (error) {
    return Response.json({ ok: false, error: "Non è stato possibile caricare i destinatari della notifica." }, { status: 500 });
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
