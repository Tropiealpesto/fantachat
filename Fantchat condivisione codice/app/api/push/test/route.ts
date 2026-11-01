import type { NextRequest } from "next/server";
import { getRequestUser } from "../../../../lib/serverAuth";
import { notifyUsers } from "../../../../lib/push";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { user } = await getRequestUser(request);
  if (!user) {
    return Response.json({ ok: false, error: "Sessione mancante." }, { status: 401 });
  }

  const result = await notifyUsers(
    [user.id],
    {
      title: "FantaChat",
      body: "Notifiche attive. Ti avviseremo per chat, slot, bozze e punteggi.",
      url: "/",
      tag: "push-test",
    },
    { eventKey: `push-test:${user.id}:${Date.now()}` }
  );

  if (result.sent === 0) {
    return Response.json(
      {
        ok: false,
        error: "Notifica di test non inviata. Controlla configurazione VAPID e permessi del dispositivo.",
        result,
      },
      { status: 500 }
    );
  }

  return Response.json({ ok: true, result });
}
