// Vercel Serverless Function
// 안주인의 전갈을 실제 폰 푸시 알림으로 발송해요.
// 필요한 비밀정보(FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)는
// 코드에 넣지 않고 Vercel 프로젝트의 "Environment Variables"에서만 관리해요.

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Vercel 환경변수에 붙여넣으면 줄바꿈이 "\n" 두 글자로 그대로 들어오기 때문에 실제 줄바꿈으로 바꿔줘요.
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST 요청만 가능해요" });
    return;
  }

  try {
    const { title, message } = req.body || {};
    if (!title || !message) {
      res.status(400).json({ error: "title과 message가 필요해요" });
      return;
    }

    const app = getAdminApp();
    const db = getFirestore(app);
    const messaging = getMessaging(app);

    const snap = await db.collection("push_tokens").get();
    const tokens = [];
    snap.forEach((doc) => {
      const t = doc.data()?.token;
      if (t) tokens.push(t);
    });

    if (tokens.length === 0) {
      res.status(200).json({ sent: 0, note: "아직 알림을 받겠다고 등록한 기기가 없어요." });
      return;
    }

    const result = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body: message },
      webpush: { fcmOptions: { link: "/" } },
    });

    // 더 이상 유효하지 않은(앱 삭제 등) 토큰은 정리해둬요.
    const invalidTokens = [];
    result.responses.forEach((r, i) => {
      const code = r.error?.code;
      if (!r.success && (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token")) {
        invalidTokens.push(tokens[i]);
      }
    });
    await Promise.all(invalidTokens.map((t) => db.collection("push_tokens").doc(t).delete().catch(() => {})));

    res.status(200).json({ sent: result.successCount, failed: result.failureCount });
  } catch (err) {
    console.error("send-push 실패:", err);
    res.status(500).json({ error: String(err) });
  }
}
