import webpush from "web-push";
import { supabaseServer } from "./supabaseServer";

type PushRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

type NotifyOptions = {
  eventKey?: string;
};

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:fantachat.app.2026@gmail.com";

  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export function pushConfigStatus() {
  return {
    configured: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
  };
}

export async function notifyUsers(userIds: string[], payload: PushPayload, options: NotifyOptions = {}) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) return { sent: 0, skipped: 0, failed: 0 };
  if (!configureWebPush()) return { sent: 0, skipped: uniqueUserIds.length, failed: 0 };

  const { data: subscriptions, error } = await supabaseServer
    .from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth")
    .in("user_id", uniqueUserIds)
    .eq("enabled", true);

  if (error || !subscriptions?.length) {
    return { sent: 0, skipped: uniqueUserIds.length, failed: 0 };
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const deliveryByUser = new Map<string, string | null>();

  for (const sub of subscriptions as PushRow[]) {
    let deliveryId: string | null = null;

    if (options.eventKey) {
      if (!deliveryByUser.has(sub.user_id)) {
        deliveryByUser.set(sub.user_id, await reserveDelivery(sub.user_id, payload, options.eventKey));
      }

      deliveryId = deliveryByUser.get(sub.user_id) ?? null;

      if (!deliveryId) {
        skipped += 1;
        continue;
      }
    }

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(payload)
      );

      sent += 1;
      if (deliveryId) {
        await supabaseServer
          .from("notification_deliveries")
          .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
          .eq("id", deliveryId);
      }
    } catch (error: any) {
      failed += 1;
      const statusCode = Number(error?.statusCode ?? error?.status ?? 0);
      const message = error instanceof Error ? error.message : String(error);

      if (statusCode === 404 || statusCode === 410) {
        await supabaseServer
          .from("push_subscriptions")
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq("id", sub.id);
      }

      if (deliveryId) {
        await supabaseServer
          .from("notification_deliveries")
          .update({ status: "failed", error: message.slice(0, 500) })
          .eq("id", deliveryId);
      }
    }
  }

  return { sent, skipped, failed };
}

async function reserveDelivery(userId: string, payload: PushPayload, eventKey?: string) {
  if (!eventKey) return null;

  const { data, error } = await supabaseServer
    .from("notification_deliveries")
    .insert({
      user_id: userId,
      event_key: eventKey,
      title: payload.title,
      body: payload.body,
      url: payload.url ?? "/",
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return null;
  return data?.id ?? null;
}

export function truncateNotificationText(value: string, max = 110) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 3)}...`;
}
