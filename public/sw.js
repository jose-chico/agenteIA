self.addEventListener("push", event => {
    const data = event.data ? event.data.json() : {};

    self.registration.showNotification(data.title || "Nova Mensagem", {
        body: data.body || "Você tem uma nova mensagem.",
        icon: data.icon || "https://cdn-icons-png.flaticon.com/512/3233/3233508.png",
        vibrate: [200, 100, 200, 100, 200], // Mantém vibração
        data: { url: data.url || "/" }
    });
});

self.addEventListener("notificationclick", event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: "window" }).then(windowClients => {
            // Tenta focar numa aba já aberta
            for (let client of windowClients) {
                if (client.url.includes("index.html") && "focus" in client) {
                    return client.focus();
                }
            }
            // Se não tiver aba aberta, abre uma nova
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data.url);
            }
        })
    );
});
