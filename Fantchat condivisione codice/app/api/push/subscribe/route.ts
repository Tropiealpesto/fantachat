import type { NextRequest } from "next/server";
import { getRequestUser } from "../../../../lib/serverAuth";
import { supabaseServer } from "../../../../lib/supabaseServer";
import { pushConfigStatus } from "../../../../lib/push";

export const runtime = "nodejs";

type BrowserSubscription = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

export async function POST(request: NextRequest) {
  const { user } = await getRequestUser(request);
  if (!user) {
    return Response.json({ ok: false, error: "Sessione mancante." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    subscription?: BrowserSubscription;
    userAgent?: string;
  };

  const endpoint = body.subscription?.endpoint;
  const p256dh = body.subscription?.keys?.p256dh;
  const auth = body.subscription?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return Response.json({ ok: false, error: "Dispositivo notifiche non valido." }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: body.userAgent?.slice(0, 300) ?? null,
        enabled: true,
        updated_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, push: pushConfigStatus() });
}
