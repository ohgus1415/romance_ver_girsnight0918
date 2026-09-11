// ============================================================================
// window.storage 폴리필 (localStorage 기반)
// ----------------------------------------------------------------------------
// 원래 이 앱은 Claude 아티팩트 안에서만 존재하는 window.storage API를 써서
// "같은 링크를 여는 모든 사람"끼리 데이터가 자동으로 공유됐어요.
//
// 지금 이 PWA 버전에는 그 API가 없기 때문에, 여기서는 최대한 비슷하게 동작하도록
// localStorage로 흉내만 내요. 그 결과:
//
//   ✅ 새로고침해도 데이터가 안 사라져요 (이 기기, 이 브라우저 안에서는 유지)
//   ❌ 친구 폰이랑은 자동으로 동기화되지 않아요 (기기마다 따로 저장돼요)
//   ❌ "안주인의 전갈" 진짜 푸시 알림도 아직은 안 울려요
//
// 진짜로 여러 명이 실시간으로 공유하고, 푸시 알림까지 받으려면
// Firebase(Firestore + Cloud Messaging) 같은 실제 백엔드를 연결해야 해요.
// 이 폴리필은 "일단 앱이 안 깨지고 굴러가게" 만드는 임시 다리예요.
// ============================================================================

const PREFIX = "banquet_app:";

function readAll() {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) out[k.slice(PREFIX.length)] = localStorage.getItem(k);
  }
  return out;
}

const shim = {
  async get(key /*, shared */) {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return null;
    return { key, value: raw, shared: false };
  },
  async set(key, value /*, shared */) {
    localStorage.setItem(PREFIX + key, value);
    return { key, value, shared: false };
  },
  async delete(key /*, shared */) {
    localStorage.removeItem(PREFIX + key);
    return { key, deleted: true, shared: false };
  },
  async list(prefix = "" /*, shared */) {
    const all = readAll();
    const keys = Object.keys(all).filter((k) => k.startsWith(prefix));
    return { keys, prefix, shared: false };
  },
};

if (typeof window !== "undefined" && !window.storage) {
  window.storage = shim;
}
