# 지현이네 2박3일 — 연회 일정 앱 (PWA)

Claude 아티팩트 미리보기를 실제로 설치 가능한 웹앱(PWA)으로 옮긴 프로젝트예요.

## 지금 이 버전에서 달라진 점 (꼭 읽어주세요)

Claude 아티팩트 안에서는 "같은 링크를 여는 모두가 자동으로 데이터를 공유"하는
`window.storage`라는 특수 기능이 있었어요. 이 프로젝트는 그게 없는 **일반 웹 환경**이라,
`src/storageShim.js`가 그 자리를 **localStorage**(이 기기 안에서만 저장되는 브라우저 기능)로
대신 채워뒀어요. 그 결과:

- ✅ 새로고침해도 데이터 안 사라짐, 앱은 정상적으로 다 동작함
- ❌ **내 폰이랑 친구 폰이 서로 동기화되지 않아요** (기기마다 따로 저장돼요)
- ❌ "안주인의 전갈" 진짜 푸시 알림은 아직 안 울려요 (서버가 없어서)

**여러 명이 실제로 같이 쓰려면 다음 단계(실제 백엔드 연결)가 필요해요.** 아래 "다음 단계"
참고해주세요. 지금 이 상태로도 배포해서 각자 설치해보고 화면/기능을 확인하는 용도로는 충분해요.

## 시작하기

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 열면 확인할 수 있어요.

## 배포하기 (실제 주소로 올리기)

1. [Vercel](https://vercel.com) 또는 [Netlify](https://netlify.com)에 무료 계정 만들기 (이메일 또는 깃허브로 가입, 구글 계정 필수 아님)
2. 이 프로젝트 폴더를 GitHub 저장소로 올리기 (또는 Vercel/Netlify의 "폴더 직접 업로드" 기능 사용)
3. 배포하면 `https://내앱이름.vercel.app` 같은 주소가 생겨요
4. 그 주소를 폰 브라우저로 열고 "홈 화면에 추가" 하면 진짜 앱처럼 설치돼요

## 다음 단계: 여러 기기 동기화 + 진짜 푸시 알림

두 가지가 다 이 작업 하나로 해결돼요 — **Firebase** 무료 플랜을 쓰는 걸 추천해요.

1. [Firebase 콘솔](https://console.firebase.google.com)에서 새 프로젝트 만들기 (구글 계정 필요, 무료)
2. **Firestore Database** 켜기 → 여기가 `window.storage`를 대신할 실제 공유 저장소가 돼요
3. **Cloud Messaging** 켜기 → 프로젝트 설정 > 클라우드 메시징에서 "웹 푸시 인증서" 키 발급
4. 발급받은 공개 키를 `src/push.js` 안 `VAPID_PUBLIC_KEY`에 붙여넣기
5. `src/storageShim.js`의 localStorage 코드를 Firestore 호출로 교체 (제가 도와드릴 수 있어요)
6. 알림을 실제로 "보내는" 역할을 할 Cloud Functions 코드 추가 (역시 도와드릴 수 있어요)

이 5개 항목은 Firebase 프로젝트를 직접 만드신 뒤, 발급받은 설정 값들을 저한테 알려주시면
그다음 코드 작업은 제가 이어서 해드릴게요.

## 폴더 구조

```
src/
  App.jsx          - 앱 전체 화면 (기존 아티팩트 코드 그대로)
  storageShim.js   - window.storage를 localStorage로 흉내내는 임시 다리
  push.js          - 푸시 구독 준비 코드 (Firebase 연결 후 사용)
  sw.js            - 커스텀 서비스워커 (푸시 수신 담당)
  main.jsx         - 진입점
public/icons/      - 앱 아이콘
```
