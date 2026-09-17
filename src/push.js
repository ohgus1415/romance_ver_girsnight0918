// ============================================================================
// 푸시 알림 구독
// ----------------------------------------------------------------------------
// 이 함수를 부르면 알림 권한을 물어보고, 허락하면 이 기기의 "구독 토큰"을
// Firestore(push_tokens)에 저장해요.
// (firebaseConfig.js를 다시 불러오지 않고, 이미 초기화된 앱을 재사용해요 -
//  빌드 도구와의 충돌을 피하기 위한 방식이에요.)
// ============================================================================
import { getMessaging, getToken } from "firebase/messaging";
import { getApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const VAPID_PUBLIC_KEY = "BIDvnU1De2LWgV1JX91FJFWikUhILcf4y3_w_kQzysWqFWVWL1EaI7G5ZJPNWd2Ry-W8lbqQJZVXPKXDBvKSqmA";

export async function requestPushPermission(accountId) {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    console.warn("이 브라우저는 푸시 알림을 지원하지 않아요.");
    return null;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    const app = getApp(); // firebaseConfig.js에서 이미 초기화해둔 앱을 그대로 재사용해요.
    const messaging = getMessaging(app);
    const db = getFirestore(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return null;

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
