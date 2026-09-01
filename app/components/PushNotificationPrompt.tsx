"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useApp } from "./AppContext";

type Status = "checking" | "unsupported" | "hidden" | "ready" | "denied" | "active" | "busy";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

async function postWithSession(path: string, body: unknown) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessione mancante.");

  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok || json?.ok === false) {
    throw new Error(json?.error ?? "Operazione non riuscita.");
  }

  return json;
}

export default function PushNotificationPrompt() {
  const app = useApp();
  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState<string | null>(null);

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!app.ready || !app.userId) return;
    let active = true;
    const deferStatus = (next: Status) => {
      queueMicrotask(() => {
        if (active) setStatus(next);
      });
    };

    if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      deferStatus("unsupported");
      return () => {
        active = false;
      };
    }

    if (Notification.permission === "denied") {
      deferStatus("denied");
      return () => {
        active = false;
      };
    }

    if (Notification.permission === "granted") {
      navigator.serviceWorker.ready
        .then((registration) => registration.pushManager.getSubscription())
        .then((subscription) => {
          if (active) setStatus(subscription ? "active" : "ready");
        })
        .catch(() => {
          if (active) setStatus("ready");
        });
      return () => {
        active = false;
      };
    }

    deferStatus("ready");
    return () => {
      active = false;
    };
  }, [app.ready, app.userId, publicKey]);

  async function activate() {
    if (!publicKey) return;

    setStatus("busy");
    setMessage(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "ready");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));

      await postWithSession("/api/push/subscribe", {
        subscription: subscription.toJSON(),
        userAgent: navigator.userAgent,
      });

      await postWithSession("/api/push/test", {});

      setStatus("active");
      setMessage("Notifiche attive.");
    } catch (error) {
      setStatus("ready");
      setMessage(error instanceof Error ? error.message : "Notifiche non attivate.");
    }
  }

  if (!app.ready || !app.userId || status === "checking" || status === "hidden" || status === "unsupported") {
    return null;
  }

  if (status === "denied") {
    return (
      <section style={s.card}>
        <div style={s.icon}>!</div>
        <div>
          <h2 style={s.title}>Notifiche bloccate</h2>
          <p style={s.text}>Puoi riattivarle dalle impostazioni del browser o dell'app.</p>
        </div>
      </section>
    );
  }

  if (status === "active") {
    return (
      <section style={s.card}>
        <div style={s.icon}>✓</div>
        <div>
          <h2 style={s.title}>Notifiche attive</h2>
          <p style={s.text}>Ti avvisiamo per chat, slot, bozze e aggiornamenti punteggi.</p>
          {message && <p style={s.ok}>{message}</p>}
        </div>
      </section>
    );
  }

  return (
    <section style={s.card}>
      <div style={s.icon}>•</div>
      <div style={{ minWidth: 0 }}>
        <h2 style={s.title}>Attiva notifiche</h2>
        <p style={s.text}>Ricevi avvisi per chat, slot formazione, bozze e punteggi live.</p>
        {message && <p style={s.error}>{message}</p>}
      </div>
      <button type="button" style={s.button} onClick={activate} disabled={status === "busy"}>
        {status === "busy" ? "Attivo..." : "Attiva"}
      </button>
    </section>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    display: "grid",
    gridTemplateColumns: "34px 1fr auto",
    gap: 10,
    alignItems: "center",
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 12,
    boxShadow: "0 5px 18px rgba(15,23,42,.05)",
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    display: "grid",
    placeItems: "center",
    background: "#f0fdf4",
    color: "#15803d",
    fontSize: 18,
    fontWeight: 1000,
  },
  title: { margin: 0, color: "#0f172a", fontSize: 14, fontWeight: 1000 },
  text: { margin: "3px 0 0", color: "#64748b", fontSize: 11.5, lineHeight: 1.3, fontWeight: 800 },
  ok: { margin: "5px 0 0", color: "#15803d", fontSize: 11.5, fontWeight: 900 },
  error: { margin: "5px 0 0", color: "#dc2626", fontSize: 11.5, fontWeight: 900 },
  button: {
    border: 0,
    borderRadius: 12,
    background: "#15803d",
    color: "white",
    padding: "10px 12px",
    fontFamily: "inherit",
    fontSize: 12,
    fontWeight: 1000,
    cursor: "pointer",
  },
};
