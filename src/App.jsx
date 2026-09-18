import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { requestPushPermission } from "./push.js";
import {
  ArrowLeft,
  Bell,
  Menu,
  X,
  ChevronRight,
  Plus,
  Heart,
  Coffee,
  UtensilsCrossed,
  Clapperboard,
  Dices,
  MapPin,
  Sparkles,
  Calendar as CalendarIcon,
  Check,
  Crown,
  UserRound,
  Megaphone,
  Pin,
  PinOff,
  MessageSquare,
  Send,
  KeyRound,
  Pencil,
  Trash2,
  UserCog,
  AlertCircle,
  Paperclip,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  Download,
  Camera,
  Loader2,
  RefreshCw,
  BellRing,
} from "lucide-react";

/* ==================================================================== */
/*  공유 저장소 레이어 (window.storage) — 같은 아티팩트를 여는 모두가 공유   */
/* ==================================================================== */
const hasStorage = typeof window !== "undefined" && !!window.storage;
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024; // 3MB (base64 인코딩 후 5MB 제한 여유분 확보)

async function storageGetJSON(key, fallback) {
  if (!hasStorage) return fallback;
  try {
    const res = await window.storage.get(key, true);
    return res ? JSON.parse(res.value) : fallback;
  } catch {
    return fallback;
  }
}
async function storageSetJSON(key, value) {
  if (!hasStorage) return;
  try {
    await window.storage.set(key, JSON.stringify(value), true);
  } catch (e) {
    console.error("storage set failed", key, e);
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 프로필 사진처럼 '정사각형'이 아니라, 화면/팝업 배경처럼 세로가 긴 비율로 잘라야 할 때 써요.
function resizeImageForAspect(file, targetW, targetH, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(targetW / img.width, targetH / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (targetW - w) / 2, (targetH - h) / 2, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resizeImageToDataUrl(file, size = 200, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function triggerDownload(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename || "download";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ==================================================================== */
/*  역할 색상 (호스트 = 보라 파스텔 / 참여자 = 노랑 파스텔)                 */
/* ==================================================================== */
const ROLE_COLOR_THEMES = {
  lavenderGold: {
    label: "라벤더 & 골드",
    swatch: ["#B7A9F5", "#F4CD6B"],
    host: { solid: "bg-violet-500 active:bg-violet-600", solidShadow: "shadow-violet-200", pastelBg: "bg-violet-50", pastelText: "text-violet-600", border: "border-violet-200", avatar: "#B7A9F5" },
    participant: { solid: "bg-amber-400 active:bg-amber-500", solidShadow: "shadow-amber-200", pastelBg: "bg-amber-100", pastelText: "text-amber-700", border: "border-amber-300", avatar: "#F4CD6B" },
  },
  burgundySilver: {
    label: "버건디 & 실버",
    swatch: ["#9F1239", "#94A3B8"],
    host: { solid: "bg-rose-800 active:bg-rose-900", solidShadow: "shadow-rose-200", pastelBg: "bg-rose-50", pastelText: "text-rose-800", border: "border-rose-200", avatar: "#8B3A55" },
    participant: { solid: "bg-slate-400 active:bg-slate-500", solidShadow: "shadow-slate-200", pastelBg: "bg-slate-100", pastelText: "text-slate-600", border: "border-slate-300", avatar: "#B8B8C4" },
  },
  emeraldRose: {
    label: "에메랄드 & 로즈골드",
    swatch: ["#047857", "#F2B8A2"],
    host: { solid: "bg-emerald-700 active:bg-emerald-800", solidShadow: "shadow-emerald-200", pastelBg: "bg-emerald-50", pastelText: "text-emerald-700", border: "border-emerald-200", avatar: "#3F7D5C" },
    participant: { solid: "bg-rose-300 active:bg-rose-400", solidShadow: "shadow-rose-200", pastelBg: "bg-rose-50", pastelText: "text-rose-500", border: "border-rose-200", avatar: "#F2B8A2" },
  },
  blushLavender: {
    label: "블러쉬 & 라벤더",
    swatch: ["#EC4899", "#B8A7F5"],
    host: { solid: "bg-pink-500 active:bg-pink-600", solidShadow: "shadow-pink-200", pastelBg: "bg-pink-50", pastelText: "text-pink-600", border: "border-pink-200", avatar: "#FF8FB8" },
    participant: { solid: "bg-violet-300 active:bg-violet-400", solidShadow: "shadow-violet-200", pastelBg: "bg-violet-50", pastelText: "text-violet-600", border: "border-violet-200", avatar: "#B8A7F5" },
  },
};
const ROLE_LABELS = { host: "안주인", participant: "영애" };
function resolveRoleStyle(themeKey) {
  const theme = ROLE_COLOR_THEMES[themeKey] || ROLE_COLOR_THEMES.lavenderGold;
  return {
    host: { label: ROLE_LABELS.host, ...theme.host },
    participant: { label: ROLE_LABELS.participant, ...theme.participant },
  };
}
const RoleThemeContext = React.createContext(resolveRoleStyle("lavenderGold"));
const AMBER_SHADES = ["#F4CD6B", "#F7DA8E", "#F0C04A", "#E8B84B"];
const AVATAR_COLOR_PALETTE = ["#B7A9F5", "#F4CD6B", "#8EC9C0", "#F2B8A2", "#A9C6F5", "#F5A9C9"];
const AVATAR_EMOJI_OPTIONS = ["🦁", "🌹", "🕊️", "⚜️", "👑", "🦢", "🗡️", "🌙", "🛡️", "🦋", "🍇", "⭐"];
// 홈 화면(초대장) 공지글 폰트 — 호스트만 고를 수 있어요.
const FONT_OPTIONS = [
  { key: "gowun", label: "고운돋움", family: "'Gowun Dodum', sans-serif" },
  { key: "jua", label: "주아", family: "'Jua', sans-serif" },
  { key: "gaegu", label: "개구", family: "'Gaegu', sans-serif" },
  { key: "dongle", label: "동글", family: "'Dongle', sans-serif" },
  { key: "himelody", label: "하이멜로디", family: "'Hi Melody', cursive" },
  { key: "gamja", label: "감자꽃", family: "'Gamja Flower', cursive" },
  { key: "myeongjo", label: "나눔명조", family: "'Nanum Myeongjo', serif" },
];
const fontFamilyFor = (key) => (FONT_OPTIONS.find((f) => f.key === key) || FONT_OPTIONS[0]).family;
// 홈 화면 제목/본문 글자색 — 호스트가 고를 수 있어요.
const TEXT_COLOR_OPTIONS = ["#FFFFFF", "#2B2B2B", "#FFF3E0", "#FFD96A", "#B8A7F5", "#FF6F9F"];

/* ==================================================================== */
/*  카테고리 메타 정보                                                   */
/* ==================================================================== */
const CATEGORY_META = {
  food: { icon: UtensilsCrossed, chip: "bg-orange-100 text-orange-600", label: "식사" },
  cafe: { icon: Coffee, chip: "bg-yellow-100 text-yellow-700", label: "카페" },
  event: { icon: Clapperboard, chip: "bg-rose-100 text-rose-500", label: "이벤트" },
  game: { icon: Dices, chip: "bg-sky-100 text-sky-600", label: "액티비티" },
  place: { icon: MapPin, chip: "bg-teal-100 text-teal-600", label: "장소" },
  etc: { icon: Sparkles, chip: "bg-violet-100 text-violet-600", label: "기타" },
};
const CATEGORY_KEYS = ["food", "cafe", "event", "game", "place", "etc"];
const iconFor = (category) => CATEGORY_META[category] || CATEGORY_META.etc;
// 호스트의 일정 추가/수정과 참여자의 제안 화면이 모두 이 하나의 목록을 공유해요.
const SCHEDULE_CATEGORY_OPTIONS = CATEGORY_KEYS.map((key) => ({ key, label: CATEGORY_META[key].label, icon: CATEGORY_META[key].icon }));

const PROPOSAL_CATEGORY_GUESS = { 게임: "game", 보드게임: "game", 액티비티: "game", 영화: "event", 카페: "cafe", 카페가기: "cafe", 먹기: "food", 장소: "place" };
const guessCategory = (title) => {
  const hit = Object.keys(PROPOSAL_CATEGORY_GUESS).find((k) => title.includes(k));
  return hit ? PROPOSAL_CATEGORY_GUESS[hit] : "etc";
};

function fileIconFor(type = "") {
  if (type.startsWith("image/")) return ImageIcon;
  if (type === "application/pdf" || type.includes("pdf")) return FileText;
  return FileIcon;
}
function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// 게시글/댓글 속 URL을 눌러서 바로 이동할 수 있는 링크로 바꿔줘요.
function linkify(text) {
  if (!text) return text;
  const regex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const nodes = [];
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    let url = match[0];
    let trail = "";
    const trailMatch = url.match(/[),.!?]+$/);
    if (trailMatch) {
      trail = trailMatch[0];
      url = url.slice(0, -trail.length);
    }
    const href = url.startsWith("http") ? url : `https://${url}`;
    nodes.push(
      <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className="underline text-violet-600 break-all" onClick={(e) => e.stopPropagation()}>
        {url}
      </a>
    );
    if (trail) nodes.push(trail);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

/* ==================================================================== */
/*  Mock 시드 데이터 (최초 1회, 공유 저장소가 비어있을 때만 사용)            */
/* ==================================================================== */
const SEED_ACCOUNTS = [
  { id: "m1", name: "지현", role: "host", pin: "1234", color: null, emoji: null, photo: null, rsvp: null },
  { id: "m2", name: "수진", role: "participant", pin: "5678", color: null, emoji: null, photo: null, rsvp: null },
  { id: "m3", name: "민지", role: "participant", pin: "0000", color: null, emoji: null, photo: null, rsvp: null },
  { id: "m4", name: "하은", role: "participant", pin: "1111", color: null, emoji: null, photo: null, rsvp: null },
];

function baseAvatarColor(accounts, name, roleStyle) {
  const rs = roleStyle || resolveRoleStyle("lavenderGold");
  const acc = accounts.find((a) => a.name === name);
  if (!acc) return "#CBD5E1";
  if (acc.role === "host") return rs.host.avatar;
  const participants = accounts.filter((a) => a.role === "participant");
  const idx = participants.findIndex((a) => a.name === name);
  return AMBER_SHADES[idx % AMBER_SHADES.length];
}
function avatarInfo(accounts, name, roleStyle) {
  const acc = accounts.find((a) => a.name === name);
  const color = (acc && acc.color) || baseAvatarColor(accounts, name, roleStyle);
  const label = (acc && acc.emoji) || (name ? name[0] : "?");
  const photo = acc && acc.photo;
  return { color, label, photo };
}

function Avatar({ accounts, name, size = 28, className = "" }) {
  const ROLE_STYLE = React.useContext(RoleThemeContext);
  const { color, label, photo } = avatarInfo(accounts, name, ROLE_STYLE);
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.4) };
  if (photo) {
    return <img src={photo} alt={name} style={style} className={`rounded-full object-cover shrink-0 ${className}`} />;
  }
  return (
    <div style={{ ...style, background: color }} className={`rounded-full flex items-center justify-center font-semibold text-white shrink-0 ${className}`}>
      {label}
    </div>
  );
}

const INITIAL_SCHEDULE = [
  {
    date: "2026-09-18",
    dateShort: "9/18",
    weekday: "금",
    events: [{ id: "f1", startTime: "23:30", title: "영애님들 도착", category: "etc", status: "confirmed", participants: 4, description: "다들 도착하는 대로 짐 풀고 편하게 있기" }],
    gapProposals: {},
  },
  {
    date: "2026-09-19",
    dateShort: "9/19",
    weekday: "토",
    events: [
      { id: "s1", startTime: "10:00", endTime: "12:00", title: "늦잠 / 아침", category: "food", status: "confirmed", participants: 4, description: "각자 편한 시간에 일어나서 여유롭게 아침 먹기" },
      { id: "s2", startTime: "12:30", endTime: "14:00", title: "점심 먹기", category: "food", status: "confirmed", participants: 4, description: "근처 맛집으로 이동해서 점심 식사" },
      { id: "s4", startTime: "17:00", endTime: "19:00", title: "저녁 먹기", category: "food", status: "confirmed", participants: 4, description: "다같이 장봐서 숙소에서 해먹기" },
      { id: "s5", startTime: "20:00", endTime: "21:00", title: "내가 사랑한 남자들 발표", category: "event", status: "confirmed", participants: 4, description: "영애님들이 준비하신 여흥" },
    ],
    gapProposals: {
      "14:00-17:00": [
        { id: "p1", title: "보드게임", proposer: "민지", proposerId: "m3", likes: 3, likedByMe: false },
        { id: "p2", title: "카페가기", proposer: "수진", proposerId: "m2", likes: 2, likedByMe: false },
      ],
    },
  },
  {
    date: "2026-09-20",
    dateShort: "9/20",
    weekday: "일",
    events: [
      { id: "u1", startTime: "09:00", endTime: "10:30", title: "아침 먹기", category: "food", status: "confirmed", participants: 4, description: "숙소에서 간단하게 챙겨 먹기" },
      { id: "u2", startTime: "11:00", title: "해산", category: "etc", status: "confirmed", participants: 4, description: "짐 챙겨서 각자 집으로" },
    ],
    gapProposals: {},
  },
];

// 시간(HH:MM) -> 분
// 암구호를 그대로 저장하지 않고 해시로 바꿔서 저장/비교해요.
// (완벽한 서버 검증은 아니지만, 최소한 저장소/개발자도구에 평문으로 안 보여요.
//  나중에 실제 서버를 연결하면 이 해시 비교를 서버 쪽으로 옮겨서 더 안전하게 만들 수 있어요.)
async function hashPin(pin) {
  const raw = `banquet-app-pin:${pin}`;
  try {
    if (window.crypto?.subtle) {
      const buf = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    // 아래 대체 해시로 넘어가요.
  }
  // Web Crypto를 못 쓰는 아주 예외적인 환경을 위한 대체 해시 (완전하진 않지만 평문보단 나아요).
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) | 0;
  return `fb${(h >>> 0).toString(16)}`;
}

function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
// 하루치 확정 일정 사이에 1시간 이상 비는 구간을 자동으로 찾아 '빈 시간' 카드로 끼워 넣어요.
// 맨 첫 일정 앞쪽은 표시하지 않고, 일정과 일정 '사이'만 대상으로 해요.
function computeDayTimeline(day) {
  const confirmed = [...day.events].filter((e) => e.status === "confirmed").sort((a, b) => a.startTime.localeCompare(b.startTime));
  if (day.closed) return confirmed;

  // 저장된 모든 제안을 하나의 풀로 모아요. 각 제안이 "원래 어느 버킷(키)에 저장돼 있었는지"도
  // 같이 기억해둬요 (수정/삭제/찜/확정할 때 그 자리를 정확히 찾아가기 위해서예요).
  const allProposals = [];
  Object.entries(day.gapProposals || {}).forEach(([bucketKey, list]) => {
    const bucketStart = bucketKey.split("-")[0];
    (list || []).forEach((p) => {
      allProposals.push({ ...p, __bucketKey: bucketKey, __refStart: p.proposedStartTime || bucketStart });
    });
  });

  const items = [];
  const pushGap = (gapStart, gapEnd) => {
    if (toMinutes(gapEnd) - toMinutes(gapStart) >= 60) {
      const key = `${gapStart}-${gapEnd}`;
      // 이 틈 안에 실제로 들어오는(제안된 시간이 이 구간에 속하는) 제안들만 여기 보여줘요.
      // -> 나중에 이 큰 틈 사이에 새 일정이 확정돼서 틈이 여러 개로 쪼개져도,
      //    각 제안이 자기 시간에 맞는 새 틈으로 자동으로 옮겨가 보여요.
      const proposalsHere = allProposals.filter((p) => toMinutes(p.__refStart) >= toMinutes(gapStart) && toMinutes(p.__refStart) < toMinutes(gapEnd));
      items.push({ id: `gap:${key}`, gapKey: key, startTime: gapStart, endTime: gapEnd, status: "empty", proposals: proposalsHere });
    }
  };
  if (confirmed.length === 0) {
    return items;
  }
  for (let i = 0; i < confirmed.length; i++) {
    const ev = confirmed[i];
    items.push(ev);
    const next = confirmed[i + 1];
    const gapStart = ev.endTime || ev.startTime;
    if (next) pushGap(gapStart, next.startTime);
    else pushGap(gapStart, "24:00");
  }
  return items;
}

const INITIAL_POSTS = [
  {
    id: "b1",
    title: "집합 장소 꼭 확인해주세요!",
    content: "왕십리역 2번 출구에서 오전 10시에 모여요. 늦으시는 분은 단톡방에 미리 말씀해주세요!",
    author: "지현",
    authorRole: "host",
    pinned: true,
    createdAt: "9/8",
    attachments: [],
    comments: [{ id: "c1", author: "수진", createdAt: "9/8", text: "넵! 확인했어요", attachments: [] }],
  },
  {
    id: "b2",
    title: "준비물 리스트 공유해요",
    content: "세면도구, 편한 옷, 카메라 챙겨오면 좋을 것 같아요. 더 필요한 것이 있다면 말씀으로 알려주세요.",
    author: "지현",
    authorRole: "host",
    pinned: true,
    createdAt: "9/7",
    attachments: [],
    comments: [],
  },
  {
    id: "b3",
    title: "혹시 보드게임 가져오실 분?",
    content: "저 코드네임이랑 할리갈리 가져갈 수 있어요! 다른 것도 있으면 좋을 것 같아요.",
    author: "민지",
    authorRole: "participant",
    pinned: false,
    createdAt: "9/6",
    attachments: [],
    comments: [
      { id: "c2", author: "하은", createdAt: "9/6", text: "저도 우노 가져갈게요!", attachments: [] },
      { id: "c3", author: "수진", createdAt: "9/6", text: "완전 좋다 ㅎㅎ", attachments: [] },
    ],
  },
];

const PIN_LIMIT = 2;

/* ==================================================================== */
/*  공용 Bottom Sheet                                                   */
/* ==================================================================== */
function BottomSheet({ open, onClose, children }) {
  const [entered, setEntered] = useState(false);
  const [viewport, setViewport] = useState(null); // 모바일 키보드가 열려도 흔들리지 않게 실제 보이는 화면 크기를 따라가요.
  useEffect(() => {
    if (open) {
      const t = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(t);
    }
    setEntered(false);
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => setViewport({ height: vv.height, top: vv.offsetTop });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [open]);

  // 시트가 열려있는 동안엔 뒤에 있는 화면(일정 목록 등)이 같이 스크롤되면서
  // 창이 흔들려 보이는 걸 막기 위해, 뒤 배경 스크롤을 잠가둬요.
  useEffect(() => {
    if (!open) return;
    const frame = document.getElementById("app-scroll-frame");
    if (!frame) return;
    const prevOverflow = frame.style.overflow;
    const prevScrollTop = frame.scrollTop;
    frame.style.overflow = "hidden";
    return () => {
      frame.style.overflow = prevOverflow;
      frame.scrollTop = prevScrollTop;
    };
  }, [open]);

  if (!open) return null;
  return (
    <FramePortal>
      <div
        className="fixed inset-0 z-40 flex flex-col justify-end sm:absolute"
        style={viewport ? { height: viewport.height, top: viewport.top } : undefined}
      >
        <div onClick={onClose} className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-300 ${entered ? "opacity-100" : "opacity-0"}`} />
        <div
          data-sheet-scroll="true"
          className={`relative bg-white rounded-t-[28px] px-5 pt-3 pb-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] max-h-[85%] overflow-y-auto overscroll-y-contain transition-transform duration-300 ease-out ${
            entered ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />
          {children}
        </div>
      </div>
    </FramePortal>
  );
}

/* ==================================================================== */
/*  4자리 암구호 입력                                                  */
/* ==================================================================== */
function PinInput({ value, onChange, size = "md", error }) {
  const refs = useRef([]);
  const box = size === "sm" ? "h-10 w-9 text-[15px]" : "h-12 w-11 text-[18px]";
  const handleChange = (i, raw) => {
    const digit = raw.replace(/[^0-9]/g, "").slice(-1);
    const next = value.split("");
    next[i] = digit;
    const joined = next.join("").slice(0, 4);
    onChange(joined);
    if (digit && i < 3) refs.current[i + 1]?.focus();
  };
  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus();
  };
  return (
    <div className="flex justify-center gap-2.5">
      {[0, 1, 2, 3].map((i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          value={value[i] ? "•" : ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          inputMode="numeric"
          type="password"
          maxLength={1}
          aria-label={`암구호 ${i + 1}번째 자리`}
          className={`${box} rounded-xl border text-center font-semibold focus:outline-none focus:ring-2 ${
            error ? "border-rose-300 text-rose-500 focus:border-rose-400 focus:ring-rose-100" : "border-slate-200 text-violet-600 focus:border-violet-500 focus:ring-violet-50"
          }`}
        />
      ))}
    </div>
  );
}

/* ==================================================================== */
/*  시작 화면: 닉네임 → (신규)역할+비번 만들기 / (기존)비번 확인            */
/* ==================================================================== */
function RoleOption({ roleKey, selected, disabled, disabledNote, icon: Icon, label, desc, onClick }) {
  const ROLE_STYLE = React.useContext(RoleThemeContext);
  const s = ROLE_STYLE[roleKey];
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
        disabled ? "border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed" : selected ? `${s.border} ${s.pastelBg}` : "border-slate-100 bg-white"
      }`}
    >
      <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${selected && !disabled ? `${s.solid} text-white` : "bg-slate-100 text-slate-400"}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className={`text-[14px] font-medium ${selected && !disabled ? s.pastelText : "text-slate-800"}`}>{label}</p>
        <p className="text-[11.5px] text-slate-400 mt-0.5">{disabled ? disabledNote : desc}</p>
      </div>
      {!disabled && (
        <div className={`ml-auto h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center ${selected ? `${s.border} ${s.solid}` : "border-slate-200"}`}>
          {selected && <Check size={12} className="text-white" strokeWidth={3} />}
        </div>
      )}
    </button>
  );
}

function StartScreen({ accounts, onAuthenticated, meetupTitle, inviteCode }) {
  const ROLE_STYLE = React.useContext(RoleThemeContext);
  const [nickname, setNickname] = useState("");
  const [role, setRole] = useState(null);
  const [pin, setPin] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [error, setError] = useState("");
  const [inviteError, setInviteError] = useState("");

  const trimmed = nickname.trim();
  const existing = trimmed ? accounts.find((a) => a.name === trimmed) : null;
  const hostTaken = accounts.some((a) => a.role === "host");
  const mode = !trimmed ? "idle" : existing ? "login" : "signup";
  const needsInvite = mode === "signup" && !!inviteCode;

  useEffect(() => {
    setPin("");
    setError("");
    setInviteInput("");
    setInviteError("");
    if (mode !== "signup") setRole(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, trimmed]);

  const handleSubmit = async () => {
    if (mode === "login") {
      const inputHash = await hashPin(pin);
      if (inputHash === existing.pin) onAuthenticated({ isNew: false, id: existing.id });
      else {
        setError("암구호가 일치하지 않아요");
        setPin("");
      }
    } else if (mode === "signup") {
      if (needsInvite && inviteInput.trim() !== inviteCode) {
        setInviteError("초대 암호가 맞지 않아요");
        return;
      }
      const pinHash = await hashPin(pin);
      onAuthenticated({ isNew: true, name: trimmed, role, pin: pinHash });
    }
  };

  const canSubmit = mode === "login" ? pin.length === 4 : mode === "signup" ? !!role && pin.length === 4 && (!needsInvite || inviteInput.trim().length > 0) : false;
  const s = mode === "signup" && role ? ROLE_STYLE[role] : { solid: "bg-violet-500", solidShadow: "shadow-violet-100" };

  return (
    <div className="flex-1 flex flex-col px-5 pt-10 pb-8">
      <div className="text-center mb-8">
        <p className="text-[13px] text-violet-500 font-medium mb-1">초대장</p>
        <h1 className="text-[22px] font-semibold text-slate-800">{meetupTitle}</h1>
        <p className="text-[12px] text-slate-400 mt-1.5">9월 18일(금) ~ 9월 20일(일)</p>
      </div>

      <div className="space-y-6 flex-1">
        <section>
          <p className="text-[12.5px] font-medium text-slate-500 mb-2.5">아가씨의 성함</p>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="사교계에서 활동할 이름이에요 (ID)"
            maxLength={10}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50"
          />
          {mode === "login" && (
            <p className="text-[11.5px] text-violet-500 mt-2">
              이미 초대장을 받으신 분이시네요 · <span className="font-medium">{ROLE_STYLE[existing.role].label}</span>
              {existing.role === "host" ? "으로" : "로"} 모실게요
            </p>
          )}
          {mode === "signup" && <p className="text-[11.5px] text-emerald-500 mt-2">처음 뵙는 분이시네요! 초대장을 새로 준비해드릴게요</p>}
        </section>

        {needsInvite && (
          <section>
            <p className="text-[12.5px] font-medium text-slate-500 mb-2.5">초대 암호</p>
            <input
              value={inviteInput}
              onChange={(e) => {
                setInviteInput(e.target.value);
                setInviteError("");
              }}
              placeholder="안주인께 전해받은 암호를 적어주세요"
              className={`w-full rounded-xl border px-4 py-3 text-[14px] focus:outline-none focus:ring-2 ${
                inviteError ? "border-rose-300 focus:border-rose-400 focus:ring-rose-50" : "border-slate-200 focus:border-violet-500 focus:ring-violet-50"
              }`}
            />
            {inviteError && (
              <p className="text-[11.5px] text-rose-500 mt-2 flex items-center gap-1">
                <AlertCircle size={12} /> {inviteError}
              </p>
            )}
          </section>
        )}

        {mode === "signup" && (
          <section>
            <p className="text-[12.5px] font-medium text-slate-500 mb-2.5">어떤 자격으로 무도회에 참석하시겠어요?</p>
            <div className="space-y-2">
              <RoleOption
                roleKey="host"
                icon={Crown}
                label="이 저택의 안주인이에요"
                desc="무도회 일정을 정하고 확정할 수 있어요"
                selected={role === "host"}
                disabled={hostTaken}
                disabledNote="이미 안주인이 계세요. 영애로 참석해주세요"
                onClick={() => setRole("host")}
              />
              <RoleOption roleKey="participant" icon={UserRound} label="초대받은 영애예요" desc="일정을 살펴보고 의견을 올릴 수 있어요" selected={role === "participant"} onClick={() => setRole("participant")} />
            </div>
          </section>
        )}

        {mode !== "idle" && (
          <section>
            <p className="text-[12.5px] font-medium text-slate-500 mb-2.5 text-center">{mode === "login" ? "출입 암구호 네 자리" : "출입 암구호 네 자리 정하기"}</p>
            <PinInput value={pin} onChange={setPin} error={!!error} />
            {error ? (
              <p className="text-[11.5px] text-rose-500 text-center mt-2.5 flex items-center justify-center gap-1">
                <AlertCircle size={12} /> {error}
              </p>
            ) : (
              <p className="text-[11px] text-slate-300 text-center mt-2.5">다음에 다시 드실 때 필요한 암구호예요</p>
            )}
          </section>
        )}
      </div>

      <button
        disabled={!canSubmit}
        onClick={handleSubmit}
        className={`w-full rounded-full text-[14px] font-medium py-3.5 mt-6 transition-colors ${canSubmit ? `${s.solid} text-white shadow-lg ${s.solidShadow}` : "bg-slate-100 text-slate-300"}`}
      >
        초대에 응하기
      </button>
    </div>
  );
}

/* ==================================================================== */
/*  Header / 탭바 / FAB                                                 */
/* ==================================================================== */
function Header({ accounts, title, onOpenSettings, onBack, onOpenNotifications, unreadCount = 0, onRefresh, refreshing }) {
  const names = accounts.map((a) => a.name);
  return (
    <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-violet-50/70">
      <div className="flex items-center justify-between px-4 pt-4">
        <button aria-label="뒤로가기" onClick={onBack || undefined} className={`-ml-1 p-1 ${onBack ? "text-slate-500" : "text-transparent pointer-events-none"}`}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[15px]">🏰</span>
          <h1 className="text-[17px] font-semibold text-slate-800 tracking-tight truncate max-w-[180px]">{title}</h1>
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          <button aria-label="지금 소식 확인" onClick={onRefresh}>
            <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button aria-label="알림" onClick={onOpenNotifications} className="relative">
            <Bell size={19} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          <button aria-label="몸단장 · 암구호 관리" onClick={onOpenSettings}>
            <Menu size={19} />
          </button>
        </div>
      </div>
      <p className="text-center text-[12px] text-slate-400 mt-1.5">9월 18일(금) ~ 9월 20일(일)</p>
      <div className="flex justify-center -space-x-2 mt-2 pb-3">
        {names.map((name) => (
          <Avatar key={name} accounts={accounts} name={name} size={28} className="border-2 border-white" />
        ))}
      </div>
    </div>
  );
}

function BottomTabBar({ active, onChange, role }) {
  const ROLE_STYLE = React.useContext(RoleThemeContext);
  const s = ROLE_STYLE[role];
  const tabs = [
    { key: "schedule", label: "연회", icon: CalendarIcon },
    { key: "board", label: "담화장", icon: Megaphone },
  ];
  return (
    <div className="sticky bottom-0 z-20 bg-white border-t border-slate-100 flex" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {tabs.map((t) => {
        const isActive = active === t.key;
        const Icon = t.icon;
        return (
          <button key={t.key} onClick={() => onChange(t.key)} className="flex-1 flex flex-col items-center gap-0.5 py-2.5">
            <Icon size={19} className={isActive ? s.pastelText : "text-slate-300"} />
            <span className={`text-[10.5px] font-medium ${isActive ? s.pastelText : "text-slate-300"}`}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// fixed/absolute로 고정해야 하는 요소(플러스 버튼, 바텀시트 등)를 화면 프레임에 직접 붙여요.
// 중간에 있는 다른 요소(예: backdrop-blur가 있는 헤더)가 CSS상 '기준점'을 새로 만들어버려서
// fixed 위치가 스크롤을 따라 움직이는 문제를 원천적으로 막기 위해서예요.
function FramePortal({ children }) {
  const [node, setNode] = useState(null);
  useEffect(() => {
    setNode(document.getElementById("app-scroll-frame"));
  }, []);
  if (!node) return null;
  return createPortal(children, node);
}

function RoundFab({ role, icon: Icon, onClick, label }) {
  const ROLE_STYLE = React.useContext(RoleThemeContext);
  const s = ROLE_STYLE[role];
  return (
    <FramePortal>
      <button onClick={onClick} aria-label={label} className={`fixed sm:absolute right-4 bottom-24 z-30 h-[52px] w-[52px] rounded-full ${s.solid} text-white flex items-center justify-center shadow-lg ${s.solidShadow}`}>
        <Icon size={22} />
      </button>
    </FramePortal>
  );
}

/* ==================================================================== */
/*  Date Tabs                                                           */
/* ==================================================================== */
function DateTabs({ days, selectedDate, onSelect }) {
  return (
    <div className="flex gap-2 px-4 pt-3 pb-1">
      {days.map((d) => {
        const selected = d.date === selectedDate;
        return (
          <button
            key={d.date}
            onClick={() => onSelect(d.date)}
            className={`flex-1 rounded-2xl py-2 text-center transition-colors ${selected ? "bg-violet-500 text-white shadow-sm shadow-violet-100" : "bg-white text-slate-400 border border-violet-50"}`}
          >
            <p className="text-[13px] font-semibold">{d.dateShort}</p>
            <p className={`text-[11px] ${selected ? "text-violet-50" : "text-slate-300"}`}>{d.weekday}</p>
          </button>
        );
      })}
    </div>
  );
}

/* ==================================================================== */
/*  확정 일정 카드 / 제안 카드 / 빈 시간 카드 / 타임라인                    */
/* ==================================================================== */
function ConfirmedEventCard({ event, onOpen }) {
  const { icon: Icon, chip } = iconFor(event.category);
  return (
    <button onClick={() => onOpen(event)} className="w-full text-left rounded-2xl bg-white border border-slate-100 shadow-sm shadow-slate-100 p-3.5 relative active:scale-[0.99] transition-transform">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center ${chip}`}>
            <Icon size={17} />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-slate-800 text-[15px] truncate">{event.title}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {event.startTime}
              {event.endTime ? ` - ${event.endTime}` : ""}
            </p>
          </div>
        </div>
        <span className="shrink-0 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">확정</span>
      </div>
      <ChevronRight size={15} className="absolute right-3 bottom-3.5 text-slate-300" />
    </button>
  );
}

function ProposalCard({ proposal, isHost, me, onToggleLike, onAdd, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(proposal.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const category = proposal.category || guessCategory(proposal.title);
  const { icon: Icon } = iconFor(category);
  const isMine = me && (proposal.proposerId ? proposal.proposerId === me.id : proposal.proposer === me.name);
  const canModerate = isHost && !isMine;

  return (
    <div className="shrink-0 w-[132px] rounded-xl bg-white border border-violet-50 p-2.5">
      <div className="h-8 w-8 rounded-full bg-violet-50 text-violet-500 flex items-center justify-center mb-1.5">
        <Icon size={15} />
      </div>

      {editing ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={40}
          autoFocus
          className="w-full rounded-lg border border-violet-200 px-1.5 py-1 text-[12px] mb-1 focus:outline-none focus:ring-1 focus:ring-violet-200"
        />
      ) : (
        <p className="text-[12.5px] font-medium text-slate-800 truncate">{proposal.title}</p>
      )}
      <p className="text-[10.5px] text-slate-400 mt-0.5">
        {proposal.proposer} 제안{proposal.edited ? " · 수정됨" : ""}
      </p>
      {proposal.proposedStartTime && (
        <p className="text-[10px] text-violet-400 mt-0.5">
          {proposal.proposedStartTime}
          {proposal.proposedEndTime ? ` ~ ${proposal.proposedEndTime}` : ""}
        </p>
      )}

      {editing ? (
        <div className="flex gap-1 mt-2">
          <button
            onClick={() => {
              if (draft.trim()) {
                onEdit(proposal.id, draft.trim());
                setEditing(false);
              }
            }}
            className="flex-1 text-[10.5px] font-medium text-white bg-violet-500 rounded-full py-1"
          >
            저장
          </button>
          <button
            onClick={() => {
              setDraft(proposal.title);
              setEditing(false);
            }}
            className="flex-1 text-[10.5px] font-medium text-slate-400 bg-slate-100 rounded-full py-1"
          >
            취소
          </button>
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-between">
          <button onClick={() => onToggleLike(proposal.id)} className={`flex items-center gap-1 text-[11px] font-medium ${proposal.likedByMe ? "text-rose-500" : "text-slate-400"}`} aria-label="찬성하기">
            <Heart size={13} fill={proposal.likedByMe ? "currentColor" : "none"} />
            {proposal.likes}
          </button>
          {isHost && (
            <button onClick={() => onAdd(proposal)} className="text-[10.5px] font-medium text-violet-600 bg-violet-50 rounded-full px-2 py-1">
              추가
            </button>
          )}
        </div>
      )}

      {!editing && (isMine || canModerate) && (
        <div className="flex items-center gap-2 mt-1.5">
          {isMine && (
            <button onClick={() => setEditing(true)} className="text-[10px] text-slate-400 flex items-center gap-0.5">
              <Pencil size={9} /> 수정
            </button>
          )}
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="text-[10px] text-slate-400 flex items-center gap-0.5">
              <Trash2 size={9} /> 삭제
            </button>
          ) : (
            <span className="text-[10px] text-rose-400 flex items-center gap-1">
              정말요?
              <button onClick={() => onDelete(proposal.id)} className="font-medium underline">
                삭제
              </button>
              <button onClick={() => setConfirmDelete(false)} className="underline text-slate-400">
                취소
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function durationLabel(start, end) {
  if (!end) return "";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}시간 ${m}분`;
  if (h) return `${h}시간`;
  return `${m}분`;
}

function EmptyTimeCard({ event, isHost, me, onPlan, onPropose, onToggleLike, onAdd, onEdit, onDelete }) {
  const dur = durationLabel(event.startTime, event.endTime);
  return (
    <div className="rounded-2xl border-2 border-dashed border-violet-100 bg-violet-50/50 p-3.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[15px]">🙂</span>
        <p className="font-medium text-violet-700 text-[14px]">아직 정해지지 않은 시간이에요</p>
      </div>
      <p className="text-[11px] text-violet-500 mt-1">
        {event.startTime}
        {event.endTime ? ` ~ ${event.endTime}` : ""}
        {dur ? ` (${dur})` : ""}
      </p>
      {event.proposals && event.proposals.length > 0 ? (
        <>
          <p className="text-[11.5px] text-slate-500 mt-3 mb-2">다른 영애님들이 이런 것들을 제안해주셨어요!</p>
          <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
            {event.proposals.map((p) => (
              <ProposalCard key={p.id} proposal={p} isHost={isHost} me={me} onToggleLike={onToggleLike} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        </>
      ) : (
        <p className="text-[11.5px] text-slate-400 mt-3">아직 아무 말씀도 없으셨어요. 먼저 의견을 올려보시겠어요?</p>
      )}
      <button onClick={() => onPlan(event)} className="mt-3.5 w-full rounded-xl bg-violet-600 text-white text-[13px] font-medium py-2.5 active:bg-violet-700 transition-colors">
        {isHost ? "이 시간, 손수 정하기" : "이 시간에 의견 올리기"}
      </button>
      {isHost && (
        <button onClick={() => onPropose(event)} className="mt-2 w-full text-[12px] font-medium text-violet-500">
          나도 의견만 올리기
        </button>
      )}
    </div>
  );
}

function DayTimeline({ events, isHost, me, onOpenEvent, onPlanEmpty, onProposeEmpty, onToggleLike, onAddProposal, onEditProposal, onDeleteProposal }) {
  return (
    <div className="px-4 pt-3">
      {events.map((event, i) => {
        const isLast = i === events.length - 1;
        return (
          <div key={event.id} className="flex gap-3">
            <div className="w-11 shrink-0 pt-2 text-right text-[11px] font-medium text-slate-400 tabular-nums">{event.startTime}</div>
            <div className="relative flex flex-col items-center">
              <span className={`mt-2.5 h-2.5 w-2.5 rounded-full shrink-0 ${event.status === "confirmed" ? "bg-violet-500" : "bg-violet-100 ring-4 ring-violet-50"}`} />
              {!isLast && <span className="w-px flex-1 bg-violet-50 mt-1" />}
            </div>
            <div className="flex-1 pb-5 min-w-0">
              {event.status === "confirmed" ? (
                <ConfirmedEventCard event={event} onOpen={onOpenEvent} />
              ) : (
                <EmptyTimeCard
                  event={event}
                  isHost={isHost}
                  me={me}
                  onPlan={onPlanEmpty}
                  onPropose={onProposeEmpty}
                  onToggleLike={(proposalId) => {
                    const p = event.proposals.find((x) => x.id === proposalId);
                    onToggleLike(p?.__bucketKey || event.gapKey, proposalId);
                  }}
                  onAdd={(proposal) => onAddProposal(event, proposal)}
                  onEdit={(proposalId, newTitle) => {
                    const p = event.proposals.find((x) => x.id === proposalId);
                    onEditProposal(p?.__bucketKey || event.gapKey, proposalId, newTitle);
                  }}
                  onDelete={(proposalId) => {
                    const p = event.proposals.find((x) => x.id === proposalId);
                    onDeleteProposal(p?.__bucketKey || event.gapKey, proposalId);
                  }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ==================================================================== */
/*  일정 상세 / 추가·수정 Bottom Sheet                                   */
/* ==================================================================== */
function EventDetailSheet({ event, isHost, accounts, open, onClose, onEdit }) {
  if (!event) return null;
  const { icon: Icon, chip } = iconFor(event.category);
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${chip}`}>
            <Icon size={18} />
          </div>
          <div>
            <h2 className="text-[17px] font-semibold text-slate-800">{event.title}</h2>
            <p className="text-[12px] text-slate-400 mt-0.5">
              {event.startTime}
              {event.endTime ? ` ~ ${event.endTime}` : ""}
            </p>
          </div>
        </div>
        <button onClick={onClose} aria-label="닫기" className="text-slate-300 p-1">
          <X size={18} />
        </button>
      </div>
      {event.description ? (
        <p className="text-[13px] text-slate-500 mt-4 leading-relaxed">{event.description}</p>
      ) : (
        <p className="text-[13px] text-slate-300 mt-4">따로 남기신 말씀은 없으셨어요</p>
      )}
      <div className="h-px bg-slate-100 my-4" />
      {isHost ? (
        <div className="flex gap-2">
          <button onClick={() => onEdit(event)} className="flex-1 rounded-xl bg-violet-500 text-white text-[13px] font-medium py-2.5">
            수정
          </button>
          <button onClick={onClose} className="flex-1 rounded-xl bg-slate-100 text-slate-500 text-[13px] font-medium py-2.5">
            닫기
          </button>
        </div>
      ) : (
        <button onClick={onClose} className="w-full rounded-xl bg-slate-100 text-slate-500 text-[13px] font-medium py-2.5">
          닫기
        </button>
      )}
    </BottomSheet>
  );
}

function EventFormSheet({ open, onClose, mode, initial, onSubmit, onDelete }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("etc");
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("");
  const [description, setDescription] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (open) {
      const blankTitles = ["아직 정해지지 않았어요", "아직 미정"];
      setTitle(initial?.title && !blankTitles.includes(initial.title) ? initial.title : "");
      setCategory(initial?.category || "etc");
      setStartTime(initial?.startTime || "12:00");
      setEndTime(initial?.endTime || "");
      setDescription(initial?.description || "");
      setConfirmingDelete(false);
    }
  }, [open, initial]);

  const canSubmit = title.trim().length > 0 && !!startTime;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[16px] font-semibold text-slate-800">{mode === "edit" ? "연회 순서 수정" : "새 연회 순서 추가"}</h2>
        <button onClick={onClose} aria-label="닫기" className="text-slate-300 p-1">
          <X size={18} />
        </button>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="무슨 일정인가요?"
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] mb-3 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50"
      />
      <p className="text-[12px] font-medium text-slate-400 mb-2">카테고리</p>
      <div className="grid grid-cols-6 gap-1.5 mb-3.5">
        {CATEGORY_KEYS.map((key) => {
          const meta = CATEGORY_META[key];
          const Icon = meta.icon;
          const selected = category === key;
          return (
            <button key={key} onClick={() => setCategory(key)} className={`flex flex-col items-center gap-1 rounded-xl py-2 border ${selected ? "border-violet-200 bg-violet-50" : "border-slate-100 bg-white"}`}>
              <Icon size={15} className={selected ? "text-violet-500" : "text-slate-400"} />
              <span className={`text-[10px] ${selected ? "text-violet-600 font-medium" : "text-slate-400"}`}>{meta.label}</span>
            </button>
          );
        })}
      </div>
      <div className="flex gap-2.5 mb-3.5">
        <div className="flex-1">
          <p className="text-[12px] font-medium text-slate-400 mb-1.5">시작 시간</p>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13.5px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50" />
        </div>
        <div className="flex-1">
          <p className="text-[12px] font-medium text-slate-400 mb-1.5">종료 시간 (선택)</p>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13.5px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50" />
        </div>
      </div>
      <p className="text-[12px] font-medium text-slate-400 mb-1.5">메모 (선택)</p>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="참고할 내용을 적어주세요"
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[13.5px] resize-none mb-4 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50"
      />
      {mode === "edit" && confirmingDelete ? (
        <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 mb-2">
          <p className="text-[12.5px] text-rose-500 mb-2.5 text-center">이 일정, 정말 거두어도 될까요?</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmingDelete(false)} className="flex-1 rounded-lg bg-white border border-rose-200 text-rose-400 text-[12.5px] font-medium py-2">
              취소
            </button>
            <button onClick={onDelete} className="flex-1 rounded-lg bg-rose-500 text-white text-[12.5px] font-medium py-2">
              삭제할게요
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {mode === "edit" && (
            <button onClick={() => setConfirmingDelete(true)} aria-label="일정 삭제" className="shrink-0 h-[46px] w-[46px] rounded-xl bg-rose-50 text-rose-400 flex items-center justify-center">
              <Trash2 size={17} />
            </button>
          )}
          <button
            disabled={!canSubmit}
            onClick={() => onSubmit({ title: title.trim(), category, startTime, endTime: endTime || undefined, description: description.trim() || undefined })}
            className={`flex-1 rounded-xl text-[14px] font-medium py-3 ${canSubmit ? "bg-violet-500 text-white shadow-lg shadow-violet-100" : "bg-slate-100 text-slate-300"}`}
          >
            {mode === "edit" ? "저장" : "추가하기"}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}

/* ==================================================================== */
/*  카테고리 선택 Bottom Sheet (참여자 제안용)                            */
/* ==================================================================== */
/* ==================================================================== */
/*  빈 시간에 실제로 제안을 남기는 시트 (호스트/영애 모두 사용)             */
/* ==================================================================== */
function ProposeSheet({ open, onClose, event, onSubmit }) {
  const [category, setCategory] = useState("etc");
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  useEffect(() => {
    if (!open) {
      setCategory("etc");
      setTitle("");
      setStartTime("");
      setEndTime("");
    } else if (event) {
      setStartTime(event.startTime || "");
      setEndTime(event.endTime || "");
    }
  }, [open, event]);

  const canSubmit = title.trim().length > 0;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-800">이 시간에 뭘 해볼까요?</h2>
          {event && (
            <p className="text-[12px] text-slate-400 mt-0.5">
              이 사이({event.startTime}
              {event.endTime ? ` ~ ${event.endTime}` : ""}) 어딘가로 시간을 정해주세요
            </p>
          )}
        </div>
        <button onClick={onClose} aria-label="닫기" className="text-slate-300 p-1">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {CATEGORY_KEYS.map((key) => {
          const meta = CATEGORY_META[key];
          const Icon = meta.icon;
          const selected = category === key;
          return (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={`rounded-2xl border py-3.5 flex flex-col items-center gap-1.5 ${selected ? "border-violet-300 bg-violet-50" : "border-slate-100 bg-white"}`}
            >
              <Icon size={18} className={selected ? "text-violet-500" : "text-slate-400"} />
              <span className={`text-[11.5px] ${selected ? "text-violet-600 font-medium" : "text-slate-500"}`}>{meta.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2.5 mb-4">
        <div className="flex-1">
          <p className="text-[12px] font-medium text-slate-400 mb-1.5">시작 시간</p>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13.5px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50"
          />
        </div>
        <div className="flex-1">
          <p className="text-[12px] font-medium text-slate-400 mb-1.5">종료 시간 (선택)</p>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13.5px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50"
          />
        </div>
      </div>

      <p className="text-[12px] font-medium text-slate-400 mb-1.5">한 줄로 제안해주세요</p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="예) 다 같이 보드게임 어때요?"
        maxLength={40}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] mb-4 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50"
      />

      <button
        disabled={!canSubmit}
        onClick={() => {
          onSubmit({ category, title: title.trim(), proposedStartTime: startTime, proposedEndTime: endTime });
          onClose();
        }}
        className={`w-full rounded-full text-[14px] font-medium py-3.5 ${canSubmit ? "bg-violet-500 text-white shadow-lg shadow-violet-200" : "bg-slate-100 text-slate-300"}`}
      >
        의견 올리기
      </button>
    </BottomSheet>
  );
}

/* ==================================================================== */
/*  특정 구간이 아니라 원하는 시간대를 직접 골라 제안하는 시트               */
/*  (호스트/영애 모두 사용 · 호스트만 '바로 확정하기' 옵션 있음)              */
/* ==================================================================== */
function GeneralProposeSheet({ open, onClose, isHost, availableGaps, onSubmit }) {
  const [category, setCategory] = useState("etc");
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("");
  const [selectedGapKey, setSelectedGapKey] = useState(null);
  const [proposeStart, setProposeStart] = useState("");
  const [proposeEnd, setProposeEnd] = useState("");
  const [confirmNow, setConfirmNow] = useState(false);

  useEffect(() => {
    if (!open) {
      setCategory("etc");
      setTitle("");
      setStartTime("12:00");
      setEndTime("");
      setSelectedGapKey(availableGaps?.[0]?.gapKey || null);
      setConfirmNow(false);
    } else {
      setSelectedGapKey(availableGaps?.[0]?.gapKey || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectedGap = availableGaps?.find((g) => g.gapKey === selectedGapKey);

  // 빈 시간을 고르면, 그 범위 안으로 구체적인 제안 시간을 다시 기본값으로 맞춰줘요.
  useEffect(() => {
    if (selectedGap) {
      setProposeStart(selectedGap.startTime);
      setProposeEnd(selectedGap.endTime);
    }
  }, [selectedGap?.gapKey]);

  const canSubmit = title.trim().length > 0 && (confirmNow ? !!startTime : !!selectedGap);

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[16px] font-semibold text-slate-800">어느 시간에 뭘 해볼까요?</h2>
        <button onClick={onClose} aria-label="닫기" className="text-slate-300 p-1">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {CATEGORY_KEYS.map((key) => {
          const meta = CATEGORY_META[key];
          const Icon = meta.icon;
          const selected = category === key;
          return (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={`rounded-2xl border py-3.5 flex flex-col items-center gap-1.5 ${selected ? "border-violet-300 bg-violet-50" : "border-slate-100 bg-white"}`}
            >
              <Icon size={18} className={selected ? "text-violet-500" : "text-slate-400"} />
              <span className={`text-[11.5px] ${selected ? "text-violet-600 font-medium" : "text-slate-500"}`}>{meta.label}</span>
            </button>
          );
        })}
      </div>

      {confirmNow ? (
        <div className="flex gap-2.5 mb-3.5">
          <div className="flex-1">
            <p className="text-[12px] font-medium text-slate-400 mb-1.5">시작 시간</p>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13.5px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50" />
          </div>
          <div className="flex-1">
            <p className="text-[12px] font-medium text-slate-400 mb-1.5">종료 시간 (선택)</p>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13.5px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50" />
          </div>
        </div>
      ) : (
        <div className="mb-3.5">
          <p className="text-[12px] font-medium text-slate-400 mb-1.5">어느 빈 시간에 올릴까요?</p>
          {availableGaps && availableGaps.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-1.5 mb-3.5">
                {availableGaps.map((g) => (
                  <button
                    key={g.gapKey}
                    onClick={() => setSelectedGapKey(g.gapKey)}
                    className={`rounded-full border px-3 py-1.5 text-[12px] ${selectedGapKey === g.gapKey ? "border-violet-500 bg-violet-50 text-violet-600 font-medium" : "border-slate-200 text-slate-500"}`}
                  >
                    {g.startTime} ~ {g.endTime}
                  </button>
                ))}
              </div>
              {selectedGap && (
                <div className="flex gap-2.5 mb-1">
                  <div className="flex-1">
                    <p className="text-[12px] font-medium text-slate-400 mb-1.5">이 사이로 구체적인 시간</p>
                    <input
                      type="time"
                      value={proposeStart}
                      onChange={(e) => setProposeStart(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13.5px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-[12px] font-medium text-slate-400 mb-1.5 opacity-0">종료</p>
                    <input
                      type="time"
                      value={proposeEnd}
                      onChange={(e) => setProposeEnd(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13.5px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50"
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-[12px] text-slate-400 leading-relaxed">
              오늘은 아직 1시간 이상 비어있는 시간이 없어요.{isHost ? " '의견 수렴 없이 바로 확정하기'를 눌러 직접 시간을 정해보세요." : " 안주인께 새 일정을 부탁해보시겠어요?"}
            </p>
          )}
        </div>
      )}

      <p className="text-[12px] font-medium text-slate-400 mb-1.5 mt-3">한 줄로 제안해주세요</p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="예) 산책하면서 이야기 나누기"
        maxLength={40}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] mb-4 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50"
      />

      {isHost && (
        <button
          onClick={() => setConfirmNow((v) => !v)}
          className={`w-full flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-left mb-4 ${confirmNow ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-white"}`}
        >
          <Check size={15} className={confirmNow ? "text-violet-500" : "text-slate-300"} />
          <span className="text-[12.5px] text-slate-600 flex-1">의견 수렴 없이 바로 확정하기</span>
        </button>
      )}

      <button
        disabled={!canSubmit}
        onClick={() => {
          if (confirmNow) {
            onSubmit({ category, title: title.trim(), startTime, endTime: endTime || undefined, confirmNow: true });
          } else {
            onSubmit({
              category,
              title: title.trim(),
              gapStartTime: selectedGap.startTime,
              gapEndTime: selectedGap.endTime,
              proposedStartTime: proposeStart || selectedGap.startTime,
              proposedEndTime: proposeEnd || selectedGap.endTime,
              confirmNow: false,
            });
          }
          onClose();
        }}
        className={`w-full rounded-full text-[14px] font-medium py-3.5 ${canSubmit ? "bg-violet-500 text-white shadow-lg shadow-violet-200" : "bg-slate-100 text-slate-300"}`}
      >
        {isHost && confirmNow ? "이 순서로 확정하기" : "의견 올리기"}
      </button>
    </BottomSheet>
  );
}

function CategoryPickerSheet({ open, onClose, title, subtitle, options }) {
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (!open) setSelected(null);
  }, [open]);
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-[16px] font-semibold text-slate-800">{title}</h2>
          {subtitle && <p className="text-[12px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <button onClick={onClose} aria-label="닫기" className="text-slate-300 p-1">
          <X size={18} />
        </button>
      </div>
      {selected ? (
        <div className="mt-5 mb-1 flex flex-col items-center text-center py-4">
          <div className="h-12 w-12 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center mb-3">
            <Check size={22} />
          </div>
          <p className="text-[14px] font-medium text-slate-800">'{selected.label}' 제안을 시작할게요</p>
          <p className="text-[12px] text-slate-400 mt-1.5 leading-relaxed">
            제안 작성 화면은 다음 단계에서 이어질 예정이에요.
            <br />
            지금은 화면 흐름만 확인하는 MVP 단계예요.
          </p>
          <button onClick={onClose} className="mt-5 w-full rounded-xl bg-violet-600 text-white text-[13px] font-medium py-2.5">
            확인
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5 mt-4">
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <button key={opt.key} onClick={() => setSelected(opt)} className="rounded-2xl bg-violet-50/70 border border-violet-50 py-4 flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform">
                <Icon size={20} className="text-violet-500" />
                <span className="text-[12px] font-medium text-slate-600">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}

/* ==================================================================== */
/*  첨부파일 칩 / 업로드·다운로드 훅                                       */
/* ==================================================================== */
function AttachmentChip({ file, onRemove, onDownload, downloading }) {
  const Icon = fileIconFor(file.type);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2">
      <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
        <Icon size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-slate-800 truncate">{file.name}</p>
        {!!file.size && <p className="text-[10.5px] text-slate-400">{formatBytes(file.size)}</p>}
      </div>
      {onDownload && (
        <button onClick={onDownload} aria-label="다운로드" className="shrink-0 h-7 w-7 rounded-lg bg-violet-50 text-violet-500 flex items-center justify-center">
          {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
        </button>
      )}
      {onRemove && (
        <button onClick={onRemove} aria-label="첨부 제거" className="shrink-0 h-7 w-7 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center">
          <X size={13} />
        </button>
      )}
    </div>
  );
}

function useAttachmentUploader(showToast) {
  const [pending, setPending] = useState([]);
  const [uploading, setUploading] = useState(false);

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        showToast(`'${file.name}'은 너무 커서 챙겨드릴 수 없어요 (3MB까지만 가능해요)`);
        continue;
      }
      setUploading(true);
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const id = `f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        await storageSetJSON(`file:${id}`, { name: file.name, type: file.type, size: file.size, dataUrl });
        setPending((prev) => [...prev, { id, name: file.name, type: file.type, size: file.size }]);
      } catch {
        showToast("파일을 미처 챙겨드리지 못했어요");
      } finally {
        setUploading(false);
      }
    }
  };

  const removeFile = (id) => setPending((prev) => prev.filter((f) => f.id !== id));
  const reset = () => setPending([]);

  return { pending, uploading, addFiles, removeFile, reset };
}

// 브라우저 기본 '당겨서 새로고침'은 페이지를 통째로 다시 불러와서 로그인이 풀려요.
// 그 대신 이 훅으로 같은 제스처를 가로채서, 로그인은 유지한 채 데이터만 다시 불러오게 해요.
function usePullToRefresh(scrollRef, onRefresh) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const pulling = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      // 바텀시트(일정 상세, 게시글 상세 등) 안을 만지고 있는 중이면, 그 안의 자체 스크롤에게 양보해요.
      if (e.target.closest && e.target.closest('[data-sheet-scroll="true"]')) {
        startY.current = null;
        pulling.current = false;
        return;
      }
      if (el.scrollTop <= 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      } else {
        startY.current = null;
        pulling.current = false;
      }
    };
    const onTouchMove = (e) => {
      if (!pulling.current || startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && el.scrollTop <= 0) {
        e.preventDefault();
        setPullDistance(Math.min(dy * 0.45, 72));
      } else {
        pulling.current = false;
        setPullDistance(0);
      }
    };
    const onTouchEnd = () => {
      if (pulling.current) {
        setPullDistance((d) => {
          if (d > 50) {
            setRefreshing(true);
            Promise.resolve(onRefreshRef.current?.()).finally(() => setRefreshing(false));
          }
          return 0;
        });
      }
      pulling.current = false;
      startY.current = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [scrollRef]);

  return { pullDistance, refreshing };
}

function useFileDownloader(showToast) {
  const [downloadingId, setDownloadingId] = useState(null);
  const download = async (fileMeta) => {
    setDownloadingId(fileMeta.id);
    try {
      const full = await storageGetJSON(`file:${fileMeta.id}`, null);
      if (full?.dataUrl) triggerDownload(full.dataUrl, fileMeta.name);
      else showToast("파일을 찾을 수 없었어요");
    } catch {
      showToast("미처 내어드리지 못했어요");
    } finally {
      setDownloadingId(null);
    }
  };
  return { downloadingId, download };
}

const NOTIF_EXPIRY_MS = 24 * 60 * 60 * 1000; // 알림은 하루만 보관해요
function pruneExpiredNotifications(list) {
  const now = Date.now();
  return (list || []).filter((n) => now - n.ts < NOTIF_EXPIRY_MS);
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}
const NOTIF_META = {
  event: { icon: CalendarIcon, chip: "bg-violet-50 text-violet-600" },
  post: { icon: Megaphone, chip: "bg-rose-100 text-rose-500" },
  comment: { icon: MessageSquare, chip: "bg-sky-100 text-sky-600" },
  announcement: { icon: BellRing, chip: "bg-amber-100 text-amber-700" },
};

/* ==================================================================== */
/*  알림 시트                                                            */
/* ==================================================================== */
function NotificationsSheet({ open, onClose, notifications, readSnapshotAt, onSelect, isHost, onOpenAnnouncementAdmin, onDelete }) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[16px] font-semibold text-slate-800">전해드릴 소식</h2>
        <button onClick={onClose} aria-label="닫기" className="text-slate-300 p-1">
          <X size={18} />
        </button>
      </div>

      {isHost && (
        <button
          onClick={onOpenAnnouncementAdmin}
          className="w-full flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-2.5 mb-4"
        >
          <span className="text-[12.5px] font-medium text-amber-700 flex items-center gap-1.5">
            <BellRing size={13} /> 안주인의 전갈 관리하기
          </span>
          <ChevronRight size={15} className="text-amber-400" />
        </button>
      )}

      {notifications.length === 0 ? (
        <p className="text-center text-[13px] text-slate-300 py-10">아직 전해드릴 소식이 없어요</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const meta = NOTIF_META[n.type] || NOTIF_META.event;
            const Icon = meta.icon;
            const isAnnouncement = n.type === "announcement";
            const isRead = n.ts <= readSnapshotAt;
            return (
              <div
                key={n.id}
                className={`relative flex items-start gap-2.5 rounded-xl border p-3 ${isAnnouncement ? "border-amber-200 bg-amber-50/70" : "border-slate-100"} ${
                  isRead ? "opacity-45" : ""
                }`}
              >
                {!isRead && <span className="absolute top-2.5 left-2.5 h-2 w-2 rounded-full bg-rose-500" />}
                <button onClick={() => onSelect(n)} className="flex items-start gap-2.5 flex-1 min-w-0 text-left active:scale-[0.99] transition-transform pl-2.5">
                  <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${meta.chip}`}>
                    <Icon size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    {isAnnouncement && <p className="text-[10.5px] font-medium text-amber-600 mb-0.5">📢 안주인의 전갈</p>}
                    <p className={`text-[13px] leading-snug ${isAnnouncement ? "text-slate-800 font-medium" : "text-slate-800"}`}>{n.message}</p>
                    <p className="text-[10.5px] text-slate-300 mt-0.5">{timeAgo(n.ts)}</p>
                  </div>
                </button>
                {isHost && (
                  <button onClick={() => onDelete(n.id)} aria-label="알림 삭제" className="shrink-0 p-1 text-slate-300">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}

/* ==================================================================== */
/*  홈 화면 (초대장) + 호스트 편집 시트                                     */
/* ==================================================================== */
function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function dDayLabel(dateStr, endDateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = parseLocalDate(dateStr);
  const end = parseLocalDate(endDateStr || dateStr);
  const diffStart = Math.round((start - today) / 86400000);
  const diffEnd = Math.round((end - today) / 86400000);
  if (diffEnd < 0) return "연회가 무사히 끝났어요";
  if (diffStart <= 0 && diffEnd >= 0) return "지금 연회가 한창이에요 ✨";
  if (diffStart === 1) return "연회가 내일이에요";
  return `연회까지 D-${diffStart}`;
}

function HomeScreen({ homeContent, isHost, me, accounts, schedule, onEdit, onGoSchedule, onGoBoard, onRSVP }) {
  const ROLE_STYLE = React.useContext(RoleThemeContext);
  const bg = homeContent.background;
  const fontFamily = fontFamilyFor(homeContent.font);
  const dDay = homeContent.eventStartDate ? dDayLabel(homeContent.eventStartDate, homeContent.eventEndDate || homeContent.eventStartDate) : null;
  const participants = accounts.filter((a) => a.role === "participant");
  const attendingCount = participants.filter((a) => a.rsvp === "yes").length;

  return (
    <div
      className="flex-1 flex flex-col relative"
      style={
        bg
          ? { backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" }
          : { background: "linear-gradient(160deg, #FF8FB8, #B8A7F5)" }
      }
    >
      {isHost && (
        <button
          onClick={onEdit}
          aria-label="초대장 편집"
          className="absolute top-4 right-4 z-10 flex items-center gap-1.5 rounded-full bg-white/85 shadow-md px-3 py-1.5 text-slate-700"
        >
          <Pencil size={13} />
          <span className="text-[12px] font-medium">초대장 편집</span>
        </button>
      )}

      {dDay && (
        <div className="absolute top-4 left-4 z-10 rounded-full bg-white/85 shadow-md px-3 py-1.5">
          <span className="text-[11.5px] font-medium text-slate-700">{dDay}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div
          className="h-11 w-11 rounded-full flex items-center justify-center text-[18px] mb-4 shadow-lg"
          style={{ background: `radial-gradient(circle at 35% 30%, ${ROLE_STYLE.host.avatar}, #6B1E3A)`, border: "2px solid #E8C874" }}
        >
          ⚜️
        </div>
        <h1 className="text-[28px] font-semibold drop-shadow-md leading-snug" style={{ fontFamily, color: homeContent.textColor || "#FFFFFF" }}>
          {homeContent.title}
        </h1>
        <div style={{ width: 40, height: 2, background: "linear-gradient(to right, transparent, #E8C874, transparent)" }} className="my-3" />
        {homeContent.message && (
          <p className="text-[14px] drop-shadow-sm leading-relaxed whitespace-pre-wrap" style={{ fontFamily, color: homeContent.textColor || "#FFFFFF", opacity: 0.92 }}>
            {homeContent.message}
          </p>
        )}

        {!isHost && me?.rsvp !== "yes" && me?.rsvp !== "no" && (
          <div className="mt-5 flex items-center gap-2">
            <button
              onClick={() => onRSVP("yes")}
              style={{ background: "rgba(20,14,22,0.62)", border: "1px solid rgba(255,255,255,0.5)" }}
              className="rounded-full text-white text-[12.5px] font-medium px-4 py-2 shadow-md"
            >
              참석할게요
            </button>
            <button
              onClick={() => onRSVP("no")}
              style={{ background: "rgba(20,14,22,0.4)", border: "1px solid rgba(255,255,255,0.4)" }}
              className="rounded-full text-white text-[12.5px] font-medium px-4 py-2"
            >
              아쉽지만 불참
            </button>
          </div>
        )}
        {!isHost && (me?.rsvp === "yes" || me?.rsvp === "no") && (
          <button
            onClick={() => onRSVP(null)}
            style={{ background: "rgba(20,14,22,0.5)", border: "1px solid rgba(255,255,255,0.4)" }}
            className="mt-5 rounded-full text-white text-[11.5px] px-3.5 py-1.5"
          >
            {me.rsvp === "yes" ? "참석 예정이에요 · 바꾸기" : "불참 전해드렸어요 · 바꾸기"}
          </button>
        )}
      </div>

      <div className="pb-10 pt-4 flex flex-col items-center gap-3 bg-gradient-to-t from-black/25 to-transparent">
        {isHost && (
          <p
            style={{ background: "rgba(20,14,22,0.5)" }}
            className="text-[11.5px] font-medium text-white px-3 py-1 rounded-full"
          >
            영애 {attendingCount}/{participants.length}명 참석 확정
          </p>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={onGoSchedule}
            style={{ background: "rgba(184,167,245,0.32)", border: "1px solid rgba(255,255,255,0.35)" }}
            className="rounded-xl px-5 py-2.5 backdrop-blur-sm text-[14px] font-semibold text-white drop-shadow-sm"
          >
            연회일정 보기
          </button>
          <button
            onClick={onGoBoard}
            style={{ background: "rgba(169,223,245,0.32)", border: "1px solid rgba(255,255,255,0.35)" }}
            className="rounded-xl px-5 py-2.5 backdrop-blur-sm text-[14px] font-semibold text-white drop-shadow-sm"
          >
            담화장 가기
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==================================================================== */
/*  안주인의 전갈: 호스트 관리 화면 + 카나리아가 물어다주는 팝업              */
/* ==================================================================== */
function AnnouncementAdminSheet({ open, onClose, onSend, showToast }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [background, setBackground] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setMessage("");
      setBackground(null);
    }
  }, [open]);

  const handleBgSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await resizeImageForAspect(file, 340, 460, 0.78); // 팝업 카드 비율(세로가 조금 긴 카드)에 맞춤
      setBackground(dataUrl);
    } catch {
      showToast("그림을 미처 준비하지 못했어요");
    } finally {
      setUploading(false);
    }
  };

  const canSend = title.trim().length > 0 && message.trim().length > 0;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-[16px] font-semibold text-slate-800">안주인의 전갈</h2>
        <button onClick={onClose} aria-label="닫기" className="text-slate-300 p-1">
          <X size={18} />
        </button>
      </div>
      <p className="text-[11.5px] text-slate-400 mb-4">전갈을 울리면 지금 접속 중인 모두의 화면에 바로 팝업으로 떠요.</p>

      <p className="text-[12px] font-medium text-slate-400 mb-1.5">팝업 배경 이미지</p>
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full h-24 rounded-xl border border-dashed border-violet-200 flex items-center justify-center overflow-hidden mb-2 relative"
        style={background ? { backgroundImage: `url(${background})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
      >
        {!background && (
          <span className="text-[12px] text-violet-500 flex items-center gap-1.5">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            이미지 선택
          </span>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleBgSelect} />
      </button>
      {background && (
        <button onClick={() => setBackground(null)} className="text-[11px] text-slate-400 underline mb-3">
          배경 지우기
        </button>
      )}

      <p className="text-[12px] font-medium text-slate-400 mb-1.5">전갈 제목</p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={30}
        placeholder="예) 잠시 모여주세요"
        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] mb-3 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50"
      />

      <p className="text-[12px] font-medium text-slate-400 mb-1.5">전갈 내용</p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        placeholder="줄바꿈도 그대로 반영돼요"
        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] resize-none mb-4 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50"
      />

      <button
        disabled={!canSend}
        onClick={() => {
          onSend({ title: title.trim(), message: message.trim(), background });
          onClose();
        }}
        className={`w-full rounded-full text-[14px] font-medium py-3.5 flex items-center justify-center gap-1.5 ${canSend ? "bg-amber-500 text-white shadow-lg shadow-amber-200" : "bg-slate-100 text-slate-300"}`}
      >
        <BellRing size={15} /> 전갈 울리기
      </button>
    </BottomSheet>
  );
}

function AnnouncementPopup({ announcement, onClose }) {
  if (!announcement) return null;
  return (
    <div className="fixed sm:absolute inset-0 z-[70] flex items-center justify-center bg-slate-900/60 px-6">
      <div
        className="relative w-full max-w-[300px] max-h-[70vh] sm:max-h-[520px] rounded-2xl overflow-hidden shadow-2xl"
        style={!announcement.background ? { background: "linear-gradient(160deg, #C9924A, #8B5E2B)" } : {}}
      >
        {announcement.background && (
          <div className="absolute inset-0" style={{ backgroundImage: `url(${announcement.background})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        )}
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative px-6 pt-9 pb-6 text-center max-h-[70vh] sm:max-h-[520px] overflow-y-auto">
          <div className="text-[38px] mb-1.5" style={{ display: "inline-block", animation: "canaryFly 1s ease-out" }}>
            🐦
          </div>
          <p className="text-[10.5px] text-white/75 tracking-[0.15em] mb-1.5">전갈이 도착했습니다</p>
          <h3 className="text-[17px] font-semibold text-white mb-3 drop-shadow leading-snug">{announcement.title}</h3>
          <p className="text-[13px] text-white/95 leading-relaxed whitespace-pre-wrap drop-shadow-sm mb-6">{announcement.message}</p>
          <button onClick={onClose} className="w-full rounded-full bg-white/92 text-slate-700 text-[13px] font-medium py-2.5">
            확인했어요, 영애.
          </button>
        </div>
      </div>
    </div>
  );
}

function HomeEditSheet({ open, onClose, homeContent, onSave, showToast }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [background, setBackground] = useState(null);
  const [font, setFont] = useState("gowun");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [accentTheme, setAccentTheme] = useState("lavenderGold");
  const [eventStartDate, setEventStartDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTitle(homeContent.title || "");
      setMessage(homeContent.message || "");
      setBackground(homeContent.background || null);
      setFont(homeContent.font || "gowun");
      setTextColor(homeContent.textColor || "#FFFFFF");
      setAccentTheme(homeContent.accentTheme || "lavenderGold");
      setEventStartDate(homeContent.eventStartDate || "");
      setEventEndDate(homeContent.eventEndDate || "");
      setInviteCode(homeContent.inviteCode || "");
    }
  }, [open, homeContent]);

  const handleBgSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await resizeImageForAspect(file, 390, 844, 0.75); // 휴대폰 화면 비율(세로로 긴 화면)에 맞춤
      setBackground(dataUrl);
    } catch {
      showToast("그림을 미처 준비하지 못했어요");
    } finally {
      setUploading(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[16px] font-semibold text-slate-800">초대장 편집</h2>
        <button onClick={onClose} aria-label="닫기" className="text-slate-300 p-1">
          <X size={18} />
        </button>
      </div>

      <p className="text-[12px] font-medium text-slate-400 mb-1.5">배경 이미지</p>
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full h-28 rounded-xl border border-dashed border-violet-200 flex items-center justify-center overflow-hidden mb-3 relative"
        style={background ? { backgroundImage: `url(${background})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
      >
        {!background && (
          <span className="text-[12px] text-violet-500 flex items-center gap-1.5">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            이미지 선택
          </span>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleBgSelect} />
      </button>
      {background && (
        <button onClick={() => setBackground(null)} className="text-[11px] text-slate-400 underline mb-3">
          배경 지우기
        </button>
      )}

      <p className="text-[12px] font-medium text-slate-400 mb-1.5">제목</p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] mb-3 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50"
      />

      <p className="text-[12px] font-medium text-slate-400 mb-1.5">연회 날짜 (디데이 기준이에요)</p>
      <div className="flex items-center gap-2 mb-4">
        <input
          type="date"
          value={eventStartDate}
          onChange={(e) => setEventStartDate(e.target.value)}
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-[13.5px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50"
        />
        <span className="text-slate-300 text-[12px]">~</span>
        <input
          type="date"
          value={eventEndDate}
          onChange={(e) => setEventEndDate(e.target.value)}
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-[13.5px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50"
        />
      </div>

      <p className="text-[12px] font-medium text-slate-400 mb-1.5">초대 암호 (선택)</p>
      <input
        value={inviteCode}
        onChange={(e) => setInviteCode(e.target.value)}
        placeholder="비워두면 누구나 닉네임만으로 가입할 수 있어요"
        maxLength={20}
        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] mb-1.5 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50"
      />
      <p className="text-[11px] text-slate-300 mb-4">
        설정해두면 처음 가입하는 사람만 이 암호를 알아야 해요. 다시 로그인할 땐 필요 없어요. 친구들에게 이 암호를 같이 전해주세요.
      </p>

      <p className="text-[12px] font-medium text-slate-400 mb-1.5">환영 문구</p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder={"줄바꿈도 그대로 반영돼요"}
        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] resize-none mb-4 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50"
      />

      <p className="text-[12px] font-medium text-slate-400 mb-1.5">공지글 폰트</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {FONT_OPTIONS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFont(f.key)}
            style={{ fontFamily: f.family }}
            className={`rounded-xl border py-2.5 text-[15px] ${font === f.key ? "border-violet-500 bg-violet-50 text-violet-600" : "border-slate-200 text-slate-800"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <p className="text-[12px] font-medium text-slate-400 mb-1.5">글자색</p>
      <div className="flex items-center gap-2 mb-1.5">
        {TEXT_COLOR_OPTIONS.map((c) => (
          <button
            key={c}
            onClick={() => setTextColor(c)}
            style={{ background: c }}
            className={`h-8 w-8 rounded-full border-2 shadow-sm ${textColor === c ? "border-violet-500" : "border-white"}`}
            aria-label="글자색 선택"
          />
        ))}
        <label className="h-8 w-8 rounded-full border-2 border-slate-200 overflow-hidden relative cursor-pointer flex items-center justify-center">
          <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="absolute -top-1 -left-1 h-10 w-10 cursor-pointer" />
        </label>
      </div>
      <div
        className="rounded-xl mb-5 mt-2 p-4 text-center"
        style={{ background: background ? `url(${background}) center/cover` : "linear-gradient(160deg, #FF8FB8, #B8A7F5)" }}
      >
        <p style={{ color: textColor, fontFamily: fontFamilyFor(font) }} className="text-[16px] font-semibold drop-shadow">
          {title || "제목 미리보기"}
        </p>
      </div>

      <p className="text-[12px] font-medium text-slate-400 mb-1.5">앱 전체 색상 테마</p>
      <p className="text-[11px] text-slate-300 mb-2">연회일정·담화장 화면의 안주인/영애 색상이에요</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {Object.entries(ROLE_COLOR_THEMES).map(([key, t]) => (
          <button
            key={key}
            onClick={() => setAccentTheme(key)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${accentTheme === key ? "border-violet-500 bg-violet-50" : "border-slate-200"}`}
          >
            <span className="flex -space-x-1.5 shrink-0">
              <span className="h-5 w-5 rounded-full border-2 border-white" style={{ background: t.swatch[0] }} />
              <span className="h-5 w-5 rounded-full border-2 border-white" style={{ background: t.swatch[1] }} />
            </span>
            <span className="text-[12px] text-slate-700 truncate">{t.label}</span>
          </button>
        ))}
      </div>

      <button
        onClick={() => {
          if (!title.trim()) {
            showToast("제목을 적어주세요");
            return;
          }
          onSave({ title: title.trim(), message: message.trim(), background, font, textColor, accentTheme, eventStartDate, eventEndDate, inviteCode: inviteCode.trim() });
          onClose();
        }}
        className="w-full rounded-full bg-violet-500 text-white text-[14px] font-medium py-3.5"
      >
        저장하기
      </button>
    </BottomSheet>
  );
}
function PostCard({ post, accounts, onOpen }) {
  const ROLE_STYLE = React.useContext(RoleThemeContext);
  const roleStyle = ROLE_STYLE[post.authorRole];
  return (
    <button onClick={() => onOpen(post)} className={`w-full text-left rounded-2xl p-3.5 border transition-transform active:scale-[0.99] ${post.pinned ? "bg-violet-50/70 border-violet-100" : "bg-white border-slate-100"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {post.pinned && (
            <span className="shrink-0 flex items-center gap-1 text-[10px] font-medium text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">
              <Pin size={10} />
              고정
            </span>
          )}
          <p className="font-medium text-slate-800 text-[15px] truncate">{post.title}</p>
        </div>
        <ChevronRight size={15} className="text-slate-300 shrink-0" />
      </div>
      <p className="text-[12.5px] text-slate-400 mt-1.5 line-clamp-2 pr-2">{post.content}</p>
      <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-400">
        <Avatar accounts={accounts} name={post.author} size={20} />
        <span className={`font-medium ${roleStyle.pastelText}`}>{post.author}</span>
        <span className="text-slate-300">·</span>
        <span>{post.createdAt}</span>
        {post.attachments?.length > 0 && (
          <span className="flex items-center gap-0.5">
            <Paperclip size={11} />
            {post.attachments.length}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          <MessageSquare size={12} />
          {post.comments.length}
        </span>
      </div>
    </button>
  );
}

function BoardScreen({ posts, accounts, onOpenPost }) {
  const pinned = posts.filter((p) => p.pinned);
  const rest = posts.filter((p) => !p.pinned);
  return (
    <div className="px-4 pt-3 pb-28 space-y-2.5">
      {pinned.length === 0 && rest.length === 0 && <p className="text-center text-[13px] text-slate-300 mt-10">아직 오간 말씀이 없으셨어요</p>}
      {[...pinned, ...rest].map((post) => (
        <PostCard key={post.id} post={post} accounts={accounts} onOpen={onOpenPost} />
      ))}
    </div>
  );
}

function CommentRow({ comment, accounts, canEdit, canModerate, onEdit, onDelete, showToast }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.text);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { downloadingId, download } = useFileDownloader(showToast);

  return (
    <div className="flex items-start gap-2">
      <Avatar accounts={accounts} name={comment.author} size={24} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[12.5px] font-medium text-slate-800">{comment.author}</span>
          <span className="text-[10.5px] text-slate-300">{comment.createdAt}</span>
          {comment.edited && <span className="text-[10px] text-slate-300">(수정됨)</span>}
        </div>

        {editing ? (
          <div className="mt-1">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-violet-100 px-2.5 py-2 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-violet-50"
            />
            <div className="flex gap-1.5 mt-1.5">
              <button
                onClick={() => {
                  if (text.trim()) {
                    onEdit(comment.id, text.trim());
                    setEditing(false);
                  }
                }}
                className="text-[11px] font-medium text-white bg-violet-500 rounded-full px-2.5 py-1"
              >
                저장
              </button>
              <button
                onClick={() => {
                  setText(comment.text);
                  setEditing(false);
                }}
                className="text-[11px] font-medium text-slate-400 bg-slate-100 rounded-full px-2.5 py-1"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[13px] text-slate-600 mt-0.5 whitespace-pre-wrap">{linkify(comment.text)}</p>
            {comment.attachments?.length > 0 && (
              <div className="mt-1.5 space-y-1.5">
                {comment.attachments.map((f) => (
                  <AttachmentChip key={f.id} file={f} onDownload={() => download(f)} downloading={downloadingId === f.id} />
                ))}
              </div>
            )}
          </>
        )}

        {!editing && (canEdit || canModerate) && (
          <div className="flex items-center gap-2.5 mt-1">
            {canEdit && (
              <button onClick={() => setEditing(true)} className="text-[10.5px] text-slate-400 flex items-center gap-0.5">
                <Pencil size={10} /> 수정
              </button>
            )}
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} className="text-[10.5px] text-slate-400 flex items-center gap-0.5">
                <Trash2 size={10} /> 삭제
              </button>
            ) : (
              <span className="text-[10.5px] text-rose-400 flex items-center gap-1.5">
                정말이신가요?
                <button onClick={() => onDelete(comment.id)} className="font-medium underline">
                  삭제
                </button>
                <button onClick={() => setConfirmDelete(false)} className="text-slate-400 underline">
                  취소
                </button>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PostDetailSheet({ post, isHost, accounts, me, open, onClose, onTogglePin, onAddComment, onEditComment, onDeleteComment, onEditPost, onDeletePost, showToast }) {
  const ROLE_STYLE = React.useContext(RoleThemeContext);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [confirmDeletePost, setConfirmDeletePost] = useState(false);
  const uploader = useAttachmentUploader(showToast);
  const postDownloader = useFileDownloader(showToast);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setComment("");
      uploader.reset();
      setEditing(false);
      setConfirmDeletePost(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!post) return null;
  const roleStyle = ROLE_STYLE[post.authorRole];
  const isMine = (post.authorId ? post.authorId === me.id : post.author === me.name) || isHost;

  const submitComment = () => {
    const text = comment.trim();
    if (!text && uploader.pending.length === 0) return;
    onAddComment(post.id, text, uploader.pending);
    setComment("");
    uploader.reset();
  };

  const startEdit = () => {
    setDraftTitle(post.title);
    setDraftContent(post.content);
    setEditing(true);
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {post.pinned && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full mb-1.5">
              <Pin size={10} />
              고정된 공지
            </span>
          )}
          {editing ? (
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              className="w-full rounded-lg border border-violet-200 px-2.5 py-1.5 text-[15px] font-semibold mb-1 focus:outline-none focus:ring-1 focus:ring-violet-200"
            />
          ) : (
            <h2 className="text-[17px] font-semibold text-slate-800">{post.title}</h2>
          )}
          <div className="flex items-center gap-1.5 text-[11.5px] text-slate-400 mt-1">
            <span className={`font-medium ${roleStyle.pastelText}`}>{post.author}</span>
            <span>· {post.createdAt}</span>
            {post.edited && <span>· 수정됨</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isHost && !editing && !confirmDeletePost && (
            <button onClick={() => onTogglePin(post)} aria-label={post.pinned ? "고정 해제" : "고정하기"} className={`p-1.5 rounded-full ${post.pinned ? "bg-violet-50 text-violet-600" : "text-slate-300"}`}>
              {post.pinned ? <PinOff size={16} /> : <Pin size={16} />}
            </button>
          )}
          {(isMine || isHost) && !editing && !confirmDeletePost && (
            <button onClick={startEdit} aria-label="글 수정" className="p-1.5 rounded-full text-slate-300">
              <Pencil size={15} />
            </button>
          )}
          {(isMine || isHost) && !editing && !confirmDeletePost && (
            <button onClick={() => setConfirmDeletePost(true)} aria-label="글 삭제" className="p-1.5 rounded-full text-slate-300">
              <Trash2 size={15} />
            </button>
          )}
          <button onClick={onClose} aria-label="닫기" className="text-slate-300 p-1">
            <X size={18} />
          </button>
        </div>
      </div>

      {confirmDeletePost ? (
        <div className="mt-4 rounded-xl bg-rose-50 border border-rose-100 p-3">
          <p className="text-[12.5px] text-rose-500 mb-2 text-center">정말 이 글을 지울까요?</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDeletePost(false)} className="flex-1 rounded-lg bg-white border border-rose-200 text-rose-400 text-[12px] font-medium py-2">
              취소
            </button>
            <button
              onClick={() => {
                onDeletePost(post.id);
                onClose();
              }}
              className="flex-1 rounded-lg bg-rose-500 text-white text-[12px] font-medium py-2"
            >
              삭제할게요
            </button>
          </div>
        </div>
      ) : editing ? (
        <>
          <textarea
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-violet-200 px-3.5 py-2.5 text-[13.5px] resize-none mt-3 focus:outline-none focus:ring-2 focus:ring-violet-50"
          />
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={() => {
                if (draftTitle.trim() && draftContent.trim()) {
                  onEditPost(post.id, draftTitle.trim(), draftContent.trim());
                  setEditing(false);
                }
              }}
              className="flex-1 rounded-xl bg-violet-500 text-white text-[13px] font-medium py-2"
            >
              저장
            </button>
            <button onClick={() => setEditing(false)} className="flex-1 rounded-xl bg-slate-100 text-slate-500 text-[13px] font-medium py-2">
              취소
            </button>
          </div>
        </>
      ) : (
        <p className="text-[13.5px] text-slate-600 mt-4 leading-relaxed whitespace-pre-wrap">{linkify(post.content)}</p>
      )}

      {post.attachments?.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {post.attachments.map((f) => (
            <AttachmentChip key={f.id} file={f} onDownload={() => postDownloader.download(f)} downloading={postDownloader.downloadingId === f.id} />
          ))}
        </div>
      )}

      <div className="h-px bg-slate-100 my-4" />

      <p className="text-[12px] font-medium text-slate-400 mb-2.5">말씀 {post.comments.length}</p>
      <div className="space-y-3 mb-3">
        {post.comments.length === 0 && <p className="text-[12px] text-slate-300">가장 먼저 말씀을 남겨보세요</p>}
        {post.comments.map((c) => (
          <CommentRow
            key={c.id}
            comment={c}
            accounts={accounts}
            canEdit={c.authorId === me.id}
            canModerate={isHost && c.authorId !== me.id}
            onEdit={(id, text) => onEditComment(post.id, id, text)}
            onDelete={(id) => onDeleteComment(post.id, id)}
            showToast={showToast}
          />
        ))}
      </div>

      {uploader.pending.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {uploader.pending.map((f) => (
            <AttachmentChip key={f.id} file={f} onRemove={() => uploader.removeFile(f.id)} />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 sticky bottom-0 bg-white">
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => uploader.addFiles(e.target.files)} />
        <button onClick={() => fileInputRef.current?.click()} aria-label="파일 첨부" className="h-10 w-10 shrink-0 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
          {uploader.uploading ? <Loader2 size={15} className="animate-spin" /> : <Paperclip size={15} />}
        </button>
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitComment()}
          placeholder={`${me.name}(으)로 말씀 남기기`}
          className="flex-1 rounded-full border border-slate-200 px-4 py-2.5 text-[13px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50"
        />
        <button onClick={submitComment} aria-label="말씀 올리기" className="h-10 w-10 shrink-0 rounded-full bg-violet-500 text-white flex items-center justify-center">
          <Send size={15} />
        </button>
      </div>
    </BottomSheet>
  );
}

function NewPostSheet({ open, onClose, isHost, pinnedCount, onSubmit, showToast }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [pin, setPin] = useState(false);
  const uploader = useAttachmentUploader(showToast);
  const fileInputRef = useRef(null);
  const pinDisabled = pinnedCount >= PIN_LIMIT;

  useEffect(() => {
    if (!open) {
      setTitle("");
      setContent("");
      setPin(false);
      uploader.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canSubmit = title.trim().length > 0 && content.trim().length > 0;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[16px] font-semibold text-slate-800">새 담화 남기기</h2>
        <button onClick={onClose} aria-label="닫기" className="text-slate-300 p-1">
          <X size={18} />
        </button>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목을 입력하세요"
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] mb-2.5 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="내용을 입력하세요 (모든 멤버가 글을 쓸 수 있어요)"
        rows={4}
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[14px] resize-none focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50"
      />

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => uploader.addFiles(e.target.files)} />
      <button onClick={() => fileInputRef.current?.click()} className="mt-2.5 flex items-center gap-1.5 text-[12.5px] font-medium text-violet-600">
        {uploader.uploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
        파일 첨부 (PPT·PDF·이미지, 3MB 이하)
      </button>
      {uploader.pending.length > 0 && (
        <div className="space-y-1.5 mt-2">
          {uploader.pending.map((f) => (
            <AttachmentChip key={f.id} file={f} onRemove={() => uploader.removeFile(f.id)} />
          ))}
        </div>
      )}

      {isHost && (
        <button
          onClick={() => !pinDisabled && setPin((v) => !v)}
          disabled={pinDisabled}
          className={`mt-3 w-full flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-left ${pinDisabled ? "border-slate-100 bg-slate-50 opacity-60" : pin ? "border-violet-200 bg-violet-50" : "border-slate-200 bg-white"}`}
        >
          <Pin size={15} className={pin ? "text-violet-600" : "text-slate-400"} />
          <span className="text-[12.5px] text-slate-600 flex-1">중요 공지로 고정하기</span>
          <span className="text-[11px] text-slate-300">{pinDisabled ? "고정은 이미 둘 다 찼어요" : `${pinnedCount}/${PIN_LIMIT}`}</span>
        </button>
      )}

      <button
        disabled={!canSubmit}
        onClick={() => {
          onSubmit({ title: title.trim(), content: content.trim(), pinned: isHost && pin, attachments: uploader.pending });
          onClose();
        }}
        className={`w-full rounded-full text-[14px] font-medium py-3.5 mt-4 ${canSubmit ? "bg-violet-500 text-white shadow-lg shadow-violet-100" : "bg-slate-100 text-slate-300"}`}
      >
        게시하기
      </button>
    </BottomSheet>
  );
}

/* ==================================================================== */
/*  멤버 계정 행 / 내 설정(프로필·비번·멤버관리) 시트                       */
/* ==================================================================== */
function AccountRow({ account, onReset, onRename, onDelete }) {
  const ROLE_STYLE = React.useContext(RoleThemeContext);
  const [mode, setMode] = useState(null); // null | "pin" | "name" | "delete"
  const [pin, setPin] = useState("");
  const [name, setName] = useState(account.name);
  const s = ROLE_STYLE[account.role];

  const openMode = (m) => {
    setMode(m);
    setPin("");
    setName(account.name);
  };

  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div className="flex items-center gap-2.5">
        <Avatar accounts={[account]} name={account.name} size={32} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[13.5px] font-medium text-slate-800">{account.name}</p>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${s.pastelBg} ${s.pastelText}`}>{s.label}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">암구호 ••••</p>
        </div>
      </div>

      {!mode && (
        <div className="flex gap-1.5 mt-2.5">
          <button onClick={() => openMode("pin")} className="text-[11px] font-medium text-violet-600 bg-violet-50 rounded-full px-2.5 py-1.5">
            암구호 재설정
          </button>
          <button onClick={() => openMode("name")} className="text-[11px] font-medium text-slate-500 bg-slate-100 rounded-full px-2.5 py-1.5">
            성함 수정
          </button>
          <button onClick={() => openMode("delete")} className="text-[11px] font-medium text-rose-500 bg-rose-50 rounded-full px-2.5 py-1.5 ml-auto">
            삭제
          </button>
        </div>
      )}

      {mode === "pin" && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <PinInput value={pin} onChange={setPin} size="sm" />
          <div className="flex gap-2 mt-3">
            <button onClick={() => setMode(null)} className="flex-1 rounded-lg bg-slate-100 text-slate-500 text-[12.5px] font-medium py-2">
              취소
            </button>
            <button
              disabled={pin.length !== 4}
              onClick={() => {
                onReset(account.id, pin);
                setMode(null);
              }}
              className={`flex-1 rounded-lg text-[12.5px] font-medium py-2 ${pin.length === 4 ? "bg-violet-500 text-white" : "bg-violet-50 text-violet-200"}`}
            >
              저장
            </button>
          </div>
        </div>
      )}

      {mode === "name" && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={10}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50"
          />
          <div className="flex gap-2 mt-3">
            <button onClick={() => setMode(null)} className="flex-1 rounded-lg bg-slate-100 text-slate-500 text-[12.5px] font-medium py-2">
              취소
            </button>
            <button
              disabled={!name.trim()}
              onClick={() => {
                onRename(account.id, name.trim());
                setMode(null);
              }}
              className={`flex-1 rounded-lg text-[12.5px] font-medium py-2 ${name.trim() ? "bg-violet-500 text-white" : "bg-violet-50 text-violet-200"}`}
            >
              저장
            </button>
          </div>
        </div>
      )}

      {mode === "delete" && (
        <div className="mt-3 pt-3 border-t border-rose-100">
          <p className="text-[12px] text-rose-500 mb-2 text-center">'{account.name}' 영애님을 명부에서 정말 지우실까요?</p>
          <div className="flex gap-2">
            <button onClick={() => setMode(null)} className="flex-1 rounded-lg bg-slate-100 text-slate-500 text-[12.5px] font-medium py-2">
              취소
            </button>
            <button onClick={() => onDelete(account.id)} className="flex-1 rounded-lg bg-rose-500 text-white text-[12.5px] font-medium py-2">
              삭제할게요
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MySettingsSheet({ open, onClose, me, accounts, isHost, onUpdateProfile, onChangeOwnPin, onResetOtherPin, onRenameOther, onDeleteOther, onOpenHomeEdit, personalTheme, onChangePersonalTheme, onLogout, showToast }) {
  const ROLE_STYLE = React.useContext(RoleThemeContext);
  const [name, setName] = useState("");
  const [color, setColor] = useState(null);
  const [emoji, setEmoji] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [pin, setPin] = useState("");
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [pushState, setPushState] = useState("idle"); // idle | requesting | on | denied
  const photoInputRef = useRef(null);

  useEffect(() => {
    if (open && me) {
      setName(me.name);
      setColor(me.color);
      setEmoji(me.emoji);
      setPhoto(me.photo || null);
      setPin("");
      if (typeof Notification !== "undefined") {
        setPushState(Notification.permission === "granted" ? "on" : Notification.permission === "denied" ? "denied" : "idle");
      }
    }
  }, [open, me]);

  if (!me) return null;
  const previewColor = color || baseAvatarColor(accounts, me.name, ROLE_STYLE);
  const previewLabel = emoji || name[0] || "?";
  const others = accounts.filter((a) => a.id !== me.id);

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, 200, 0.82);
      setPhoto(dataUrl);
    } catch {
      showToast("사진을 미처 준비하지 못했어요");
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleEnablePush = async () => {
    setPushState("requesting");
    try {
      const token = await requestPushPermission(me.id);
      if (token) {
        setPushState("on");
        showToast("이 기기로 소식이 오면 알려드릴게요 🔔");
      } else {
        setPushState(typeof Notification !== "undefined" && Notification.permission === "denied" ? "denied" : "idle");
        if (typeof Notification !== "undefined" && Notification.permission !== "denied") {
          showToast("알림을 아직 받을 준비가 안 됐어요");
        }
      }
    } catch {
      setPushState("idle");
      showToast("알림 설정 중 문제가 있었어요");
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[16px] font-semibold text-slate-800">몸단장</h2>
        <button onClick={onClose} aria-label="닫기" className="text-slate-300 p-1">
          <X size={18} />
        </button>
      </div>

      {isHost && (
        <button
          onClick={() => {
            onClose();
            onOpenHomeEdit();
          }}
          className="w-full flex items-center justify-between rounded-xl bg-violet-50 text-violet-600 px-3.5 py-2.5 mb-4"
        >
          <span className="text-[13px] font-medium flex items-center gap-1.5">
            <Pencil size={13} /> 초대장(첫 화면) 편집
          </span>
          <ChevronRight size={15} />
        </button>
      )}

      <p className="text-[12px] font-medium text-slate-400 mb-1.5">내 화면 색상 테마</p>
      <p className="text-[11px] text-slate-300 mb-2">나한테만 이렇게 보여요 · 다른 분들 화면엔 영향 없어요</p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        {Object.entries(ROLE_COLOR_THEMES).map(([key, t]) => (
          <button
            key={key}
            onClick={() => onChangePersonalTheme(key)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${personalTheme === key ? "border-violet-500 bg-violet-50" : "border-slate-200"}`}
          >
            <span className="flex -space-x-1.5 shrink-0">
              <span className="h-5 w-5 rounded-full border-2 border-white" style={{ background: t.swatch[0] }} />
              <span className="h-5 w-5 rounded-full border-2 border-white" style={{ background: t.swatch[1] }} />
            </span>
            <span className="text-[12px] text-slate-700 truncate">{t.label}</span>
          </button>
        ))}
      </div>
      {personalTheme && (
        <button onClick={() => onChangePersonalTheme(null)} className="text-[11px] text-slate-400 underline mb-4">
          안주인이 정한 색으로 되돌리기
        </button>
      )}

      <div className="flex flex-col items-center mb-4">
        <div className="relative">
          {photo ? (
            <img src={photo} alt="프로필 사진" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-full flex items-center justify-center text-[24px] font-semibold text-white" style={{ background: previewColor }}>
              {previewLabel}
            </div>
          )}
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
          <button
            onClick={() => photoInputRef.current?.click()}
            aria-label="프로필 사진 업로드"
            className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-violet-500 text-white flex items-center justify-center border-2 border-white"
          >
            {photoUploading ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
          </button>
        </div>
        {photo && (
          <button onClick={() => setPhoto(null)} className="text-[11px] text-slate-400 underline mt-1.5">
            사진 지우고 이모지로
          </button>
        )}
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-2 ${ROLE_STYLE[me.role].pastelBg} ${ROLE_STYLE[me.role].pastelText}`}>{ROLE_STYLE[me.role].label}</span>
      </div>

      <p className="text-[12px] font-medium text-slate-400 mb-1.5">성함</p>
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={10} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[14px] mb-3 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-50" />

      {!photo && (
        <>
          <p className="text-[12px] font-medium text-slate-400 mb-1.5">가문 문장</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button onClick={() => setEmoji(null)} className={`h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-semibold border ${!emoji ? "border-violet-500 bg-violet-50 text-violet-600" : "border-slate-200 text-slate-400"}`}>
              Aa
            </button>
            {AVATAR_EMOJI_OPTIONS.map((e) => (
              <button key={e} onClick={() => setEmoji(e)} className={`h-9 w-9 rounded-full flex items-center justify-center text-[16px] border ${emoji === e ? "border-violet-500 bg-violet-50" : "border-slate-200"}`}>
                {e}
              </button>
            ))}
          </div>
          <p className="text-[12px] font-medium text-slate-400 mb-1.5">가문 빛깔</p>
          <div className="flex gap-2 mb-4">
            {AVATAR_COLOR_PALETTE.map((c) => (
              <button key={c} onClick={() => setColor(c)} style={{ background: c }} className={`h-8 w-8 rounded-full border-2 ${color === c ? "border-slate-800" : "border-white"} shadow-sm`} aria-label="가문 빛깔 선택" />
            ))}
          </div>
        </>
      )}

      <button onClick={() => onUpdateProfile({ name, color, emoji, photo })} className="w-full rounded-xl bg-violet-500 text-white text-[13.5px] font-medium py-2.5 mb-5">
        차림새 저장
      </button>

      <div className="h-px bg-slate-100 mb-4" />

      <div className="flex items-center gap-1.5 mb-2.5">
        <KeyRound size={15} className="text-violet-500" />
        <p className="text-[13px] font-semibold text-slate-800">암구호 변경</p>
      </div>
      <PinInput value={pin} onChange={setPin} size="sm" />
      <button
        disabled={pin.length !== 4}
        onClick={() => {
          onChangeOwnPin(pin);
          setPin("");
        }}
        className={`w-full rounded-xl text-[13.5px] font-medium py-2.5 mt-3 ${pin.length === 4 ? "bg-violet-50 text-violet-600" : "bg-slate-100 text-slate-300"}`}
      >
        변경하기
      </button>

      {isHost && others.length > 0 && (
        <>
          <div className="h-px bg-slate-100 my-5" />
          <div className="flex items-center gap-1.5 mb-1">
            <UserCog size={15} className="text-violet-500" />
            <p className="text-[13px] font-semibold text-slate-800">멤버 암구호 관리</p>
          </div>
          <p className="text-[11.5px] text-slate-400 mb-3">영애님께서 암구호를 잊으셨거나 잘못 누르셨을 때 여기서 다시 정해드릴 수 있어요.</p>
          <div className="space-y-2.5">
            {others.map((acc) => (
              <AccountRow key={acc.id} account={acc} onReset={onResetOtherPin} onRename={onRenameOther} onDelete={onDeleteOther} />
            ))}
          </div>
        </>
      )}

      <div className="h-px bg-slate-100 my-5" />

      {pushState === "on" ? (
        <p className="text-[12px] text-emerald-600 flex items-center justify-center gap-1.5 py-1.5">
          <BellRing size={13} /> 이 기기에서 알림을 받고 있어요
        </p>
      ) : pushState === "denied" ? (
        <p className="text-[11.5px] text-slate-400 text-center py-1.5 leading-relaxed">
          알림이 차단돼 있어요. 폰 설정 &gt; 브라우저(또는 이 앱) 알림 권한을 허용해주세요.
        </p>
      ) : (
        <button
          onClick={handleEnablePush}
          disabled={pushState === "requesting"}
          className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/60 text-amber-700 text-[12.5px] font-medium py-2.5"
        >
          <BellRing size={14} /> {pushState === "requesting" ? "확인 중..." : "이 기기에서 알림 받기"}
        </button>
      )}

      <div className="h-px bg-slate-100 my-5" />
      {!confirmLogout ? (
        <button onClick={() => setConfirmLogout(true)} className="w-full text-[12.5px] font-medium text-slate-400 py-1">
          로그아웃
        </button>
      ) : (
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[12px] text-slate-500 mb-2 text-center">이 기기에서 로그아웃할까요? 다음에 다시 성함과 암구호로 들어오셔야 해요.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmLogout(false)} className="flex-1 rounded-lg bg-white border border-slate-200 text-slate-400 text-[12px] font-medium py-2">
              취소
            </button>
            <button onClick={onLogout} className="flex-1 rounded-lg bg-slate-700 text-white text-[12px] font-medium py-2">
              로그아웃할게요
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

/* ==================================================================== */
/*  로그인 이후 메인 화면 (일정 / 게시판 탭)                                */
/* ==================================================================== */
function MainScreen({ session, accounts, updateAccounts, homeContent, updateHomeContent, onSessionInvalid, onLogout, refreshSignal }) {
  const me = accounts.find((a) => a.id === session.accountId);
  const isHost = me?.role === "host";

  useEffect(() => {
    if (!me) onSessionInvalid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [personalTheme, setPersonalTheme] = useState(null);
  const [activeTab, setActiveTab] = useState("home");
  const [schedule, setSchedule] = useState(INITIAL_SCHEDULE);
  const [selectedDate, setSelectedDate] = useState("2026-09-18");
  const [detailEvent, setDetailEvent] = useState(null);
  const [emptySheetEvent, setEmptySheetEvent] = useState(null);
  const [generalSheetOpen, setGeneralSheetOpen] = useState(false);
  const [eventForm, setEventForm] = useState(null);

  const [posts, setPosts] = useState(INITIAL_POSTS);
  const [detailPost, setDetailPost] = useState(null);
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [homeEditOpen, setHomeEditOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [activeAnnouncement, setActiveAnnouncement] = useState(null);
  const [announcementAdminOpen, setAnnouncementAdminOpen] = useState(false);
  const seenAnnouncementIdRef = useRef(null);
  const [lastReadAt, setLastReadAt] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = useCallback((message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loadedSchedule = await storageGetJSON("schedule_v2", null);
      const loadedPosts = await storageGetJSON("posts", null);
      const loadedNotifs = await storageGetJSON("notifications", null);
      const loadedReadAt = await (async () => {
        try {
          const res = await window.storage.get(`read_at:${session.accountId}`, true);
          return res ? Number(res.value) : 0;
        } catch {
          return 0;
        }
      })();
      const loadedPersonalTheme = await (async () => {
        try {
          const res = await window.storage.get("personal_theme", false);
          return res ? res.value : null;
        } catch {
          return null;
        }
      })();
      const loadedAnnouncement = await storageGetJSON("announcement", null);
      const loadedSeenAnnouncementId = await (async () => {
        try {
          const res = await window.storage.get(`seen_announcement:${me.id}`, true);
          return res ? res.value : null;
        } catch {
          return null;
        }
      })();
      if (cancelled) return;
      if (loadedSchedule) setSchedule(loadedSchedule);
      else storageSetJSON("schedule_v2", INITIAL_SCHEDULE);
      if (loadedPosts) setPosts(loadedPosts);
      else storageSetJSON("posts", INITIAL_POSTS);
      if (loadedNotifs) setNotifications(pruneExpiredNotifications(loadedNotifs));
      setLastReadAt(loadedReadAt || 0);
      if (loadedPersonalTheme) setPersonalTheme(loadedPersonalTheme);
      seenAnnouncementIdRef.current = loadedSeenAnnouncementId;
      if (loadedAnnouncement && loadedAnnouncement.id !== loadedSeenAnnouncementId) {
        setActiveAnnouncement(loadedAnnouncement);
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasStorage) return;
    const t = setInterval(async () => {
      const s = await storageGetJSON("schedule_v2", null);
      if (s) setSchedule((prev) => (JSON.stringify(prev) === JSON.stringify(s) ? prev : s));
      const p = await storageGetJSON("posts", null);
      if (p) setPosts((prev) => (JSON.stringify(prev) === JSON.stringify(p) ? prev : p));
      const n = await storageGetJSON("notifications", null);
      if (n) {
        const pruned = pruneExpiredNotifications(n);
        setNotifications((prev) => (JSON.stringify(prev) === JSON.stringify(pruned) ? prev : pruned));
      }
      const ann = await storageGetJSON("announcement", null);
      if (ann && ann.id !== seenAnnouncementIdRef.current) {
        setActiveAnnouncement((prev) => (prev && prev.id === ann.id ? prev : ann));
      }
    }, 8000);
    return () => clearInterval(t);
  }, []);

  const addNotification = (entry) => {
    if (!hasStorage) return;
    const notif = { id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ts: Date.now(), ...entry };
    (async () => {
      const current = (await storageGetJSON("notifications", [])) || [];
      const next = pruneExpiredNotifications([notif, ...current]).slice(0, 50);
      await storageSetJSON("notifications", next);
      setNotifications(next);
    })();
  };

  const handleSendAnnouncementFull = ({ title, message, background }) => {
    const ann = { id: `ann-${Date.now()}`, title, message, background, ts: Date.now() };
    storageSetJSON("announcement", ann);
    seenAnnouncementIdRef.current = ann.id;
    if (hasStorage) window.storage.set(`seen_announcement:${me.id}`, ann.id, true).catch(() => {});
    addNotification({ type: "announcement", actorId: me.id, message: title, announcementData: { title, message, background } });
    // 진짜 폰 푸시 알림도 같이 요청해요 (안 되더라도 앱 안 팝업은 이미 떴으니 조용히 넘어가요).
    fetch("/api/send-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, message }),
    }).catch(() => {});
    showToast("전갈을 울렸어요 🔔");
  };

  const handleDismissAnnouncement = () => {
    if (activeAnnouncement) {
      seenAnnouncementIdRef.current = activeAnnouncement.id;
      if (hasStorage) window.storage.set(`seen_announcement:${me.id}`, activeAnnouncement.id, true).catch(() => {});
      // 팝업에서 확인한 전갈은 알림함에서도 이미 읽은 것처럼 보이게 읽음 시각을 같이 올려요.
      const readTs = Math.max(lastReadAt, activeAnnouncement.ts || Date.now());
      setLastReadAt(readTs);
      if (hasStorage) window.storage.set(`read_at:${me.id}`, String(readTs), true).catch(() => {});
    }
    setActiveAnnouncement(null);
  };

  const unreadCount = notifications.filter((n) => n.actorId !== me?.id && n.ts > lastReadAt).length;

  const [readSnapshotAt, setReadSnapshotAt] = useState(0);
  const handleOpenNotifications = () => {
    setReadSnapshotAt(lastReadAt);
    setNotificationsOpen(true);
  };
  const handleCloseNotifications = () => {
    setNotificationsOpen(false);
    const now = Date.now();
    setLastReadAt(now);
    if (hasStorage) window.storage.set(`read_at:${me.id}`, String(now), true).catch(() => {});
  };

  const handleDeleteNotification = (id) => {
    (async () => {
      const latest = (await storageGetJSON("notifications", null)) ?? notifications;
      const next = latest.filter((n) => n.id !== id);
      await storageSetJSON("notifications", next);
      setNotifications(next);
    })();
  };

  const handleSelectNotification = (n) => {
    handleCloseNotifications();
    if (n.type === "event") {
      setActiveTab("schedule");
      if (n.dayDate) setSelectedDate(n.dayDate);
      const day = schedule.find((d) => d.date === n.dayDate);
      const ev = day?.events.find((e) => e.id === n.eventId);
      if (ev) setDetailEvent(ev);
    } else if (n.type === "announcement") {
      if (n.announcementData) setActiveAnnouncement({ id: n.id, ...n.announcementData });
    } else {
      setActiveTab("board");
      const post = posts.find((p) => p.id === n.postId);
      if (post) setDetailPost(post);
    }
  };

  const handleManualRefresh = async () => {
    if (!hasStorage || refreshing) return;
    setRefreshing(true);
    try {
      const s = await storageGetJSON("schedule_v2", null);
      if (s) setSchedule(s);
      const p = await storageGetJSON("posts", null);
      if (p) setPosts(p);
      const n = await storageGetJSON("notifications", null);
      if (n) setNotifications(n);
      showToast("가장 최근 소식으로 정리해두었어요");
    } finally {
      setTimeout(() => setRefreshing(false), 400);
    }
  };

  const firstRefreshSignal = useRef(true);
  useEffect(() => {
    if (firstRefreshSignal.current) {
      firstRefreshSignal.current = false;
      return;
    }
    handleManualRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  const updateSchedule = (updater) => {
    (async () => {
      const latest = (await storageGetJSON("schedule_v2", null)) ?? schedule;
      const next = typeof updater === "function" ? updater(latest) : updater;
      await storageSetJSON("schedule_v2", next);
      setSchedule(next);
    })();
  };
  const updatePosts = (updater) => {
    (async () => {
      const latest = (await storageGetJSON("posts", null)) ?? posts;
      const next = typeof updater === "function" ? updater(latest) : updater;
      await storageSetJSON("posts", next);
      setPosts(next);
    })();
  };

  const currentDay = schedule.find((d) => d.date === selectedDate) || schedule[0];
  const sortEvents = (events) => [...events].sort((a, b) => a.startTime.localeCompare(b.startTime));

  const handleToggleLike = (gapKey, proposalId) => {
    updateSchedule((prev) =>
      prev.map((day) => {
        if (day.date !== selectedDate) return day;
        const list = day.gapProposals?.[gapKey] || [];
        const updated = list.map((p) => (p.id === proposalId ? { ...p, likedByMe: !p.likedByMe, likes: p.likedByMe ? p.likes - 1 : p.likes + 1 } : p));
        return { ...day, gapProposals: { ...day.gapProposals, [gapKey]: updated } };
      })
    );
  };

  const handleAddProposal = (gapItem, proposal) => {
    updateSchedule((prev) =>
      prev.map((day) => {
        if (day.date !== selectedDate) return day;
        const newEvent = {
          id: `e-${Date.now()}`,
          title: proposal.title,
          category: proposal.category || guessCategory(proposal.title),
          startTime: proposal.proposedStartTime || gapItem.startTime,
          endTime: proposal.proposedEndTime || gapItem.endTime,
          status: "confirmed",
          participants: accounts.length,
          description: `${proposal.proposer}님이 제안했고, 다 같이 좋아해서 확정했어요.`,
        };
        const bucketKey = proposal.__bucketKey || gapItem.gapKey;
        const restList = (day.gapProposals?.[bucketKey] || []).filter((p) => p.id !== proposal.id);
        const nextGapProposals = { ...day.gapProposals, [bucketKey]: restList };
        return { ...day, events: sortEvents([...day.events, newEvent]), gapProposals: nextGapProposals };
      })
    );
    showToast(`'${proposal.title}' 일정을 확정 지었어요 🎉`);
  };

  const openCreateEvent = () => setEventForm({ mode: "create", dayDate: selectedDate, targetId: null, initial: null });
  const openCreateFromEmpty = (gapItem) =>
    setEventForm({ mode: "create", dayDate: selectedDate, targetId: null, initial: { startTime: gapItem.startTime, endTime: gapItem.endTime === "24:00" ? undefined : gapItem.endTime } });
  const openEditEvent = (event) => {
    setDetailEvent(null);
    setEventForm({ mode: "edit", dayDate: selectedDate, targetId: event.id, initial: event });
  };

  const handleSubmitEventForm = (data) => {
    const { dayDate, targetId, mode } = eventForm;
    const newId = targetId || `e-${Date.now()}`;
    updateSchedule((prev) =>
      prev.map((day) => {
        if (day.date !== dayDate) return day;
        const events = targetId
          ? day.events.map((ev) => (ev.id === targetId ? { ...ev, ...data, status: "confirmed", participants: ev.participants || accounts.length } : ev))
          : [...day.events, { id: newId, ...data, status: "confirmed", participants: accounts.length }];
        return { ...day, events: sortEvents(events) };
      })
    );
    if (mode !== "edit") {
      addNotification({ type: "event", actorId: me.id, message: `${me.name} 영애님께서 '${data.title}' 연회 순서를 정하셨어요`, dayDate, eventId: newId });
    }
    showToast(mode === "edit" ? "일정을 고쳐 적었어요" : "새 일정을 올렸어요 🎉");
    setEventForm(null);
  };

  const handleDeleteEvent = () => {
    const { dayDate, targetId } = eventForm;
    updateSchedule((prev) => prev.map((day) => (day.date !== dayDate ? day : { ...day, events: day.events.filter((ev) => ev.id !== targetId) })));
    showToast("일정을 거두었어요");
    setEventForm(null);
  };

  const handlePlanEmpty = (gapItem) => (isHost ? openCreateFromEmpty(gapItem) : setEmptySheetEvent(gapItem));

  const handleToggleDayClosed = () => {
    updateSchedule((prev) => prev.map((day) => (day.date === selectedDate ? { ...day, closed: !day.closed } : day)));
    showToast(currentDay.closed ? "이 날짜 일정을 다시 열었어요" : "이 날짜 일정을 마감했어요");
  };

  const handleSubmitProposal = (gapItem, { category, title, proposedStartTime, proposedEndTime }) => {
    if (!gapItem) return;
    const newProposal = {
      id: `p-${Date.now()}`,
      title,
      category,
      proposer: me.name,
      proposerId: me.id,
      likes: 0,
      likedByMe: false,
      proposedStartTime: proposedStartTime || gapItem.startTime,
      proposedEndTime: proposedEndTime || undefined,
    };
    updateSchedule((prev) =>
      prev.map((day) => {
        if (day.date !== selectedDate) return day;
        const list = day.gapProposals?.[gapItem.gapKey] || [];
        return { ...day, gapProposals: { ...day.gapProposals, [gapItem.gapKey]: [...list, newProposal] } };
      })
    );
    showToast("의견을 잘 전해드렸어요 ✨");
  };

  const handleGeneralPropose = ({ category, title, startTime, endTime, gapStartTime, gapEndTime, proposedStartTime, proposedEndTime, confirmNow }) => {
    updateSchedule((prev) =>
      prev.map((day) => {
        if (day.date !== selectedDate) return day;
        if (confirmNow) {
          const events = sortEvents([...day.events, { id: `e-${Date.now()}`, title, category, startTime, endTime, status: "confirmed", participants: accounts.length }]);
          return { ...day, events };
        }
        const key = `${gapStartTime}-${gapEndTime}`;
        const newProposal = {
          id: `p-${Date.now()}`,
          title,
          category,
          proposer: me.name,
          proposerId: me.id,
          likes: 0,
          likedByMe: false,
          proposedStartTime: proposedStartTime || gapStartTime,
          proposedEndTime: proposedEndTime || gapEndTime,
        };
        const list = day.gapProposals?.[key] || [];
        return { ...day, gapProposals: { ...day.gapProposals, [key]: [...list, newProposal] } };
      })
    );
    showToast(confirmNow ? `'${title}' 순서를 확정 지었어요 🎉` : "의견을 잘 전해드렸어요 ✨ 다른 분들도 같이 볼 수 있어요");
  };

  const handleEditProposal = (gapKey, proposalId, newTitle) => {
    updateSchedule((prev) =>
      prev.map((day) => {
        if (day.date !== selectedDate) return day;
        const list = (day.gapProposals?.[gapKey] || []).map((p) => (p.id === proposalId ? { ...p, title: newTitle, edited: true } : p));
        return { ...day, gapProposals: { ...day.gapProposals, [gapKey]: list } };
      })
    );
    showToast("의견을 고쳐 적었어요");
  };

  const handleDeleteProposal = (gapKey, proposalId) => {
    updateSchedule((prev) =>
      prev.map((day) => {
        if (day.date !== selectedDate) return day;
        const list = (day.gapProposals?.[gapKey] || []).filter((p) => p.id !== proposalId);
        return { ...day, gapProposals: { ...day.gapProposals, [gapKey]: list } };
      })
    );
    showToast("의견을 거두었어요");
  };

  const handleTogglePin = (post) => {
    const pinnedCount = posts.filter((p) => p.pinned).length;
    if (!post.pinned && pinnedCount >= PIN_LIMIT) {
      showToast("고정할 수 있는 공지는 두 개까지예요");
      return;
    }
    updatePosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, pinned: !p.pinned } : p)));
    setDetailPost((prev) => (prev && prev.id === post.id ? { ...prev, pinned: !prev.pinned } : prev));
    showToast(post.pinned ? "고정을 풀었어요" : "공지를 걸어두었어요 📌");
  };

  const handleAddComment = (postId, text, attachments) => {
    const newComment = { id: `c-${Date.now()}`, authorId: me.id, author: me.name, createdAt: "방금", text, attachments: attachments || [] };
    updatePosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: [...p.comments, newComment] } : p)));
    setDetailPost((prev) => (prev && prev.id === postId ? { ...prev, comments: [...prev.comments, newComment] } : prev));
    addNotification({ type: "comment", actorId: me.id, message: `${me.name} 영애님께서 말씀을 남기셨어요: "${text.slice(0, 20)}${text.length > 20 ? "…" : ""}"`, postId });
  };

  const handleEditComment = (postId, commentId, newText) => {
    updatePosts((prev) => prev.map((p) => (p.id !== postId ? p : { ...p, comments: p.comments.map((c) => (c.id === commentId ? { ...c, text: newText, edited: true } : c)) })));
    setDetailPost((prev) => (prev && prev.id === postId ? { ...prev, comments: prev.comments.map((c) => (c.id === commentId ? { ...c, text: newText, edited: true } : c)) } : prev));
  };

  const handleDeleteComment = (postId, commentId) => {
    updatePosts((prev) => prev.map((p) => (p.id !== postId ? p : { ...p, comments: p.comments.filter((c) => c.id !== commentId) })));
    setDetailPost((prev) => (prev && prev.id === postId ? { ...prev, comments: prev.comments.filter((c) => c.id !== commentId) } : prev));
    showToast("말씀을 거두었어요");
  };

  const handleEditPost = (postId, newTitle, newContent) => {
    updatePosts((prev) => prev.map((p) => (p.id === postId ? { ...p, title: newTitle, content: newContent, edited: true } : p)));
    setDetailPost((prev) => (prev && prev.id === postId ? { ...prev, title: newTitle, content: newContent, edited: true } : prev));
    showToast("글을 고쳐 적었어요");
  };

  const handleDeletePost = (postId) => {
    updatePosts((prev) => prev.filter((p) => p.id !== postId));
    setDetailPost(null);
    showToast("글을 거두었어요");
  };

  const handleNewPost = ({ title, content, pinned, attachments }) => {
    const newId = `b-${Date.now()}`;
    const newPost = { id: newId, title, content, author: me.name, authorId: me.id, authorRole: me.role, pinned, createdAt: "방금", attachments: attachments || [], comments: [] };
    updatePosts((prev) => [newPost, ...prev]);
    addNotification({ type: "post", actorId: me.id, message: `${me.name} 영애님께서 담화장에 '${title}' 말씀을 올리셨어요`, postId: newId });
    showToast(pinned ? "공지로 걸어 올렸어요 📌" : "담화장에 말씀을 올렸어요");
  };

  const handleUpdateProfile = ({ name, color, emoji, photo }) => {
    const trimmed = (name || "").trim();
    if (!trimmed) {
      showToast("성함을 입력해주세요");
      return;
    }
    const dup = accounts.some((a) => a.id !== me.id && a.name === trimmed);
    if (dup) {
      showToast("이미 사용 중인 성함이에요");
      return;
    }
    const oldName = me.name;
    updateAccounts((prev) => prev.map((a) => (a.id === me.id ? { ...a, name: trimmed, color, emoji, photo } : a)));

    if (oldName !== trimmed) {
      updatePosts((prev) =>
        prev.map((p) => ({ ...p, author: p.author === oldName ? trimmed : p.author, comments: p.comments.map((c) => (c.author === oldName ? { ...c, author: trimmed } : c)) }))
      );
      updateSchedule((prev) =>
        prev.map((day) => ({ ...day, events: day.events.map((ev) => (ev.proposals ? { ...ev, proposals: ev.proposals.map((p) => (p.proposer === oldName ? { ...p, proposer: trimmed } : p)) } : ev)) }))
      );
    }
    showToast("차림새를 새로 정리해두었어요");
  };

  const handleRSVP = (value) => {
    updateAccounts((prev) => prev.map((a) => (a.id === me.id ? { ...a, rsvp: value } : a)));
    if (value === "yes") showToast("참석 뜻을 전해드렸어요");
    else if (value === "no") showToast("아쉬운 소식, 잘 전해드렸어요");
  };

  const handleChangeOwnPin = async (newPin) => {
    const hashed = await hashPin(newPin);
    updateAccounts((prev) => prev.map((a) => (a.id === me.id ? { ...a, pin: hashed } : a)));
    showToast("암구호를 새로 정했어요");
  };

  const handleResetOtherPin = async (accountId, newPin) => {
    const acc = accounts.find((a) => a.id === accountId);
    const hashed = await hashPin(newPin);
    updateAccounts((prev) => prev.map((a) => (a.id === accountId ? { ...a, pin: hashed } : a)));
    showToast(`${acc ? acc.name : ""} 영애님의 암구호를 새로 정해드렸어요`);
  };

  const handleRenameOther = (accountId, newName) => {
    const trimmed = (newName || "").trim();
    if (!trimmed) return;
    if (accounts.some((a) => a.id !== accountId && a.name === trimmed)) {
      showToast("이미 사용 중인 성함이에요");
      return;
    }
    const acc = accounts.find((a) => a.id === accountId);
    const oldName = acc?.name;
    updateAccounts((prev) => prev.map((a) => (a.id === accountId ? { ...a, name: trimmed } : a)));
    if (oldName && oldName !== trimmed) {
      updatePosts((prev) =>
        prev.map((p) => ({ ...p, author: p.author === oldName ? trimmed : p.author, comments: p.comments.map((c) => (c.author === oldName ? { ...c, author: trimmed } : c)) }))
      );
      updateSchedule((prev) =>
        prev.map((day) => ({ ...day, events: day.events.map((ev) => (ev.proposals ? { ...ev, proposals: ev.proposals.map((p) => (p.proposer === oldName ? { ...p, proposer: trimmed } : p)) } : ev)) }))
      );
    }
    showToast(`성함을 '${trimmed}'(으)로 바꿔드렸어요`);
  };

  const handleDeleteOther = (accountId) => {
    const acc = accounts.find((a) => a.id === accountId);
    updateAccounts((prev) => prev.filter((a) => a.id !== accountId));
    showToast(`${acc ? acc.name : "그분"}을 명부에서 지웠어요`);
  };

  const handleChangePersonalTheme = (themeKey) => {
    setPersonalTheme(themeKey);
    if (hasStorage) {
      if (themeKey) window.storage.set("personal_theme", themeKey, false).catch(() => {});
      else window.storage.delete("personal_theme", false).catch(() => {});
    }
    showToast(themeKey ? "내 화면에서만 색이 바뀌어요" : "안주인이 정한 색으로 돌아갔어요");
  };

  const pinnedCount = posts.filter((p) => p.pinned).length;

  if (!me) return null;

  return (
    <RoleThemeContext.Provider value={resolveRoleStyle(personalTheme || homeContent.accentTheme)}>
      <Header
        accounts={accounts}
        title={homeContent.title}
        onOpenSettings={() => setSettingsOpen(true)}
        onBack={activeTab !== "home" ? () => setActiveTab("home") : null}
        onOpenNotifications={handleOpenNotifications}
        unreadCount={unreadCount}
        onRefresh={handleManualRefresh}
        refreshing={refreshing}
      />

      {!loaded ? (
        <div className="flex-1 flex items-center justify-center text-slate-300 text-[13px]">불러오는 중...</div>
      ) : activeTab === "home" ? (
        <HomeScreen
          homeContent={homeContent}
          isHost={isHost}
          me={me}
          accounts={accounts}
          schedule={schedule}
          onEdit={() => setHomeEditOpen(true)}
          onGoSchedule={() => setActiveTab("schedule")}
          onGoBoard={() => setActiveTab("board")}
          onRSVP={handleRSVP}
        />
      ) : activeTab === "schedule" ? (
        <>
          <DateTabs days={schedule} selectedDate={selectedDate} onSelect={setSelectedDate} />
          {isHost && (
            <div className="px-4 pb-1 flex justify-end">
              <button
                onClick={handleToggleDayClosed}
                className={`text-[11px] font-medium rounded-full px-2.5 py-1 ${currentDay.closed ? "bg-slate-100 text-slate-400" : "bg-rose-50 text-rose-500"}`}
              >
                {currentDay.closed ? "마감 해제하기" : "이 날짜 일정 마감하기"}
              </button>
            </div>
          )}
          {currentDay.closed && (
            <div className="mx-4 mb-2 rounded-xl bg-slate-100 text-slate-400 text-[11.5px] text-center py-2">이 날은 일정이 마감됐어요</div>
          )}
          <div className="flex-1 pb-24">
            <DayTimeline
              events={computeDayTimeline(currentDay)}
              isHost={isHost}
              me={me}
              onOpenEvent={setDetailEvent}
              onPlanEmpty={handlePlanEmpty}
              onProposeEmpty={(event) => setEmptySheetEvent(event)}
              onToggleLike={handleToggleLike}
              onAddProposal={handleAddProposal}
              onEditProposal={handleEditProposal}
              onDeleteProposal={handleDeleteProposal}
            />
          </div>
          {!currentDay.closed && <RoundFab role={me.role} icon={Plus} label="연회에 의견 더하기" onClick={() => setGeneralSheetOpen(true)} />}
        </>
      ) : (
        <>
          <div className="flex-1">
            <BoardScreen posts={posts} accounts={accounts} onOpenPost={setDetailPost} />
          </div>
          <RoundFab role={me.role} icon={Pencil} label="새 담화 남기기" onClick={() => setNewPostOpen(true)} />
        </>
      )}

      {activeTab !== "home" && <BottomTabBar active={activeTab} onChange={setActiveTab} role={me.role} />}

      {toast && <div className="fixed sm:absolute left-1/2 -translate-x-1/2 bottom-20 z-50 bg-slate-800 text-white text-[12.5px] font-medium px-4 py-2.5 rounded-full shadow-lg whitespace-nowrap">{toast}</div>}

      <EventDetailSheet event={detailEvent} isHost={isHost} accounts={accounts} open={!!detailEvent} onClose={() => setDetailEvent(null)} onEdit={openEditEvent} />
      <EventFormSheet open={!!eventForm} onClose={() => setEventForm(null)} mode={eventForm?.mode} initial={eventForm?.initial} onSubmit={handleSubmitEventForm} onDelete={handleDeleteEvent} />
      <ProposeSheet open={!!emptySheetEvent} onClose={() => setEmptySheetEvent(null)} event={emptySheetEvent} onSubmit={(data) => handleSubmitProposal(emptySheetEvent, data)} />
      <GeneralProposeSheet
        open={generalSheetOpen}
        onClose={() => setGeneralSheetOpen(false)}
        isHost={isHost}
        availableGaps={computeDayTimeline(currentDay).filter((it) => it.status === "empty")}
        onSubmit={handleGeneralPropose}
      />

      <PostDetailSheet
        post={detailPost}
        isHost={isHost}
        accounts={accounts}
        me={me}
        open={!!detailPost}
        onClose={() => setDetailPost(null)}
        onTogglePin={handleTogglePin}
        onAddComment={handleAddComment}
        onEditComment={handleEditComment}
        onDeleteComment={handleDeleteComment}
        onEditPost={handleEditPost}
        onDeletePost={handleDeletePost}
        showToast={showToast}
      />
      <NewPostSheet open={newPostOpen} onClose={() => setNewPostOpen(false)} isHost={isHost} pinnedCount={pinnedCount} onSubmit={handleNewPost} showToast={showToast} />

      <MySettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        me={me}
        accounts={accounts}
        isHost={isHost}
        onUpdateProfile={handleUpdateProfile}
        onChangeOwnPin={handleChangeOwnPin}
        onResetOtherPin={handleResetOtherPin}
        onRenameOther={handleRenameOther}
        onDeleteOther={handleDeleteOther}
        onOpenHomeEdit={() => setHomeEditOpen(true)}
        personalTheme={personalTheme}
        onChangePersonalTheme={handleChangePersonalTheme}
        onLogout={onLogout}
        showToast={showToast}
      />

      <NotificationsSheet
        open={notificationsOpen}
        onClose={handleCloseNotifications}
        notifications={notifications}
        readSnapshotAt={readSnapshotAt}
        onSelect={handleSelectNotification}
        isHost={isHost}
        onOpenAnnouncementAdmin={() => {
          setNotificationsOpen(false);
          setAnnouncementAdminOpen(true);
        }}
        onDelete={handleDeleteNotification}
      />
      <AnnouncementAdminSheet open={announcementAdminOpen} onClose={() => setAnnouncementAdminOpen(false)} onSend={handleSendAnnouncementFull} showToast={showToast} />
      <AnnouncementPopup announcement={activeAnnouncement} onClose={handleDismissAnnouncement} />
      <HomeEditSheet open={homeEditOpen} onClose={() => setHomeEditOpen(false)} homeContent={homeContent} onSave={updateHomeContent} showToast={showToast} />
    </RoleThemeContext.Provider>
  );
}

/* ==================================================================== */
/*  App: 공유 저장소에서 계정 로드 → 로그인/가입 → 메인 화면                 */
/* ==================================================================== */
export default function App() {
  const [accounts, setAccountsState] = useState(SEED_ACCOUNTS);
  const [homeContent, setHomeContentState] = useState({
    title: "지현이네 2박3일",
    message: "함께 즐거운 시간을 보내요",
    background: null,
    font: "gowun",
    textColor: "#FFFFFF",
    accentTheme: "lavenderGold",
    eventStartDate: "2026-09-18",
    eventEndDate: "2026-09-20",
    inviteCode: "",
  });
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [splashStage, setSplashStage] = useState("in"); // in -> hold(보임) -> out(사라지는 중) -> gone
  const [returningUser, setReturningUser] = useState(false); // 저장된 로그인으로 자동으로 들어온 경우
  const frameRef = useRef(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const handleGlobalRefresh = async () => {
    const a = await storageGetJSON("accounts", null);
    if (a) setAccountsState(a);
    const h = await storageGetJSON("homeContent", null);
    if (h) setHomeContentState(h);
    setRefreshTick((t) => t + 1); // 로그인 화면 안(MainScreen)의 일정/게시판도 같이 새로고침하라는 신호예요.
    await new Promise((r) => setTimeout(r, 350)); // 인디케이터가 너무 순식간에 사라지지 않게 살짝 붙잡아둬요.
  };

  const { pullDistance, refreshing: refreshingPull } = usePullToRefresh(frameRef, handleGlobalRefresh);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setSplashStage("hold"));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (splashStage !== "hold" || !ready) return;
    // 데이터가 다 준비된 뒤에도 최소한 이만큼은 화면에 붙잡아둬요 (너무 빨리 스쳐가지 않게).
    // 이미 로그인 저장돼서 자동으로 들어온 경우엔 짧게, 처음 들어오는 경우엔 좀 더 길게 보여줘요.
    const t = setTimeout(() => setSplashStage("out"), returningUser ? 700 : 2100);
    return () => clearTimeout(t);
  }, [splashStage, ready, returningUser]);

  useEffect(() => {
    if (splashStage !== "out") return;
    const t = setTimeout(() => setSplashStage("gone"), 1200); // 아래 transition-duration과 맞춰요.
    return () => clearTimeout(t);
  }, [splashStage]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loadedAccounts = await storageGetJSON("accounts", null);
      const loadedHome = await storageGetJSON("homeContent", null);
      const loadedSessionId = await (async () => {
        try {
          const res = await window.storage.get("current_session", false);
          return res ? res.value : null;
        } catch {
          return null;
        }
      })();
      if (cancelled) return;
      let finalAccounts = loadedAccounts;
      if (loadedAccounts) setAccountsState(loadedAccounts);
      else {
        const hashedSeed = await Promise.all(SEED_ACCOUNTS.map(async (a) => ({ ...a, pin: await hashPin(a.pin) })));
        if (cancelled) return;
        finalAccounts = hashedSeed;
        setAccountsState(hashedSeed);
        storageSetJSON("accounts", hashedSeed);
      }
      if (loadedHome) setHomeContentState(loadedHome);
      // 저장해둔 로그인이 있고, 그 계정이 여전히 존재하면 다시 로그인 화면 없이 이어서 들어가요.
      if (loadedSessionId && finalAccounts?.some((a) => a.id === loadedSessionId)) {
        setSession({ accountId: loadedSessionId });
        setReturningUser(true);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasStorage || !ready) return;
    const t = setInterval(async () => {
      const a = await storageGetJSON("accounts", null);
      if (a) setAccountsState((prev) => (JSON.stringify(prev) === JSON.stringify(a) ? prev : a));
      const h = await storageGetJSON("homeContent", null);
      if (h) setHomeContentState((prev) => (JSON.stringify(prev) === JSON.stringify(h) ? prev : h));
    }, 8000);
    return () => clearInterval(t);
  }, [ready]);

  const updateAccounts = (updater) => {
    (async () => {
      // 로컬에 갖고있던 값은 최대 8초 정도 오래됐을 수 있어서, 쓰기 직전에 항상 최신 걸 다시 가져와요.
      // (안 그러면 거의 동시에 여러 명이 가입/수정할 때 서로 덮어써버리는 사고가 나요.)
      const latest = (await storageGetJSON("accounts", null)) ?? accounts;
      const next = typeof updater === "function" ? updater(latest) : updater;
      await storageSetJSON("accounts", next);
      setAccountsState(next);
    })();
  };

  const updateHomeContent = (updater) => {
    (async () => {
      const latest = (await storageGetJSON("homeContent", null)) ?? homeContent;
      const next = typeof updater === "function" ? updater(latest) : updater;
      await storageSetJSON("homeContent", next);
      setHomeContentState(next);
    })();
  };

  const [sealIntro, setSealIntro] = useState(false);

  const handleAuthenticated = (payload) => {
    let id;
    if (payload.isNew) {
      id = `u-${Date.now()}`;
      updateAccounts((prev) => [...prev, { id, name: payload.name, role: payload.role, pin: payload.pin, color: null, emoji: null, photo: null, rsvp: null }]);
    } else {
      id = payload.id;
    }
    setSession({ accountId: id });
    if (hasStorage) window.storage.set("current_session", id, false).catch(() => {});
    setSealIntro(true);
    setTimeout(() => setSealIntro(false), 1450);
  };

  const handleLogout = () => {
    setSession(null);
    if (hasStorage) window.storage.delete("current_session", false).catch(() => {});
  };

  return (
    <div className="w-full h-screen bg-slate-100 flex items-center justify-center sm:p-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nanum+Myeongjo&family=Gowun+Dodum&family=Jua&family=Gaegu&family=Dongle&family=Hi+Melody&family=Gamja+Flower&display=swap');
        @keyframes sealPop {
          0% { transform: scale(0.55) rotate(-10deg); opacity: 0; }
          35% { transform: scale(1.08) rotate(3deg); opacity: 1; }
          55% { transform: scale(1) rotate(0deg); opacity: 1; }
          100% { transform: scale(1.35) rotate(6deg); opacity: 0; }
        }
        @keyframes sealCaption {
          0% { opacity: 0; transform: translateY(6px); }
          30% { opacity: 1; transform: translateY(0); }
          75% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes canaryFly {
          0% { transform: translateX(-160px) translateY(-30px) rotate(-25deg) scale(0.5); opacity: 0; }
          65% { transform: translateX(8px) translateY(4px) rotate(8deg) scale(1.08); opacity: 1; }
          100% { transform: translateX(0) translateY(0) rotate(0deg) scale(1); opacity: 1; }
        }
      `}</style>
      <RoleThemeContext.Provider value={resolveRoleStyle(homeContent.accentTheme)}>
        <div
          ref={frameRef}
          id="app-scroll-frame"
          className="relative w-full h-full sm:w-[390px] sm:h-[844px] sm:rounded-[2.5rem] sm:border-[6px] sm:border-slate-900 bg-white overflow-y-auto flex flex-col overscroll-y-contain"
          style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Segoe UI', sans-serif" }}
        >
          {(pullDistance > 0 || refreshingPull) && (
            <div
              className="absolute left-0 right-0 top-0 flex justify-center items-center z-[90] pointer-events-none"
              style={{ height: refreshingPull ? 44 : pullDistance, transition: refreshingPull ? "height 0.2s" : "none" }}
            >
              <RefreshCw size={18} className={`text-violet-400 ${refreshingPull ? "animate-spin" : ""}`} style={!refreshingPull ? { transform: `rotate(${pullDistance * 4}deg)`, opacity: Math.min(pullDistance / 50, 1) } : {}} />
            </div>
          )}
          {ready &&
            (session ? (
              <MainScreen
                session={session}
                accounts={accounts}
                updateAccounts={updateAccounts}
                homeContent={homeContent}
                updateHomeContent={updateHomeContent}
                onSessionInvalid={handleLogout}
                onLogout={handleLogout}
                refreshSignal={refreshTick}
              />
            ) : (
              <StartScreen accounts={accounts} onAuthenticated={handleAuthenticated} meetupTitle={homeContent.title} inviteCode={homeContent.inviteCode} />
            ))}

          {splashStage !== "gone" && (
            <div className="fixed sm:absolute inset-0 z-[80]" style={{ backgroundColor: "#FCF6F0" }}>
              <div
                className={`absolute inset-0 transition-opacity duration-[1200ms] ease-in-out ${splashStage === "hold" ? "opacity-100" : "opacity-0"}`}
                style={{ backgroundImage: "url(/splash.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}
              />
            </div>
          )}

          {sealIntro && (
            <div className="fixed sm:absolute inset-0 z-[60] flex flex-col items-center justify-center bg-slate-900/70 pointer-events-none">
              <div
                className="h-24 w-24 rounded-full flex items-center justify-center text-[36px] shadow-2xl"
                style={{ background: "radial-gradient(circle at 35% 30%, #B8467A, #6B1E3A)", border: "3px solid #E8C874", animation: "sealPop 1.4s ease-in forwards" }}
              >
                ⚜️
              </div>
              <p className="text-white text-[13px] mt-5" style={{ animation: "sealCaption 1.4s ease-in-out forwards" }}>
                초대장의 봉인을 엽니다
              </p>
            </div>
          )}
        </div>
      </RoleThemeContext.Provider>
    </div>
  );
}
