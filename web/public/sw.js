self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Vhitepizza", body: event.data?.text() || "New staff alert." };
  }

  const title = data.title || "Vhitepizza";
  const options = {
    body: data.body || "You have a new Vhitepizza alert.",
    icon: "/favicon.png",
    badge: "/favicon.png",
    tag: data.tag || "vhitepizza-alert",
    renotify: true,
    data: {
      url: data.url || "/staff/admin",
      orderId: data.orderId || null,
      type: data.type || "staff_alert",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/staff/admin";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find((client) => "focus" in client);
      if (existing) {
        existing.navigate(target);
        return existing.focus();
      }
      return clients.openWindow(target);
    })
  );
});
