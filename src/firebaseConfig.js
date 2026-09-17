import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBGHQ7nLthvPyls219cylDufP_ju_Hf3cQ",
  authDomain: "baechu-salon.firebaseapp.com",
  projectId: "baechu-salon",
  storageBucket: "baechu-salon.firebasestorage.app",
  messagingSenderId: "684451145028",
  appId: "1:684451145028:web:5f25a1d57016e983812311",
};

// 푸시 알림용 웹 푸시 인증서(VAPID) 공개 키예요.
export const VAPID_PUBLIC_KEY = "BIDvnU1De2LWgV1JX91FJFWikUhILcf4y3_w_kQzysWqFWVWL1EaI7G5ZJPNWd2Ry-W8lbqQJZVXPKXDBvKSqmA";

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
