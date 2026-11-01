import type { NextRequest } from "next/server";
import { getRequestUser } from "../../../../lib/serverAuth";
import { processNotificationJobs } from "../../../../lib/notificationJobs";

export const runtime = "nodejs";

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

  const summary = await processNotificationJobs(body);
  return Response.json({ ok: true, summary });
}
