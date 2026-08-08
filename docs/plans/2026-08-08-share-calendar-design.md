# Share Calendar 설계 문서

날짜: 2026-08-08
상태: 승인됨 (브레인스토밍 세션에서 섹션별 검증 완료)

## 개요

가족/친구 그룹끼리 공유하는 달력 웹앱. 날짜 단위로 "그 날 뭘 할지" 계획 항목을
작성하고, 양력/음력 날짜와 반복 일정을 지원한다. 운영 비용 0원이 목표.

## 확정된 결정사항

| 항목 | 결정 | 비고 |
|------|------|------|
| 프론트 | Vite + React 19 + TS (현재 템플릿) | React Compiler 활성화 상태 |
| 백엔드 | Supabase 무료 티어 | 기간제 유료 전환 없음. 7일 무활동 시 일시정지만 주의 |
| 배포 | Vercel 무료 | GitHub push 자동 배포 |
| 로그인 | 카카오 OAuth (Supabase Auth) | 카카오 개발자 앱 등록 필요(무료) |
| 반복 | 음력 매년, 양력 매년/매월 | 음력 매월은 범위 제외 |
| 그룹 | 사용자당 여러 그룹, 그룹별 달력 전환 | 겹쳐보기는 추후 확장 |
| 일정 형태 | 날짜 단위, 하루에 여러 항목 | 시간 지정 없음. 제목 + 메모(선택) + 작성자 표시 |
| 스타일 | plain CSS (템플릿 유지) | Tailwind는 필요 시 추가 |

## 아키텍처

```
[브라우저] Vite + React SPA
  ├─ 달력 UI 직접 구현 (CSS Grid 42칸, date-fns)
  ├─ 음력 변환: korean-lunar-calendar (KASI 데이터, 1000~2050년)
  └─ supabase-js → Supabase에 직접 접근 (별도 백엔드 서버 없음)

[Supabase 무료]  Auth(카카오) + Postgres + RLS
[Vercel 무료]    프론트 호스팅
[GitHub Actions] 3일마다 ping → 무활동 일시정지 방지
```

- 서버 코드는 그룹 가입 검증용 DB 함수(`join_group_by_code`) 하나뿐.
- 실시간 동기화 없음. 새로고침/재방문 시 최신 데이터 로드. 필요해지면 Supabase Realtime 추가.

## 데이터 모델

```
profiles       id (= auth.uid PK), name, avatar_url          -- 카카오 프로필 자동 저장
groups         id PK, name, invite_code UNIQUE, created_by, created_at
group_members  (group_id, user_id) PK, role ('owner'|'member'), joined_at
entries        id PK, group_id FK, author_id FK,
               title, memo NULL,
               date_type ('solar'|'lunar'),
               repeat ('none'|'yearly'|'monthly'),
               event_date DATE,                               -- 양력 기준일
               lunar_month INT NULL, lunar_day INT NULL,
               is_leap_month BOOL NULL,                       -- 음력 입력값 원본
               created_at
```

### 달력 렌더링 로직

선택된 그룹의 entries 전체 로드(가족 규모 = 수백 행, 페이지네이션 불필요) 후
보이는 달에 대해:

1. 일회성 양력 → `event_date` 그대로
2. 양력 매년 → `event_date`의 월·일 일치하는 날
3. 양력 매월 → `event_date`의 일(day) 일치하는 날
4. 음력 매년 → 해당 연도의 음력 (lunar_month, lunar_day)을 양력으로 변환해 표시.
   칸에 "음 3.15" 라벨 표기

### 음력/날짜 엣지 케이스 (관례 기준)

- 윤달 입력 → 반복은 평달 기준으로 계산 (`is_leap_month`는 원본 기록용)
- 그 해 음력 30일이 없는 달 → 29일로 표시
- 양력 매월 31일 → 짧은 달은 말일로

### 권한 (RLS)

- groups / entries 조회: 해당 그룹 멤버만
- entries 작성: 그룹 멤버 누구나. 수정·삭제: 작성자 본인만
- 그룹 생성: 로그인 유저 누구나 (생성자가 owner)
- 그룹 가입: 초대 링크(`/join/:code`) → `join_group_by_code(code)` SECURITY DEFINER
  함수가 코드 검증 후 group_members에 추가

## 화면 구성 (총 4개, 모바일 우선 반응형)

1. **로그인**: 카카오 버튼 하나. 성공 시 profiles upsert
2. **메인 달력 (월 뷰)**: 그룹 전환 드롭다운 + 월 네비게이션 + 오늘 버튼.
   각 칸에 양력 숫자 + 작은 음력 날짜. 항목은 데스크톱=제목 미리보기, 모바일=색 점
3. **날짜 상세**: 모바일=바텀시트, 데스크톱=사이드 패널.
   항목 리스트(제목·작성자·음력 뱃지) + 추가 폼(제목, 메모, 양력/음력 토글,
   반복 옵션 — 음력이면 '매년'만 노출)
4. **그룹 관리**: 그룹 생성, 초대 링크 복사, 멤버 목록, `/join/:code` 수락 페이지

라우트: `/login`, `/` (달력), `/join/:code`, `/groups`

## 추가 의존성 (4개)

`@supabase/supabase-js`, `korean-lunar-calendar`, `date-fns`, `react-router-dom`

## 배포/운영 체크리스트

- [ ] GitHub 레포 생성, push
- [ ] Supabase 프로젝트 생성 (무료), 스키마 + RLS 적용
- [ ] 카카오 개발자 앱 등록 → Supabase Auth에 카카오 프로바이더 + Redirect URI 설정
- [ ] Vercel 연결, 환경변수 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 설정, SPA rewrite
- [ ] `.github/workflows/keep-alive.yml` — 3일마다 REST ping (일시정지 방지)

## 테스트

- vitest 유닛 테스트: 반복 일정 → 표시 날짜 계산 (음력 변환, 윤달, 30일 없는 달,
  말일 처리)에 집중
- UI는 수동 확인

## 에러 처리

- Supabase 요청 실패 시 토스트 알림
- 프로젝트 일시정지 감지 시(연결 불가) 안내 문구

## 범위 제외 (YAGNI)

- 음력 매월 반복, 시간 단위 이벤트, 그룹 캘린더 겹쳐보기, 실시간 동기화,
  푸시 알림, 일정 댓글/좋아요 — 필요해지면 그때 추가
