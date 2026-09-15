# 우리 달력 — 모바일 (Expo SDK 57 / RN 0.86)

웹(`../src`)과 같은 Supabase 프로젝트를 보는 iOS·안드로이드 앱.

## 웹과 나눠 쓰는 것

`../src/lib`에서 플랫폼을 안 타는 파일을 그대로 import한다. 사본이 아니라 같은 파일이라
음력·반복 계산 버그를 한 번만 고치면 양쪽이 함께 낫는다. 테스트도 웹 쪽 `pnpm test` 하나로 덮인다.

| | 파일 | |
|---|---|---|
| 공유 | `types` `calendar` `lunar` `recurrence` `icons` `errors` `api` `useEntries` | 그대로 씀 |
| 앱 전용 | `lib/supabase` `lib/useAuth` `lib/useGroups` | 세션 저장소·OAuth 복귀 방식·로컬 저장소가 웹과 다름 |
| 다시 만듦 | `app/` `components/` | `div`·CSS는 RN에서 못 씀. 색·간격은 `lib/theme.ts`가 웹 CSS 변수를 그대로 옮겨온 값 |

`api.ts`는 supabase 클라이언트를 `@db`라는 이름으로 받는다. 웹은 `vite.config.ts`,
앱은 `metro.config.js`에서 각자의 클라이언트를 그 이름에 연결한다.

## 시작하기

```bash
cd mobile
pnpm install
cp .env.example .env.local   # 값은 웹의 .env.local과 같은 프로젝트 것
pnpm start
```

`pnpm typecheck`으로 앱과 공유 코드를 함께 검사한다.

## 로그인이 되려면

카카오 로그인은 시스템 인증 브라우저를 띄웠다가 `sharecalendar://auth-callback`으로 돌아온다.
그 주소가 Supabase Dashboard > Authentication > URL Configuration > **Redirect URLs**에
등록돼 있어야 한다. Expo Go로 개발할 때는 `exp://...` 주소도 함께 필요하다
(`pnpm dlx uri-scheme list` 또는 `pnpm start` 로그에서 확인).

## 아직 안 한 것

- **푸시 알림** — 내일이 제사·생신이라고 알려주는 기능. 앱을 따로 만드는 가장 큰 이유인데
  Supabase Edge Function(스케줄) + `expo-notifications`가 필요해 별도 작업으로 남겼다.
- **Pretendard 폰트** — 웹은 CDN에서 받지만 앱은 폰트 파일을 번들에 넣어야 한다.
  지금은 시스템 한글 폰트(iOS Apple SD Gothic Neo / 안드로이드 Noto Sans KR)를 쓴다.
- **유니버설 링크** — 초대 링크(`EXPO_PUBLIC_SITE_URL`)는 웹으로 열린다. 앱이 깔린 사람에게
  앱으로 열어주려면 도메인에 `apple-app-site-association`·`assetlinks.json`을 올려야 한다.
- **진입 애니메이션** — 웹의 `.rise`(아래에서 떠오르며 블러 걷힘). 첫 화면 체감에만 영향.
