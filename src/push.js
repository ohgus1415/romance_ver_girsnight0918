// ============================================================================
// 푸시 알림 구독 준비 (Firebase 연결 후 사용)
// ----------------------------------------------------------------------------
// 아래 VAPID_PUBLIC_KEY 자리에, Firebase 콘솔 > 프로젝트 설정 > 클라우드 메시징
// 에서 발급받은 "웹 푸시 인증서 키 쌍"의 공개 키를 붙여넣으면 바로 동작해요.
// (지금은 비어있어서 requestPushPermission()을 호출해도 조용히 실패해요.)
// ============================================================================

const VAPID_PUBLIC_KEY = ""; // TODO: Firebase에서 발급받은 공개 키를 여기 붙여넣으세요

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// 알림 권한을 묻고, 허락하면 이 기기의 "구독 정보"를 돌려줘요.
// 이 구독 정보를 서버(Firebase 등)에 저장해둬야 나중에 그쪽에서 알림을 보낼 수 있어요.
export async function requestPushPermission() {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !VAPID_PUBLIC_KEY) {
    console.warn("푸시 알림을 아직 쓸 준비가 안 됐어요 (Firebase 연결이 필요해요).");
    return null;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  return subscription;
}
