import { apiFetch } from "../../lib/api";

let registrationPromise = null;

function supportsPush() {
  return Boolean(
    window.isSecureContext &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
  );
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

async function registerWorker() {
  if (!supportsPush()) return null;
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
  }
  return registrationPromise;
}

export async function enableStaffPush() {
  if (!supportsPush()) {
    throw new Error("Browser push notifications are not supported here.");
  }

  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error("Push notifications are not configured yet.");
  }

  const registration = await registerWorker();
  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  await apiFetch("/notifications/subscribe", {
    method: "POST",
    body: { subscription: subscription.toJSON() },
  });

  return subscription;
}

export async function syncStaffPush({ silent = true } = {}) {
  if (!supportsPush() || Notification.permission !== "granted") return false;
  try {
    await enableStaffPush();
    return true;
  } catch (error) {
    if (!silent) throw error;
    return false;
  }
}

export async function disableStaffPush() {
  const registration = await registerWorker();
  const subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) return;

  await apiFetch("/notifications/subscribe", {
    method: "DELETE",
    body: { endpoint: subscription.endpoint },
  });

  await subscription.unsubscribe();
}
