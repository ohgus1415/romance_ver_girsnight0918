// ============================================================================
// window.storage 폴리필 (Firestore 기반, 진짜 여러 기기 동기화)
// ----------------------------------------------------------------------------
// shared: true  -> 모두가 같이 보는 데이터 (일정, 게시글, 계정 목록 등)
// shared: false -> 이 기기(브라우저)만의 데이터 (로그인 세션, 이 기기의 읽음 여부 등)
// ============================================================================
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebaseConfig.js";

const SHARED_COLLECTION = "shared_kv";
const PERSONAL_COLLECTION = "personal_kv";

function getDeviceId() {
  let id = localStorage.getItem("__device_id");
  if (!id) {
    id = "dev-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("__device_id", id);
  }
  return id;
}

// Firestore 문서 id로 쓰기 안전하게 다듬어요.
function safeDocId(key) {
  return key.replace(/\//g, "__");
}

function refFor(key, shared) {
  if (shared) return doc(db, SHARED_COLLECTION, safeDocId(key));
  return doc(db, PERSONAL_COLLECTION, `${getDeviceId()}__${safeDocId(key)}`);
}

const shim = {
  async get(key, shared) {
    try {
      const snap = await getDoc(refFor(key, shared));
      if (!snap.exists()) return null;
      const data = snap.data();
      return { key, value: data.value, shared: !!shared };
    } catch (err) {
      console.warn("storage.get 실패:", key, err);
      return null;
    }
  },
  async set(key, value, shared) {
    try {
      await setDoc(refFor(key, shared), { key, value, shared: !!shared, updatedAt: Date.now() });
      return { key, value, shared: !!shared };
    } catch (err) {
      console.warn("storage.set 실패:", key, err);
      return null;
    }
  },
  async delete(key, shared) {
    try {
      await deleteDoc(refFor(key, shared));
      return { key, deleted: true, shared: !!shared };
    } catch (err) {
      console.warn("storage.delete 실패:", key, err);
      return null;
    }
  },
  async list(prefix = "", shared) {
    try {
      const col = collection(db, shared ? SHARED_COLLECTION : PERSONAL_COLLECTION);
      const q = shared && prefix ? query(col, where("key", ">=", prefix), where("key", "<", prefix + "\uf8ff")) : col;
      const snaps = await getDocs(q);
      const keys = [];
      snaps.forEach((s) => keys.push(s.data().key));
      return { keys, prefix, shared: !!shared };
    } catch (err) {
      console.warn("storage.list 실패:", err);
      return { keys: [], prefix, shared: !!shared };
    }
  },
};

if (typeof window !== "undefined") {
  window.storage = shim;
}
