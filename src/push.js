// ============================================================================
// 푸시 알림 구독
// ----------------------------------------------------------------------------
// 이 함수를 부르면 알림 권한을 물어보고, 허락하면 이 기기의 "구독 토큰"을
// Firestore(push_tokens)에 저장해요. 실제로 알림을 "보내는" 부분은 별도의
// Cloud Function(서버 코드)이 필요해요 - 그건 다음 단계예요.
// ============================================================================
import { getMessaging, getToken } from "firebase/messaging";
import { doc, setDoc } from "firebase/firestore";
import { firebaseApp, db, VAPID_PUBLIC_KEY } from "./firebaseConfig.js";

export async function requestPushPermission(accountId) {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    console.warn("이 브라우저는 푸시 알림을 지원하지 않아요.");
    return null;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    const messaging = getMessaging(firebaseApp);
    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return null;

    // 이 토큰을 Firestore에 저장해둬요. 나중에 Cloud Function이 이 목록을 읽어서
    // "안주인의 전갈"이 올 때마다 여기 있는 모든 토큰으로 알림을 보내줘요.
    await setDoc(doc(db, "push_tokens", token), {
      token,
      accountId: accountId || null,
      updatedAt: Date.now(),
    });

    return token;
  } catch (err) {
    console.warn("푸시 구독 실패:", err);
    return null;
  }
}
