/* eslint-disable no-restricted-globals */
import { precacheAndRoute } from "workbox-precaching";

// vite-plugin-pwa가 빌드할 때 이 자리에 캐시할 파일 목록을 자동으로 채워 넣어요.
precacheAndRoute(self.__WB_MANIFEST);

// ============================================================================
// 푸시 알림 (앱을 안 보고 있어도 폰에 뜨는 알림)
// ----------------------------------------------------------------------------
// 지금은 아직 아무도 push 이벤트를 "보내주는" 서버가 없어서 이 코드는 대기만 해요.
// Firebase Cloud Messaging(또는 다른 웹푸시 서비스) 연결을 끝내면,
// 그쪽에서 보낸 메시지가 여기 'push' 이벤트로 도착하고, 아래 코드가 실제
// 알림을 화면에 띄워줘요. 지금 당장 코드를 더 만질 필요는 없어요.
// ============================================================================
self.addEventListener("push", (event) => {
  let data = { title: "안주인의 전갈", body: "새 소식이 도착했어요." };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

// 알림을 눌렀을 때 앱을 열어줘요.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
