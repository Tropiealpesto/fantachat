"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useApp } from "./AppContext";
import { humanError } from "../../lib/humanError";

type Status = "checking" | "hidden" | "ready" | "active" | "busy";

function decisionKey(userId: string) {
  return `fantachat:notifications-decision:${userId}`;
}

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

async function getPushRegistration() {
  if (!navigator.serviceWorker.controller) {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }

  return navigator.serviceWorker.ready;
}

async function saveSubscription(publicKey: string) {
  const registration = await getPushRegistration();
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

  return subscription;
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
    try {
      if (window.localStorage.getItem(decisionKey(app.userId)) === "done") {
        deferStatus("hidden");
        return () => {
          active = false;
        };
      }
    } catch {}

    if (!publicKey) {
      deferStatus("hidden");
      return () => {
        active = false;
      };
    }

    if (!window.isSecureContext) {
      deferStatus("hidden");
      return () => {
        active = false;
      };
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      deferStatus("hidden");
      return () => {
        active = false;
      };
    }

    if (Notification.permission === "denied") {
      deferStatus("hidden");
      return () => {
        active = false;
      };
    }

    if (Notification.permission === "granted") {
      saveSubscription(publicKey)
        .then(() => {
          if (active) setStatus("active");
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

    markDecision();
    setStatus("busy");
    setMessage(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("hidden");
        return;
      }

      await saveSubscription(publicKey);
      await postWithSession("/api/push/test", {});

      setStatus("active");
    } catch (error) {
      setStatus("ready");
      setMessage(humanError(error, "Notifiche non attivate. Riprova da Chrome o dall'app installata."));
    }
  }

  function markDecision() {
    try {
      if (app.userId) window.localStorage.setItem(decisionKey(app.userId), "done");
    } catch {}
  }

  function dismiss() {
    markDecision();
    setStatus("hidden");
  }

  if (!app.ready || !app.userId || status === "checking" || status === "hidden" || status === "active") {
    return null;
  }

  return (
    <div style={s.backdrop} role="presentation">
      <section style={s.modal} role="dialog" aria-modal="true" aria-labelledby="notification-prompt-title">
        <div style={s.icon}>•</div>
        <h2 id="notification-prompt-title" style={s.title}>Vuoi ricevere notifiche?</h2>
        <p style={s.text}>Ricevi avvisi per chat, slot formazione, bozze e punteggi live.</p>
        {message && <p style={s.error}>{message}</p>}
        <div style={s.actions}>
          <button type="button" style={s.dismiss} onClick={dismiss} disabled={status === "busy"}>Non ora</button>
          <button type="button" style={s.button} onClick={activate} disabled={status === "busy"}>
            {status === "busy" ? "Attivazione..." : "Attiva"}
          </button>
        </div>
      </section>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 250,
    display: "grid",
    placeItems: "center",
    padding: 20,
    background: "rgba(15, 23, 42, .42)",
    backdropFilter: "blur(4px)",
  },
  modal: {
    width: "min(100%, 360px)",
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 20,
    padding: 22,
    boxShadow: "0 24px 70px rgba(15,23,42,.24)",
    textAlign: "center",
  },
  icon: {
    width: 44,
    height: 44,
    margin: "0 auto 12px",
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "#f0fdf4",
    color: "#15803d",
    fontSize: 22,
    fontWeight: 1000,
  },
  title: { margin: 0, color: "#0f172a", fontSize: 18, fontWeight: 1000 },
  text: { margin: "8px 0 0", color: "#64748b", fontSize: 13, lineHeight: 1.4, fontWeight: 700 },
  error: { margin: "8px 0 0", color: "#dc2626", fontSize: 12, fontWeight: 900 },
  button: {
    flex: 1,
    border: 0,
    borderRadius: 12,
    background: "#15803d",
    color: "white",
    padding: "11px 12px",
    fontFamily: "inherit",
    fontSize: 12,
    fontWeight: 1000,
    cursor: "pointer",
  },
  actions: { display: "flex", alignItems: "center", gap: 8, marginTop: 18 },
  dismiss: {
    flex: 1,
    border: "1px solid #d1d5db",
    borderRadius: 12,
    background: "white",
    color: "#64748b",
    padding: "11px 9px",
    fontFamily: "inherit",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
};
