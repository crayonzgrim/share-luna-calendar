# Share Calendar 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 가족/친구 그룹이 공유하는 달력 웹앱을 만든다. 날짜별로 계획 항목을 여러 개 적을 수 있고, 양력/음력 반복 일정을 자동 계산해 표시하며, 운영 비용은 0원이다.

**Architecture:** 백엔드 서버 없이 브라우저의 supabase-js가 Supabase Postgres에 직접 접근하고, 접근 권한은 RLS(Row Level Security)가 DB 레벨에서 강제한다. 음력 변환은 클라이언트에서 `korean-lunar-calendar`(KASI 데이터)로 계산하므로, 반복 일정은 DB에 "음력 3월 15일 매년"으로만 저장하고 표시 시점에 그 해의 양력 날짜로 전개한다.

**Tech Stack:** Vite 8 + React 19(React Compiler 활성) + TypeScript 6, Supabase(Auth/Postgres/RLS), `korean-lunar-calendar`, `react-router-dom`, vitest, 배포는 Vercel + GitHub Actions cron.

**설계 문서:** `docs/plans/2026-08-08-share-calendar-design.md`

---

## 설계 문서 대비 변경점 (실행 전 확인)

- **`date-fns` 제외.** 실제로 필요한 건 "월 그리드 만들기 / 같은 날 비교 / 말일 구하기" 세 가지뿐이고 모두 네이티브 `Date`로 3줄이면 된다. 의존성은 3개(`@supabase/supabase-js`, `korean-lunar-calendar`, `react-router-dom`)로 줄인다. 나중에 날짜 포맷이 복잡해지면 그때 추가.
- `korean-lunar-calendar@0.4.0`은 자체 타입(`dist/index.d.ts`)을 포함하므로 `@types/*` 불필요.

## 이 코드베이스에서 걸려 넘어지기 쉬운 것들

이 프로젝트의 `tsconfig.app.json`은 엄격한 설정이 켜져 있다. 아래를 어기면 `pnpm build`가 깨진다.

- `verbatimModuleSyntax: true` → 타입만 가져올 땐 반드시 `import type { Foo } from './foo'`
- `erasableSyntaxOnly: true` → enum, 파라미터 프로퍼티(`constructor(private x)`) 사용 금지. union 타입과 `const` 객체를 쓸 것
- `noUnusedLocals` / `noUnusedParameters: true` → 안 쓰는 변수/인자 남기면 에러
- 로컬 파일 import는 확장자를 붙인다 (`import App from './App.tsx'` — `main.tsx`의 기존 컨벤션)
- 패키지 매니저는 **pnpm** (`pnpm-lock.yaml` 존재). `npm install` 쓰지 말 것

## 사전 준비 (사람이 직접, 브라우저에서)

이 계획의 Task 6부터는 실제 Supabase 프로젝트가 필요하다. Task 1~5는 없어도 진행 가능하니, 먼저 코딩을 시작하고 병행해도 된다.

1. **Supabase 프로젝트 생성** — https://supabase.com 무료 가입 → New Project → 리전은 `Northeast Asia (Seoul)` → DB 비밀번호 저장.

   생성 화면의 Security 항목은 아래대로 맞춘다:

   | 옵션 | 설정 | 이유 |
   |------|------|------|
   | Enable Data API | ✅ 켬 | supabase-js가 PostgREST로 붙는 구조라 끄면 앱이 동작하지 않는다 |
   | Automatically expose new tables | ⬜ **끔** | 나중에 추가하는 테이블이 자동으로 API에 열리지 않게 한다. Task 6의 GRANT가 필요한 테이블만 명시적으로 연다 |
   | Enable automatic RLS | ✅ 켬 | 새 테이블에 RLS를 자동으로 켜주는 안전망. 비용 없음 |

   생성 후 Settings → API에서 `Project URL`과 `anon public` 키를 복사해둔다.
2. **카카오 개발자 앱 등록** — https://developers.kakao.com → 애플리케이션 추가(무료) → 앱 키의 `REST API 키` 복사 → 제품 설정 → 카카오 로그인 → 활성화 ON → Redirect URI에 `https://<프로젝트ref>.supabase.co/auth/v1/callback` 등록 → 보안 탭에서 `Client Secret` 생성 후 복사 → 동의항목에서 `닉네임`, `프로필 사진` 필수 동의로 설정.
3. **Supabase에 카카오 연결** — Supabase Dashboard → Authentication → Providers → Kakao → 활성화 후 REST API 키를 `Client ID`, Client Secret을 `Client Secret`에 붙여넣기.

---

# Phase A — 준비

## Task 1: 의존성 설치와 vitest 세팅

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/lib/smoke.test.ts` (세팅 확인용, Task 3에서 삭제)

**Step 1: 런타임 의존성 설치**

```bash
pnpm add @supabase/supabase-js korean-lunar-calendar react-router-dom
```

**Step 2: 테스트 도구 설치**

```bash
pnpm add -D vitest
```

**Step 3: vite.config.ts에 vitest 설정 추가**

`vite.config.ts` 전체를 아래로 교체한다. 순수 로직만 테스트하므로 `environment: 'node'`면 충분하다 (jsdom 불필요).

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

**Step 4: package.json에 test 스크립트 추가**

`"scripts"` 안에 아래 두 줄을 추가한다.

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

**Step 5: 세팅이 실제로 도는지 확인하는 스모크 테스트**

`src/lib/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('vitest 세팅', () => {
  it('테스트가 실행된다', () => {
    expect(1 + 1).toBe(2)
  })
})
```

**Step 6: 실행**

Run: `pnpm test`
Expected: PASS — `1 passed (1)`

**Step 7: 커밋**

```bash
git add package.json pnpm-lock.yaml vite.config.ts src/lib/smoke.test.ts
git commit -m "chore: add supabase, lunar calendar, router deps and vitest setup"
```

---

## Task 2: 템플릿 보일러플레이트 제거

Vite 시작 템플릿의 데모 화면과 에셋을 걷어내고 빈 앱 껍데기만 남긴다.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `index.html`
- Delete: `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg`

**Step 1: App.tsx를 빈 껍데기로 교체**

```tsx
import './App.css'

function App() {
  return <div className="app">달력</div>
}

export default App
```

**Step 2: App.css 비우기**

`src/App.css` 전체를 아래로 교체한다.

```css
.app {
  max-width: 900px;
  margin: 0 auto;
  padding: 1rem;
}
```

**Step 3: 템플릿 에셋 삭제**

```bash
git rm src/assets/hero.png src/assets/react.svg src/assets/vite.svg
```

**Step 4: index.html의 title 변경**

`index.html`에서 `<title>` 요소의 내용을 `우리 달력`으로 바꾸고, `<link rel="icon" ...>`이 `/favicon.svg`를 가리키는지 확인한다.

**Step 5: 빌드가 깨지지 않는지 확인**

Run: `pnpm build`
Expected: 성공. `dist/` 생성. 에셋 참조 에러가 없어야 한다.

**Step 6: 커밋**

```bash
git add -A
git commit -m "chore: strip Vite starter template boilerplate"
```

---

# Phase B — 순수 로직 (TDD 핵심)

> 이 Phase가 이 프로젝트에서 버그가 날 수 있는 거의 전부다. 음력 변환, 반복 전개, 말일 처리는 눈으로 검증하기 어려우니 반드시 테스트를 먼저 쓴다.
> 아래 테스트의 기대값은 전부 `korean-lunar-calendar@0.4.0`을 실제로 돌려서 얻은 실측값이다. 임의로 바꾸지 말 것.
> **주의:** JS `Date`의 month는 0-based다. `new Date(2026, 1, 17)`은 2026년 **2월** 17일이다.

## Task 3: 음력 ↔ 양력 변환 유틸

**Files:**
- Create: `src/lib/lunar.ts`
- Create: `src/lib/lunar.test.ts`
- Delete: `src/lib/smoke.test.ts`

**Step 1: 실패하는 테스트 작성**

`src/lib/lunar.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { lunarToSolar, lunarToSolarClamped, solarToLunar } from './lunar'

describe('lunarToSolar', () => {
  it('설날(음력 1/1)을 그 해의 양력 날짜로 변환한다', () => {
    expect(lunarToSolar(2026, 1, 1)).toEqual(new Date(2026, 1, 17)) // 2026-02-17
    expect(lunarToSolar(2027, 1, 1)).toEqual(new Date(2027, 1, 7))  // 2027-02-07
    expect(lunarToSolar(2028, 1, 1)).toEqual(new Date(2028, 0, 27)) // 2028-01-27 (1월로 당겨짐)
  })

  it('음력 12월 일정은 다음 양력 해로 넘어간다', () => {
    expect(lunarToSolar(2026, 12, 15)).toEqual(new Date(2027, 0, 22)) // 2027-01-22
  })

  it('윤달은 평달과 다른 날짜로 변환된다', () => {
    expect(lunarToSolar(2025, 6, 10, false)).toEqual(new Date(2025, 6, 4)) // 2025-07-04
    expect(lunarToSolar(2025, 6, 10, true)).toEqual(new Date(2025, 7, 3))  // 2025-08-03 (윤6월)
  })

  it('그 해에 없는 윤달을 요청하면 null', () => {
    expect(lunarToSolar(2026, 6, 10, true)).toBeNull() // 2026년엔 윤6월이 없다
  })

  it('지원 범위(~2050) 밖이면 null', () => {
    expect(lunarToSolar(2051, 1, 1)).toBeNull()
  })
})

describe('lunarToSolarClamped', () => {
  it('30일이 없는 달은 29일로 내려서 변환한다', () => {
    expect(lunarToSolar(2026, 2, 30)).toBeNull() // 전제: 2026년 음력 2월엔 30일이 없다
    expect(lunarToSolarClamped(2026, 2, 30)).toEqual(new Date(2026, 3, 16)) // 음 2/29 = 2026-04-16
  })

  it('30일이 있는 달은 그대로 30일로 변환한다', () => {
    expect(lunarToSolarClamped(2026, 1, 30)).toEqual(new Date(2026, 2, 18)) // 2026-03-18
  })

  it('윤달 여부와 무관하게 평달 기준으로 계산한다', () => {
    // 설계 결정: 반복 일정은 항상 평달 기준
    expect(lunarToSolarClamped(2025, 6, 10)).toEqual(new Date(2025, 6, 4)) // 평6월
  })
})

describe('solarToLunar', () => {
  it('양력 날짜의 음력을 돌려준다', () => {
    expect(solarToLunar(new Date(2026, 1, 17))).toEqual({
      year: 2026, month: 1, day: 1, isLeap: false,
    })
  })

  it('연초 양력은 전년도 음력에 속한다', () => {
    expect(solarToLunar(new Date(2026, 0, 1))).toEqual({
      year: 2025, month: 11, day: 13, isLeap: false,
    })
  })
})
```

**Step 2: 테스트를 돌려 실패를 확인**

Run: `pnpm test src/lib/lunar.test.ts`
Expected: FAIL — `Failed to resolve import "./lunar"`

**Step 3: 최소 구현 작성**

`src/lib/lunar.ts`:

```ts
import KoreanLunarCalendar from 'korean-lunar-calendar'

export type LunarDate = { year: number; month: number; day: number; isLeap: boolean }

/**
 * 음력 → 양력. 범위 밖이거나 그 달에 없는 날짜면 null.
 * 라이브러리 지원 범위는 음력 1000-01-01 ~ 2050-11-18.
 */
export function lunarToSolar(
  year: number,
  month: number,
  day: number,
  isLeap = false,
): Date | null {
  const cal = new KoreanLunarCalendar()
  if (!cal.setLunarDate(year, month, day, isLeap)) return null
  const s = cal.getSolarCalendar()
  return new Date(s.year, s.month - 1, s.day)
}

/**
 * 반복 일정용 음력 → 양력.
 * 윤달은 항상 평달로 계산하고(설계 결정), 그 해에 30일이 없으면 29일로 내린다.
 * 음력 달은 29일 아니면 30일이라 29일은 항상 존재한다.
 */
export function lunarToSolarClamped(year: number, month: number, day: number): Date | null {
  return lunarToSolar(year, month, day) ?? (day === 30 ? lunarToSolar(year, month, 29) : null)
}

/** 양력 → 음력. 달력 칸에 "음 3.15" 라벨을 붙이는 용도. */
export function solarToLunar(date: Date): LunarDate | null {
  const cal = new KoreanLunarCalendar()
  if (!cal.setSolarDate(date.getFullYear(), date.getMonth() + 1, date.getDate())) return null
  const l = cal.getLunarCalendar()
  // 라이브러리 타입상 intercalation은 optional이다. 없으면 평달을 뜻한다.
  return { year: l.year, month: l.month, day: l.day, isLeap: l.intercalation ?? false }
}
```

**Step 4: 테스트 통과 확인**

Run: `pnpm test src/lib/lunar.test.ts`
Expected: PASS — 9 passed

실패한다면 라이브러리 버전을 확인한다: `pnpm list korean-lunar-calendar` → `0.4.0`이어야 한다.

**Step 5: 스모크 테스트 삭제**

```bash
git rm src/lib/smoke.test.ts
```

**Step 6: 커밋**

```bash
git add src/lib/lunar.ts src/lib/lunar.test.ts
git commit -m "feat: add lunar/solar conversion with leap-month and 30th-day handling"
```

---

## Task 4: 반복 일정 전개

**Files:**
- Create: `src/lib/recurrence.ts`
- Create: `src/lib/recurrence.test.ts`

**Step 1: 실패하는 테스트 작성**

`src/lib/recurrence.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { occurrencesInMonth, parseISODate, lastDayOfMonth } from './recurrence'
import type { EntryLike } from './recurrence'

const entry = (over: Partial<EntryLike>): EntryLike => ({
  date_type: 'solar',
  repeat: 'none',
  event_date: '2026-08-15',
  lunar_month: null,
  lunar_day: null,
  ...over,
})

describe('parseISODate', () => {
  it('타임존에 밀리지 않고 로컬 날짜로 파싱한다', () => {
    expect(parseISODate('2026-08-15')).toEqual(new Date(2026, 7, 15))
  })
})

describe('lastDayOfMonth', () => {
  it('그 달의 마지막 날을 준다', () => {
    expect(lastDayOfMonth(2026, 2)).toBe(28)
    expect(lastDayOfMonth(2024, 2)).toBe(29) // 윤년
    expect(lastDayOfMonth(2026, 8)).toBe(31)
  })
})

describe('occurrencesInMonth — 양력', () => {
  it('일회성은 해당 연월에만 나타난다', () => {
    const e = entry({})
    expect(occurrencesInMonth(e, 2026, 8)).toEqual([new Date(2026, 7, 15)])
    expect(occurrencesInMonth(e, 2026, 9)).toEqual([])
    expect(occurrencesInMonth(e, 2027, 8)).toEqual([])
  })

  it('매년은 해마다 같은 월/일에 나타난다', () => {
    const e = entry({ repeat: 'yearly' })
    expect(occurrencesInMonth(e, 2027, 8)).toEqual([new Date(2027, 7, 15)])
    expect(occurrencesInMonth(e, 2027, 9)).toEqual([])
  })

  it('매월은 모든 달에 나타난다', () => {
    const e = entry({ repeat: 'monthly', event_date: '2026-01-10' })
    expect(occurrencesInMonth(e, 2026, 3)).toEqual([new Date(2026, 2, 10)])
    expect(occurrencesInMonth(e, 2027, 11)).toEqual([new Date(2027, 10, 10)])
  })

  it('매월 31일은 짧은 달에서 말일로 내려간다', () => {
    const e = entry({ repeat: 'monthly', event_date: '2026-01-31' })
    expect(occurrencesInMonth(e, 2026, 2)).toEqual([new Date(2026, 1, 28)])
    expect(occurrencesInMonth(e, 2026, 4)).toEqual([new Date(2026, 3, 30)])
    expect(occurrencesInMonth(e, 2026, 5)).toEqual([new Date(2026, 4, 31)])
  })

  it('매년 2월 29일은 평년에 28일로 내려간다', () => {
    const e = entry({ repeat: 'yearly', event_date: '2024-02-29' })
    expect(occurrencesInMonth(e, 2026, 2)).toEqual([new Date(2026, 1, 28)])
  })
})

describe('occurrencesInMonth — 음력 매년', () => {
  // 어머니 생신: 음력 3월 15일
  const birthday = entry({
    date_type: 'lunar',
    repeat: 'yearly',
    event_date: '2026-05-01',
    lunar_month: 3,
    lunar_day: 15,
  })

  it('해마다 다른 양력 날짜로 잡힌다', () => {
    expect(occurrencesInMonth(birthday, 2026, 5)).toEqual([new Date(2026, 4, 1)])  // 2026-05-01
    expect(occurrencesInMonth(birthday, 2027, 4)).toEqual([new Date(2027, 3, 21)]) // 2027-04-21
    expect(occurrencesInMonth(birthday, 2025, 4)).toEqual([new Date(2025, 3, 12)]) // 2025-04-12
  })

  it('해당 월이 아니면 비어 있다', () => {
    expect(occurrencesInMonth(birthday, 2026, 4)).toEqual([])
    expect(occurrencesInMonth(birthday, 2027, 5)).toEqual([])
  })

  it('음력 12월 일정은 다음 양력 해의 1월에 나타난다', () => {
    // 이게 핵심 함정: 음력 해와 양력 해가 어긋난다
    const e = entry({
      date_type: 'lunar', repeat: 'yearly',
      event_date: '2027-01-22', lunar_month: 12, lunar_day: 15,
    })
    expect(occurrencesInMonth(e, 2027, 1)).toEqual([new Date(2027, 0, 22)])
    expect(occurrencesInMonth(e, 2026, 2)).toEqual([new Date(2026, 1, 2)]) // 음력 2025/12/15
  })

  it('설날(음력 1/1)은 해에 따라 1월에도 2월에도 나타난다', () => {
    const e = entry({
      date_type: 'lunar', repeat: 'yearly',
      event_date: '2026-02-17', lunar_month: 1, lunar_day: 1,
    })
    expect(occurrencesInMonth(e, 2026, 2)).toEqual([new Date(2026, 1, 17)])
    expect(occurrencesInMonth(e, 2028, 1)).toEqual([new Date(2028, 0, 27)])
    expect(occurrencesInMonth(e, 2028, 2)).toEqual([])
  })

  it('30일이 없는 달이면 29일로 내려서 표시한다', () => {
    const e = entry({
      date_type: 'lunar', repeat: 'yearly',
      event_date: '2026-04-16', lunar_month: 2, lunar_day: 30,
    })
    expect(occurrencesInMonth(e, 2026, 4)).toEqual([new Date(2026, 3, 16)])
  })
})

describe('occurrencesInMonth — 음력 일회성', () => {
  it('저장된 양력 날짜를 그대로 쓴다', () => {
    const e = entry({
      date_type: 'lunar', repeat: 'none',
      event_date: '2026-05-01', lunar_month: 3, lunar_day: 15,
    })
    expect(occurrencesInMonth(e, 2026, 5)).toEqual([new Date(2026, 4, 1)])
    expect(occurrencesInMonth(e, 2027, 4)).toEqual([])
  })
})
```

**Step 2: 테스트를 돌려 실패를 확인**

Run: `pnpm test src/lib/recurrence.test.ts`
Expected: FAIL — `Failed to resolve import "./recurrence"`

**Step 3: 최소 구현 작성**

`src/lib/recurrence.ts`:

```ts
import { lunarToSolarClamped } from './lunar'

export type DateType = 'solar' | 'lunar'
export type RepeatRule = 'none' | 'yearly' | 'monthly'

export type EntryLike = {
  date_type: DateType
  repeat: RepeatRule
  /** 양력 기준일 'YYYY-MM-DD'. 음력 항목은 첫 발생일의 양력 날짜. */
  event_date: string
  lunar_month: number | null
  lunar_day: number | null
}

/** 'YYYY-MM-DD' → 로컬 Date. new Date(문자열)은 UTC로 파싱돼 하루 밀리므로 직접 자른다. */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** month는 1-based. 그 달의 마지막 날. */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** Date → 'YYYY-MM-DD' (DB 저장용) */
export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * 항목이 지정된 양력 월(year, month 1-based)에 표시될 날짜들.
 * 보통 0개 또는 1개를 돌려준다.
 */
export function occurrencesInMonth(entry: EntryLike, year: number, month: number): Date[] {
  if (entry.date_type === 'lunar' && entry.repeat === 'yearly') {
    const { lunar_month, lunar_day } = entry
    if (lunar_month == null || lunar_day == null) return []
    // 음력 해 Y는 양력 Y 2월경 ~ Y+1 2월경에 걸쳐 있다.
    // 따라서 양력 year에 나타나는 날짜는 음력 해 year-1 또는 year에서 나온다.
    const found: Date[] = []
    for (const lunarYear of [year - 1, year]) {
      const d = lunarToSolarClamped(lunarYear, lunar_month, lunar_day)
      if (d && d.getFullYear() === year && d.getMonth() === month - 1) found.push(d)
    }
    return found
  }

  const base = parseISODate(entry.event_date)

  switch (entry.repeat) {
    case 'none':
      return base.getFullYear() === year && base.getMonth() === month - 1 ? [base] : []
    case 'yearly':
      if (base.getMonth() !== month - 1) return []
      return [new Date(year, month - 1, Math.min(base.getDate(), lastDayOfMonth(year, month)))]
    case 'monthly':
      return [new Date(year, month - 1, Math.min(base.getDate(), lastDayOfMonth(year, month)))]
  }
}
```

**Step 4: 테스트 통과 확인**

Run: `pnpm test src/lib/recurrence.test.ts`
Expected: PASS — 15 passed

**Step 5: 커밋**

```bash
git add src/lib/recurrence.ts src/lib/recurrence.test.ts
git commit -m "feat: expand solar/lunar recurring entries into calendar dates"
```

---

## Task 5: 달력 그리드 생성

**Files:**
- Create: `src/lib/calendar.ts`
- Create: `src/lib/calendar.test.ts`

**Step 1: 실패하는 테스트 작성**

`src/lib/calendar.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildMonthGrid, isSameDay, CELLS } from './calendar'

describe('buildMonthGrid', () => {
  it('항상 42칸(6주)을 돌려준다', () => {
    expect(buildMonthGrid(2026, 8)).toHaveLength(CELLS)
    expect(buildMonthGrid(2026, 2)).toHaveLength(CELLS)
  })

  it('첫 칸은 1일 이전(또는 당일) 가장 가까운 일요일이다', () => {
    // 2026-08-01은 토요일 → 그리드는 7/26(일)부터
    const grid = buildMonthGrid(2026, 8)
    expect(grid[0]).toEqual(new Date(2026, 6, 26))
    expect(grid[0].getDay()).toBe(0)
    expect(grid[CELLS - 1]).toEqual(new Date(2026, 8, 5))
  })

  it('1일이 일요일이면 그 날부터 시작한다', () => {
    // 2026-11-01은 일요일
    const grid = buildMonthGrid(2026, 11)
    expect(grid[0]).toEqual(new Date(2026, 10, 1))
  })

  it('모든 칸이 하루씩 연속한다', () => {
    const grid = buildMonthGrid(2026, 2)
    for (let i = 1; i < grid.length; i++) {
      const diff = (grid[i].getTime() - grid[i - 1].getTime()) / 86400000
      expect(Math.round(diff)).toBe(1)
    }
  })
})

describe('isSameDay', () => {
  it('연월일이 같으면 true', () => {
    expect(isSameDay(new Date(2026, 7, 15), new Date(2026, 7, 15))).toBe(true)
  })
  it('연 또는 월이 다르면 false', () => {
    expect(isSameDay(new Date(2026, 7, 15), new Date(2027, 7, 15))).toBe(false)
    expect(isSameDay(new Date(2026, 7, 15), new Date(2026, 8, 15))).toBe(false)
  })
})
```

**Step 2: 테스트를 돌려 실패를 확인**

Run: `pnpm test src/lib/calendar.test.ts`
Expected: FAIL — `Failed to resolve import "./calendar"`

**Step 3: 최소 구현 작성**

`src/lib/calendar.ts`:

```ts
/** 6주 고정. 달마다 행 수가 바뀌어 레이아웃이 튀는 걸 막는다. */
export const CELLS = 42

/** 해당 월을 감싸는 42칸 날짜 배열. 첫 칸은 1일 직전(또는 당일) 일요일. */
export function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month - 1, 1)
  const startDay = 1 - first.getDay()
  return Array.from({ length: CELLS }, (_, i) => new Date(year, month - 1, startDay + i))
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** 이전/다음 달로 이동한 (year, month) 쌍. month는 1-based. */
export function shiftMonth(year: number, month: number, delta: number): [number, number] {
  const d = new Date(year, month - 1 + delta, 1)
  return [d.getFullYear(), d.getMonth() + 1]
}

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const
```

**Step 4: 테스트 통과 확인**

Run: `pnpm test`
Expected: 전체 PASS — 3개 파일, 총 30개 안팎

**Step 5: 커밋**

```bash
git add src/lib/calendar.ts src/lib/calendar.test.ts
git commit -m "feat: build 6-week calendar month grid"
```

---

# Phase C — Supabase 연동

## Task 6: DB 스키마와 RLS 정책

**Files:**
- Create: `supabase/schema.sql`

이 파일은 Supabase Dashboard → SQL Editor에 붙여넣어 실행한다. 파일로 남기는 이유는 나중에 프로젝트를 다시 만들 때 그대로 재실행하기 위해서다.

**Step 1: 스키마 SQL 작성**

`supabase/schema.sql`:

```sql
-- ============================================================
-- share-calendar 스키마 + RLS
-- Supabase Dashboard > SQL Editor에 전체를 붙여넣고 실행한다.
-- 여러 번 실행해도 안전하도록 작성했다.
-- ============================================================

-- ---------- 테이블 ----------

create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text not null default '이름없음',
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  created_by  uuid not null references auth.users on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id  uuid not null references public.groups on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.entries (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups on delete cascade,
  author_id     uuid not null references auth.users on delete cascade,
  title         text not null check (length(title) between 1 and 200),
  memo          text check (length(memo) <= 2000),
  date_type     text not null default 'solar' check (date_type in ('solar', 'lunar')),
  repeat        text not null default 'none'  check (repeat in ('none', 'yearly', 'monthly')),
  event_date    date not null,
  lunar_month   int  check (lunar_month between 1 and 12),
  lunar_day     int  check (lunar_day   between 1 and 30),
  is_leap_month boolean not null default false,
  created_at    timestamptz not null default now(),
  -- 음력 항목은 음력 월/일이 반드시 있어야 한다
  constraint lunar_fields_present check (
    date_type <> 'lunar' or (lunar_month is not null and lunar_day is not null)
  )
);

create index if not exists entries_group_idx on public.entries (group_id);
create index if not exists group_members_user_idx on public.group_members (user_id);

-- ---------- 헬퍼 함수 ----------
-- SECURITY DEFINER로 RLS를 우회한다. 이게 없으면 group_members 정책이
-- 자기 자신을 조회하며 무한 재귀에 빠진다 (Supabase의 대표적인 함정).

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.shares_group_with(uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.group_members me
    join public.group_members other on me.group_id = other.group_id
    where me.user_id = auth.uid() and other.user_id = uid
  );
$$;

-- ---------- 트리거 ----------

-- 카카오 로그인으로 신규 가입하면 프로필을 자동 생성한다 (클라이언트 코드 불필요)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'preferred_username',
      '이름없음'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 그룹을 만들면 만든 사람을 owner 멤버로 자동 추가한다
create or replace function public.add_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_group_created on public.groups;
create trigger on_group_created
  after insert on public.groups
  for each row execute function public.add_creator_as_owner();

-- ---------- 초대 코드로 그룹 가입 ----------
-- 코드를 아는 사람만 가입할 수 있어야 하는데, groups를 직접 조회하게 두면
-- 비멤버가 그룹 목록을 훑을 수 있다. 그래서 함수 하나로만 열어준다.

create or replace function public.join_group_by_code(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;

  select id into gid from public.groups where invite_code = code;
  if gid is null then
    raise exception '잘못된 초대 코드입니다';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (gid, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return gid;
end;
$$;

-- ---------- RLS ----------

alter table public.profiles      enable row level security;
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;
alter table public.entries       enable row level security;

-- profiles: 나 자신 + 같은 그룹에 속한 사람만 조회 가능
drop policy if exists "read own and groupmate profiles" on public.profiles;
create policy "read own and groupmate profiles" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_group_with(id));

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- groups: 멤버만 조회, 로그인 사용자는 생성 가능, owner만 수정/삭제
drop policy if exists "members read groups" on public.groups;
create policy "members read groups" on public.groups
  for select to authenticated
  using (public.is_group_member(id));

drop policy if exists "authenticated create groups" on public.groups;
create policy "authenticated create groups" on public.groups
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "owner updates group" on public.groups;
create policy "owner updates group" on public.groups
  for update to authenticated
  using (exists (
    select 1 from public.group_members
    where group_id = groups.id and user_id = auth.uid() and role = 'owner'
  ));

drop policy if exists "owner deletes group" on public.groups;
create policy "owner deletes group" on public.groups
  for delete to authenticated
  using (exists (
    select 1 from public.group_members
    where group_id = groups.id and user_id = auth.uid() and role = 'owner'
  ));

-- group_members: 같은 그룹 멤버끼리만 서로 보인다
drop policy if exists "members read memberships" on public.group_members;
create policy "members read memberships" on public.group_members
  for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "leave group" on public.group_members;
create policy "leave group" on public.group_members
  for delete to authenticated
  using (user_id = auth.uid());

-- entries: 그룹 멤버는 모두 읽고 쓸 수 있지만, 고치고 지우는 건 작성자만
drop policy if exists "members read entries" on public.entries;
create policy "members read entries" on public.entries
  for select to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "members insert entries" on public.entries;
create policy "members insert entries" on public.entries
  for insert to authenticated
  with check (public.is_group_member(group_id) and author_id = auth.uid());

drop policy if exists "author updates entries" on public.entries;
create policy "author updates entries" on public.entries
  for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

drop policy if exists "author deletes entries" on public.entries;
create policy "author deletes entries" on public.entries
  for delete to authenticated
  using (author_id = auth.uid());

-- ---------- Data API 권한 (GRANT) ----------
-- 프로젝트 생성 시 "Automatically expose new tables"를 껐다면 이 GRANT가 없으면
-- SQL 실행은 성공해도 앱에서 "permission denied for table ..."이 난다.
-- 켜둔 상태라면 이미 부여된 권한이라 다시 실행해도 무해하다.
--
-- 여기서 주는 건 "이 테이블을 Data API로 만질 수 있다"까지고,
-- 어떤 행을 볼 수 있는지는 위의 RLS 정책이 결정한다. 두 층은 별개다.
-- anon에는 아무 테이블 권한도 주지 않는다 — 로그인 없이 접근할 이유가 없다.

grant usage on schema public to anon, authenticated;

grant select, update                  on public.profiles      to authenticated;
grant select, insert, update, delete  on public.groups        to authenticated;
grant select, delete                  on public.group_members to authenticated;
grant select, insert, update, delete  on public.entries       to authenticated;

-- group_members INSERT 권한은 일부러 주지 않는다.
-- 가입은 join_group_by_code(SECURITY DEFINER)와 그룹 생성 트리거로만 이뤄져야
-- 초대 코드를 모르는 사람이 임의의 그룹에 자기를 밀어넣을 수 없다.

grant execute on function public.join_group_by_code(text) to authenticated;
grant execute on function public.is_group_member(uuid)    to authenticated;
grant execute on function public.shares_group_with(uuid)  to authenticated;
```

**Step 2: Supabase에서 실행**

Supabase Dashboard → SQL Editor → New query → 위 파일 내용 전체 붙여넣기 → Run.
Expected: `Success. No rows returned`

**Step 3: 비로그인 접근이 막히는지 확인**

SQL Editor에서 아래를 실행한다.

```sql
set local role anon;
select count(*) from public.groups;
```

Expected: `permission denied for table groups` 에러.
GRANT를 anon에게 주지 않았으므로 RLS 이전 단계에서 막힌다.

로그인 사용자에게 RLS가 걸리는지도 확인한다. 아직 아무 그룹에도 속하지 않은 상태라면:

```sql
set local role authenticated;
select count(*) from public.groups;
```

Expected: `0` (에러가 아니라 0행 — 테이블엔 접근되지만 RLS가 행을 걸러낸 것)

**Step 4: `group_members` 정책 재귀가 없는지 확인**

```sql
select public.is_group_member('00000000-0000-0000-0000-000000000000'::uuid);
```

Expected: `false`. `infinite recursion detected in policy` 에러가 나면 헬퍼 함수의 `security definer`가 빠진 것이다.

**Step 5: 커밋**

```bash
git add supabase/schema.sql
git commit -m "feat: add Postgres schema, triggers and RLS policies"
```

---

## Task 7: Supabase 클라이언트와 타입

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `src/lib/types.ts`
- Create: `.env.local` (git 무시됨)
- Create: `.env.example`
- Modify: `.gitignore`

**Step 1: .gitignore에 환경변수 추가**

`.gitignore`의 `*.local` 아래에 다음을 추가한다 (`*.local`이 `.env.local`을 이미 덮지만 명시해 둔다).

```
.env
.env.local
```

**Step 2: .env.example 작성**

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

**Step 3: .env.local 작성 (실제 값)**

Supabase Dashboard → Settings → API에서 복사한 값을 넣는다.
`anon public` 키는 브라우저에 노출되는 게 정상이다 — 실제 보안은 RLS가 담당한다.
절대 `service_role` 키를 쓰면 안 된다.

**Step 4: 타입 정의**

`src/lib/types.ts`:

```ts
import type { DateType, RepeatRule } from './recurrence'

export type Profile = {
  id: string
  name: string
  avatar_url: string | null
}

export type Group = {
  id: string
  name: string
  invite_code: string
  created_by: string
}

export type Entry = {
  id: string
  group_id: string
  author_id: string
  title: string
  memo: string | null
  date_type: DateType
  repeat: RepeatRule
  event_date: string
  lunar_month: number | null
  lunar_day: number | null
  is_leap_month: boolean
  created_at: string
}

/** 목록 조회 시 작성자 프로필을 join해서 함께 받는다 */
export type EntryWithAuthor = Entry & { author: Pick<Profile, 'name' | 'avatar_url'> | null }
```

**Step 5: 클라이언트 작성**

`src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY가 없습니다. .env.example을 참고해 .env.local을 만드세요.',
  )
}

export const supabase = createClient(url, anonKey)
```

**Step 6: 타입체크 통과 확인**

Run: `pnpm build`
Expected: 성공

**Step 7: 커밋**

```bash
git add src/lib/supabase.ts src/lib/types.ts .env.example .gitignore
git commit -m "feat: add Supabase client and domain types"
```

---

## Task 8: 카카오 로그인과 세션

**Files:**
- Create: `src/lib/useAuth.ts`
- Create: `src/pages/Login.tsx`

**Step 1: 인증 훅 작성**

`src/lib/useAuth.ts`:

```ts
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  return { session, user: session?.user ?? null, loading }
}

export function signInWithKakao() {
  return supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: window.location.origin },
  })
}

export function signOut() {
  return supabase.auth.signOut()
}
```

**Step 2: 로그인 화면 작성**

`src/pages/Login.tsx`:

```tsx
import { signInWithKakao } from '../lib/useAuth'

export default function Login() {
  return (
    <main className="login">
      <h1>우리 달력</h1>
      <p>가족·친구와 함께 쓰는 달력이에요.</p>
      <button type="button" className="kakao-btn" onClick={() => signInWithKakao()}>
        카카오로 시작하기
      </button>
    </main>
  )
}
```

**Step 3: 카카오 로그인이 실제로 도는지 확인**

Task 10에서 라우터를 붙인 뒤에 확인한다. 지금은 타입체크만 통과하면 된다.

Run: `pnpm build`
Expected: 성공

**Step 4: 커밋**

```bash
git add src/lib/useAuth.ts src/pages/Login.tsx
git commit -m "feat: add Kakao OAuth sign-in and session hook"
```

---

## Task 9: 그룹과 항목 데이터 훅

**Files:**
- Create: `src/lib/api.ts`
- Create: `src/lib/useGroups.ts`
- Create: `src/lib/useEntries.ts`

**Step 1: API 함수 모음 작성**

`src/lib/api.ts`:

```ts
import { supabase } from './supabase'
import type { Entry, EntryWithAuthor, Group, Profile } from './types'

export async function fetchMyGroups(): Promise<Group[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, invite_code, created_by')
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function createGroup(name: string, userId: string): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .insert({ name, created_by: userId })
    .select('id, name, invite_code, created_by')
    .single()
  if (error) throw error
  return data
}

export async function joinGroupByCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_group_by_code', { code })
  if (error) throw error
  return data as string
}

export async function fetchGroupMembers(groupId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('profiles!inner(id, name, avatar_url)')
    .eq('group_id', groupId)
  if (error) throw error
  return (data ?? []).flatMap((row) => row.profiles as unknown as Profile)
}

export async function fetchEntries(groupId: string): Promise<EntryWithAuthor[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('*, author:profiles!entries_author_id_fkey(name, avatar_url)')
    .eq('group_id', groupId)
    .order('created_at')
  if (error) throw error
  return (data ?? []) as unknown as EntryWithAuthor[]
}

export type NewEntry = Omit<Entry, 'id' | 'created_at'>

export async function createEntry(entry: NewEntry): Promise<EntryWithAuthor> {
  const { data, error } = await supabase
    .from('entries')
    .insert(entry)
    .select('*, author:profiles!entries_author_id_fkey(name, avatar_url)')
    .single()
  if (error) throw error
  return data as unknown as EntryWithAuthor
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('entries').delete().eq('id', id)
  if (error) throw error
}
```

**참고:** `profiles!entries_author_id_fkey`는 외래키 이름이다. Supabase가 자동 생성하는 이름이 다르면 Dashboard → Table Editor → entries → author_id의 외래키 이름을 확인해 맞춰야 한다. 확인 방법:

```sql
select conname from pg_constraint where conrelid = 'public.entries'::regclass and contype = 'f';
```

**Step 2: 그룹 훅 작성**

`src/lib/useGroups.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { fetchMyGroups } from './api'
import type { Group } from './types'

const LAST_GROUP_KEY = 'share-calendar:last-group'

export function useGroups(enabled: boolean) {
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const list = await fetchMyGroups()
      setGroups(list)
      setError(null)
      setSelectedId((current) => {
        if (current && list.some((g) => g.id === current)) return current
        const remembered = localStorage.getItem(LAST_GROUP_KEY)
        if (remembered && list.some((g) => g.id === remembered)) return remembered
        return list[0]?.id ?? null
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '그룹을 불러오지 못했어요')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) void reload()
  }, [enabled, reload])

  const select = useCallback((id: string) => {
    setSelectedId(id)
    localStorage.setItem(LAST_GROUP_KEY, id)
  }, [])

  return { groups, selectedId, select, loading, error, reload }
}
```

**Step 3: 항목 훅 작성**

`src/lib/useEntries.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { createEntry, deleteEntry, fetchEntries } from './api'
import type { NewEntry } from './api'
import type { EntryWithAuthor } from './types'

export function useEntries(groupId: string | null) {
  const [entries, setEntries] = useState<EntryWithAuthor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!groupId) {
      setEntries([])
      return
    }
    setLoading(true)
    try {
      setEntries(await fetchEntries(groupId))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '일정을 불러오지 못했어요')
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    void reload()
  }, [reload])

  const add = useCallback(async (entry: NewEntry) => {
    const created = await createEntry(entry)
    setEntries((prev) => [...prev, created])
  }, [])

  const remove = useCallback(async (id: string) => {
    await deleteEntry(id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  return { entries, loading, error, add, remove, reload }
}
```

**Step 4: 타입체크 통과 확인**

Run: `pnpm build`
Expected: 성공

**Step 5: 커밋**

```bash
git add src/lib/api.ts src/lib/useGroups.ts src/lib/useEntries.ts
git commit -m "feat: add data access layer for groups and entries"
```

---

# Phase D — 화면

## Task 10: 라우터와 인증 가드

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Create: `src/pages/Join.tsx`

**Step 1: main.tsx에 라우터 붙이기**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

**Step 2: App.tsx에 라우트와 인증 가드 작성**

```tsx
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/useAuth'
import Login from './pages/Login.tsx'
import Join from './pages/Join.tsx'
import CalendarPage from './pages/CalendarPage.tsx'
import Groups from './pages/Groups.tsx'
import './App.css'

function App() {
  const { user, loading } = useAuth()

  if (loading) return <div className="center-msg">불러오는 중…</div>

  if (!user) {
    return (
      <Routes>
        <Route path="/join/:code" element={<Login />} />
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<CalendarPage />} />
      <Route path="/groups" element={<Groups />} />
      <Route path="/join/:code" element={<Join />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
```

**참고:** 비로그인 상태로 `/join/:code`에 들어오면 로그인 화면을 보여준다. 카카오 로그인 후 `redirectTo: window.location.origin`으로 돌아오면 초대 코드가 날아가므로, Task 13에서 `redirectTo`를 현재 경로로 바꾼다.

**Step 3: 초대 수락 화면 작성**

`src/pages/Join.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { joinGroupByCode } from '../lib/api'

export default function Join() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    joinGroupByCode(code)
      .then(() => navigate('/', { replace: true }))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '가입에 실패했어요'))
  }, [code, navigate])

  if (error) {
    return (
      <div className="center-msg">
        <p>{error}</p>
        <button type="button" onClick={() => navigate('/')}>달력으로</button>
      </div>
    )
  }
  return <div className="center-msg">그룹에 들어가는 중…</div>
}
```

**Step 4: 아직 없는 페이지 때문에 빌드가 깨지는지 확인**

Run: `pnpm build`
Expected: FAIL — `Cannot find module './pages/CalendarPage.tsx'`. Task 11에서 만든다.

**Step 5: 커밋은 Task 11 이후에**

App.tsx가 아직 없는 파일을 참조하므로 여기서는 커밋하지 않는다.

---

## Task 11: 월 달력 화면

**Files:**
- Create: `src/pages/CalendarPage.tsx`
- Create: `src/components/MonthGrid.tsx`
- Create: `src/components/GroupSwitcher.tsx`

**Step 1: 그룹 전환 드롭다운**

`src/components/GroupSwitcher.tsx`:

```tsx
import { Link } from 'react-router-dom'
import type { Group } from '../lib/types'

type Props = {
  groups: Group[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function GroupSwitcher({ groups, selectedId, onSelect }: Props) {
  return (
    <div className="group-switcher">
      <select
        value={selectedId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        aria-label="그룹 선택"
      >
        {groups.map((g) => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </select>
      <Link to="/groups" className="link-btn">그룹 관리</Link>
    </div>
  )
}
```

**Step 2: 월 그리드 컴포넌트**

`src/components/MonthGrid.tsx`:

```tsx
import { buildMonthGrid, isSameDay, WEEKDAY_LABELS } from '../lib/calendar'
import { solarToLunar } from '../lib/lunar'
import { occurrencesInMonth } from '../lib/recurrence'
import type { EntryWithAuthor } from '../lib/types'

type Props = {
  year: number
  month: number
  entries: EntryWithAuthor[]
  selected: Date
  onSelect: (d: Date) => void
}

export default function MonthGrid({ year, month, entries, selected, onSelect }: Props) {
  const cells = buildMonthGrid(year, month)
  const today = new Date()

  // 이 달에 표시할 항목을 날짜별로 모아둔다
  const byDate = new Map<string, EntryWithAuthor[]>()
  for (const entry of entries) {
    for (const d of occurrencesInMonth(entry, year, month)) {
      const key = d.toDateString()
      const list = byDate.get(key)
      if (list) list.push(entry)
      else byDate.set(key, [entry])
    }
  }

  return (
    <div className="month-grid" role="grid">
      {WEEKDAY_LABELS.map((label) => (
        <div key={label} className="weekday">{label}</div>
      ))}

      {cells.map((date) => {
        const inMonth = date.getMonth() === month - 1
        const lunar = solarToLunar(date)
        const dayEntries = byDate.get(date.toDateString()) ?? []
        const classes = [
          'cell',
          inMonth ? '' : 'outside',
          isSameDay(date, today) ? 'today' : '',
          isSameDay(date, selected) ? 'selected' : '',
        ].filter(Boolean).join(' ')

        return (
          <button
            type="button"
            key={date.toDateString()}
            className={classes}
            onClick={() => onSelect(date)}
          >
            <span className="solar-day">{date.getDate()}</span>
            {lunar && <span className="lunar-day">{lunar.month}.{lunar.day}</span>}
            <span className="cell-entries">
              {dayEntries.slice(0, 3).map((e) => (
                <span key={e.id} className="entry-chip" title={e.title}>{e.title}</span>
              ))}
              {dayEntries.length > 3 && <span className="entry-more">+{dayEntries.length - 3}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
```

**Step 3: 달력 페이지**

`src/pages/CalendarPage.tsx`:

```tsx
import { useState } from 'react'
import GroupSwitcher from '../components/GroupSwitcher.tsx'
import MonthGrid from '../components/MonthGrid.tsx'
import DayPanel from '../components/DayPanel.tsx'
import { shiftMonth } from '../lib/calendar'
import { useAuth, signOut } from '../lib/useAuth'
import { useEntries } from '../lib/useEntries'
import { useGroups } from '../lib/useGroups'

export default function CalendarPage() {
  const { user } = useAuth()
  const { groups, selectedId, select, loading: groupsLoading, error: groupsError } = useGroups(!!user)
  const { entries, add, remove, error: entriesError } = useEntries(selectedId)

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [selected, setSelected] = useState(today)

  function move(delta: number) {
    const [y, m] = shiftMonth(year, month, delta)
    setYear(y)
    setMonth(m)
  }

  function goToday() {
    const now = new Date()
    setYear(now.getFullYear())
    setMonth(now.getMonth() + 1)
    setSelected(now)
  }

  if (groupsLoading) return <div className="center-msg">불러오는 중…</div>

  if (groups.length === 0) {
    return (
      <div className="center-msg">
        <p>아직 속한 그룹이 없어요.</p>
        <a className="link-btn" href="/groups">그룹 만들기</a>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        <GroupSwitcher groups={groups} selectedId={selectedId} onSelect={select} />
        <button type="button" className="link-btn" onClick={() => void signOut()}>로그아웃</button>
      </header>

      <nav className="month-nav">
        <button type="button" onClick={() => move(-1)} aria-label="이전 달">‹</button>
        <h2>{year}.{String(month).padStart(2, '0')}</h2>
        <button type="button" onClick={() => move(1)} aria-label="다음 달">›</button>
        <button type="button" className="today-btn" onClick={goToday}>오늘</button>
      </nav>

      {(groupsError ?? entriesError) && (
        <p className="error">{groupsError ?? entriesError}</p>
      )}

      <MonthGrid
        year={year}
        month={month}
        entries={entries}
        selected={selected}
        onSelect={setSelected}
      />

      <DayPanel
        date={selected}
        groupId={selectedId}
        userId={user?.id ?? ''}
        entries={entries}
        onAdd={add}
        onDelete={remove}
      />
    </div>
  )
}
```

**Step 4: 아직 DayPanel이 없으므로 Task 12까지 진행 후 빌드**

---

## Task 12: 날짜 상세 패널과 항목 작성 폼

**Files:**
- Create: `src/components/DayPanel.tsx`

**Step 1: 패널 컴포넌트 작성**

`src/components/DayPanel.tsx`:

```tsx
import { useState } from 'react'
import { lunarToSolar, solarToLunar } from '../lib/lunar'
import { occurrencesInMonth, toISODate } from '../lib/recurrence'
import type { DateType, RepeatRule } from '../lib/recurrence'
import type { NewEntry } from '../lib/api'
import type { EntryWithAuthor } from '../lib/types'

type Props = {
  date: Date
  groupId: string | null
  userId: string
  entries: EntryWithAuthor[]
  onAdd: (e: NewEntry) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function DayPanel({ date, groupId, userId, entries, onAdd, onDelete }: Props) {
  const [title, setTitle] = useState('')
  const [memo, setMemo] = useState('')
  const [dateType, setDateType] = useState<DateType>('solar')
  const [repeat, setRepeat] = useState<RepeatRule>('none')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lunar = solarToLunar(date)

  // 이 날에 실제로 표시되는 항목들 (반복 전개 결과 포함)
  const dayEntries = entries.filter((e) =>
    occurrencesInMonth(e, date.getFullYear(), date.getMonth() + 1)
      .some((d) => d.getDate() === date.getDate()),
  )

  // 음력을 고르면 매월 반복은 지원하지 않으므로 되돌린다
  function changeDateType(next: DateType) {
    setDateType(next)
    if (next === 'lunar' && repeat === 'monthly') setRepeat('yearly')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!groupId || !title.trim()) return

    setSaving(true)
    setError(null)
    try {
      const isLunar = dateType === 'lunar'
      if (isLunar && !lunar) {
        setError('이 날짜는 음력으로 바꿀 수 없어요 (지원 범위 밖)')
        return
      }
      await onAdd({
        group_id: groupId,
        author_id: userId,
        title: title.trim(),
        memo: memo.trim() || null,
        date_type: dateType,
        repeat,
        event_date: toISODate(date),
        lunar_month: isLunar ? lunar!.month : null,
        lunar_day: isLunar ? lunar!.day : null,
        is_leap_month: isLunar ? lunar!.isLeap : false,
      })
      setTitle('')
      setMemo('')
      setRepeat('none')
      setDateType('solar')
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했어요')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="day-panel">
      <h3>
        {date.getMonth() + 1}월 {date.getDate()}일
        {lunar && <span className="lunar-label">음력 {lunar.month}.{lunar.day}</span>}
      </h3>

      <ul className="entry-list">
        {dayEntries.length === 0 && <li className="empty">아직 계획이 없어요.</li>}
        {dayEntries.map((e) => (
          <li key={e.id}>
            <div>
              <strong>{e.title}</strong>
              {e.date_type === 'lunar' && <span className="badge">음력</span>}
              {e.repeat !== 'none' && (
                <span className="badge">{e.repeat === 'yearly' ? '매년' : '매월'}</span>
              )}
              {e.memo && <p className="memo">{e.memo}</p>}
              <small className="author">{e.author?.name ?? '알 수 없음'}</small>
            </div>
            {e.author_id === userId && (
              <button type="button" className="del-btn" onClick={() => void onDelete(e.id)}>
                삭제
              </button>
            )}
          </li>
        ))}
      </ul>

      <form className="entry-form" onSubmit={(e) => void submit(e)}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="무엇을 할 예정인가요?"
          maxLength={200}
          required
        />
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
          rows={2}
          maxLength={2000}
        />

        <div className="form-row">
          <label>
            <input
              type="radio"
              checked={dateType === 'solar'}
              onChange={() => changeDateType('solar')}
            />
            양력
          </label>
          <label>
            <input
              type="radio"
              checked={dateType === 'lunar'}
              onChange={() => changeDateType('lunar')}
            />
            음력
          </label>

          <select
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as RepeatRule)}
            aria-label="반복"
          >
            <option value="none">반복 없음</option>
            <option value="yearly">매년</option>
            {dateType === 'solar' && <option value="monthly">매월</option>}
          </select>
        </div>

        {dateType === 'lunar' && repeat === 'yearly' && lunar && (
          <p className="hint">
            매년 음력 {lunar.month}월 {lunar.day}일에 표시돼요
            {' '}(내년엔 {formatNextYear(lunar.month, lunar.day, date.getFullYear() + 1)}).
          </p>
        )}

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={saving || !title.trim()}>
          {saving ? '저장 중…' : '추가'}
        </button>
      </form>
    </section>
  )
}

function formatNextYear(month: number, day: number, year: number): string {
  const d = lunarToSolar(year, month, day) ?? lunarToSolar(year, month, 29)
  return d ? `양력 ${d.getMonth() + 1}월 ${d.getDate()}일` : '계산 불가'
}
```

**Step 2: 빌드 확인**

Run: `pnpm build`
Expected: FAIL — `Cannot find module './pages/Groups.tsx'`. Task 13에서 만든다.

---

## Task 13: 그룹 관리 화면

**Files:**
- Create: `src/pages/Groups.tsx`
- Modify: `src/lib/useAuth.ts` (초대 링크로 들어온 경우 로그인 후 원래 경로로 복귀)

**Step 1: 로그인 후 원래 경로로 돌아오게 수정**

`src/lib/useAuth.ts`의 `signInWithKakao`를 아래로 교체한다. 초대 링크(`/join/abc123`)로 들어온 사람이 로그인 후 다시 초대 페이지로 돌아와야 그룹에 가입된다.

```ts
export function signInWithKakao() {
  return supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo: window.location.origin + window.location.pathname },
  })
}
```

**주의:** Supabase Dashboard → Authentication → URL Configuration의 `Redirect URLs`에 `http://localhost:5173/**` 와 배포 도메인 `https://<your-app>.vercel.app/**` 를 와일드카드로 등록해야 이 경로 복귀가 동작한다.

**Step 2: 그룹 관리 화면 작성**

`src/pages/Groups.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createGroup, fetchGroupMembers } from '../lib/api'
import { useAuth } from '../lib/useAuth'
import { useGroups } from '../lib/useGroups'
import type { Profile } from '../lib/types'

export default function Groups() {
  const { user } = useAuth()
  const { groups, reload } = useGroups(!!user)
  const [name, setName] = useState('')
  const [members, setMembers] = useState<Record<string, Profile[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    for (const g of groups) {
      fetchGroupMembers(g.id)
        .then((list) => setMembers((prev) => ({ ...prev, [g.id]: list })))
        .catch(() => {})
    }
  }, [groups])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !name.trim()) return
    try {
      await createGroup(name.trim(), user.id)
      setName('')
      setError(null)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : '그룹을 만들지 못했어요')
    }
  }

  async function copyInvite(code: string) {
    const url = `${window.location.origin}/join/${code}`
    await navigator.clipboard.writeText(url)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="link-btn">← 달력으로</Link>
      </header>

      <h2>내 그룹</h2>
      <ul className="group-list">
        {groups.map((g) => (
          <li key={g.id}>
            <strong>{g.name}</strong>
            <p className="members">
              {(members[g.id] ?? []).map((m) => m.name).join(', ') || '멤버 불러오는 중…'}
            </p>
            <button type="button" onClick={() => void copyInvite(g.invite_code)}>
              {copied === g.invite_code ? '복사됨!' : '초대 링크 복사'}
            </button>
          </li>
        ))}
        {groups.length === 0 && <li className="empty">아직 그룹이 없어요.</li>}
      </ul>

      <h2>새 그룹 만들기</h2>
      <form className="entry-form" onSubmit={(e) => void submit(e)}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 우리 가족"
          maxLength={50}
          required
        />
        <button type="submit" disabled={!name.trim()}>만들기</button>
      </form>

      {error && <p className="error">{error}</p>}
    </div>
  )
}
```

**Step 3: 빌드 확인**

Run: `pnpm build`
Expected: 성공

**Step 4: 커밋 (Task 10~13을 한 번에)**

```bash
git add src/main.tsx src/App.tsx src/pages src/components
git commit -m "feat: add calendar, day panel, group management screens and routing"
```

---

## Task 14: 반응형 스타일

**Files:**
- Modify: `src/App.css`
- Modify: `src/index.css`

**Step 1: index.css를 기본 리셋으로 교체**

```css
:root {
  --bg: #ffffff;
  --fg: #1a1a1a;
  --muted: #767676;
  --line: #e5e5e5;
  --accent: #2563eb;
  --danger: #c62828;
  --sunday: #d32f2f;
  --saturday: #1565c0;
  font-family: system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
  color: var(--fg);
  background: var(--bg);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #16181c;
    --fg: #eceef1;
    --muted: #9aa0a6;
    --line: #2c3036;
    --accent: #6ea8fe;
    --sunday: #ef5350;
    --saturday: #64b5f6;
  }
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  -webkit-text-size-adjust: 100%;
}

button, input, select, textarea {
  font: inherit;
  color: inherit;
}

.center-msg {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  min-height: 60vh;
  color: var(--muted);
}

.error { color: var(--danger); font-size: 0.875rem; }
```

**Step 2: App.css에 레이아웃 작성**

모바일 우선으로 짜고, 768px 이상에서 달력과 상세 패널을 좌우로 나눈다.

```css
.app {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0.75rem;
}

/* ---------- 상단 ---------- */

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-bottom: 0.75rem;
}

.group-switcher { display: flex; align-items: center; gap: 0.5rem; }
.group-switcher select {
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg);
}

.link-btn {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  text-decoration: none;
  font-size: 0.875rem;
  padding: 0.25rem;
}

.month-nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.month-nav h2 { font-size: 1.125rem; margin: 0; min-width: 5.5rem; }
.month-nav button {
  border: 1px solid var(--line);
  background: var(--bg);
  border-radius: 8px;
  padding: 0.3rem 0.7rem;
  cursor: pointer;
}
.month-nav .today-btn { margin-left: auto; }

/* ---------- 달력 ---------- */

.month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background: var(--line);
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}

.weekday {
  background: var(--bg);
  text-align: center;
  padding: 0.4rem 0;
  font-size: 0.75rem;
  color: var(--muted);
}
.weekday:first-child { color: var(--sunday); }
.weekday:nth-child(7) { color: var(--saturday); }

.cell {
  background: var(--bg);
  border: none;
  min-height: 62px;
  padding: 0.25rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  cursor: pointer;
  text-align: left;
  font: inherit;
}
.cell.outside { opacity: 0.35; }
.cell.today .solar-day {
  background: var(--accent);
  color: #fff;
  border-radius: 50%;
  width: 1.4rem;
  height: 1.4rem;
  display: grid;
  place-items: center;
}
.cell.selected { outline: 2px solid var(--accent); outline-offset: -2px; }
.cell:nth-child(7n + 1) .solar-day { color: var(--sunday); }
.cell:nth-child(7n) .solar-day { color: var(--saturday); }
.cell.today .solar-day { color: #fff; }

.solar-day { font-size: 0.8125rem; font-weight: 600; }
.lunar-day { font-size: 0.625rem; color: var(--muted); }

.cell-entries {
  display: flex;
  flex-direction: column;
  gap: 1px;
  width: 100%;
  overflow: hidden;
}

/* 모바일에서는 제목 대신 점으로 */
.entry-chip {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  overflow: hidden;
  text-indent: -999px;
  flex-shrink: 0;
}
.entry-more { font-size: 0.5625rem; color: var(--muted); }

/* ---------- 날짜 상세 ---------- */

.day-panel {
  margin-top: 1rem;
  border-top: 1px solid var(--line);
  padding-top: 0.75rem;
}
.day-panel h3 { display: flex; align-items: baseline; gap: 0.5rem; margin: 0 0 0.5rem; }
.lunar-label { font-size: 0.8125rem; color: var(--muted); font-weight: 400; }

.entry-list { list-style: none; padding: 0; margin: 0 0 1rem; }
.entry-list li {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--line);
}
.entry-list .empty { color: var(--muted); font-size: 0.875rem; border: none; }
.badge {
  font-size: 0.6875rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0.05rem 0.4rem;
  margin-left: 0.35rem;
  color: var(--muted);
}
.memo { margin: 0.25rem 0 0; font-size: 0.875rem; color: var(--muted); white-space: pre-wrap; }
.author { color: var(--muted); font-size: 0.75rem; }
.del-btn { background: none; border: none; color: var(--danger); cursor: pointer; font-size: 0.8125rem; }

/* ---------- 폼 ---------- */

.entry-form { display: flex; flex-direction: column; gap: 0.5rem; }
.entry-form input,
.entry-form textarea,
.entry-form select {
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg);
  width: 100%;
}
.form-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.form-row label { display: flex; align-items: center; gap: 0.25rem; font-size: 0.875rem; }
.form-row select { width: auto; }
.hint { font-size: 0.8125rem; color: var(--muted); margin: 0; }

.entry-form button[type='submit'] {
  padding: 0.6rem;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}
.entry-form button[type='submit']:disabled { opacity: 0.5; cursor: default; }

/* ---------- 그룹 ---------- */

.group-list { list-style: none; padding: 0; }
.group-list li { padding: 0.75rem 0; border-bottom: 1px solid var(--line); }
.group-list button {
  margin-top: 0.4rem;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg);
  cursor: pointer;
}
.members { color: var(--muted); font-size: 0.8125rem; margin: 0.25rem 0 0; }

/* ---------- 로그인 ---------- */

.login {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 100vh;
  padding: 1rem;
  text-align: center;
}
.kakao-btn {
  background: #fee500;
  color: #191600;
  border: none;
  border-radius: 10px;
  padding: 0.8rem 1.6rem;
  font-weight: 600;
  cursor: pointer;
}

/* ---------- 태블릿 이상 ---------- */

@media (min-width: 768px) {
  .app { padding: 1.5rem; }
  .cell { min-height: 96px; }

  /* 넓은 화면에서는 점 대신 제목을 보여준다 */
  .entry-chip {
    width: 100%;
    height: auto;
    border-radius: 4px;
    text-indent: 0;
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--fg);
    font-size: 0.6875rem;
    padding: 1px 4px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .entry-more { font-size: 0.625rem; }

  .calendar-layout {
    display: grid;
    grid-template-columns: 1fr 320px;
    gap: 1.5rem;
    align-items: start;
  }
  .day-panel { margin-top: 0; border-top: none; padding-top: 0; }
}
```

**Step 3: 데스크톱 2단 레이아웃 적용**

`src/pages/CalendarPage.tsx`에서 `<MonthGrid …/>` 와 `<DayPanel …/>` 를 감싸는 div를 추가한다.

```tsx
      <div className="calendar-layout">
        <MonthGrid … />
        <DayPanel … />
      </div>
```

**Step 4: 실제 화면 확인**

Run: `pnpm dev`
브라우저에서 http://localhost:5173 접속 후 확인할 것:
- 카카오 로그인 → 그룹 생성 → 항목 추가가 되는가
- 개발자도구에서 반응형 모드로 375px(모바일)과 1280px(데스크톱) 둘 다 레이아웃이 깨지지 않는가
- 모바일에서 항목이 점으로, 데스크톱에서 제목으로 보이는가
- 음력 매년 항목을 추가한 뒤 다음 해로 넘겨보면 다른 양력 날짜에 찍히는가

**Step 5: 커밋**

```bash
git add src/App.css src/index.css src/pages/CalendarPage.tsx
git commit -m "feat: add responsive mobile-first styling with dark mode"
```

---

# Phase E — 배포와 운영

## Task 15: Vercel 설정과 keep-alive

**Files:**
- Create: `vercel.json`
- Create: `.github/workflows/keep-alive.yml`

**Step 1: SPA 라우팅용 vercel.json**

`/join/abc123`으로 직접 접속했을 때 404가 나지 않도록 모든 경로를 `index.html`로 보낸다.

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

**Step 2: keep-alive 워크플로우**

Supabase 무료 티어는 7일간 API 요청이 없으면 프로젝트를 일시정지한다. 3일마다 요청 하나를 보내 이를 막는다.

`.github/workflows/keep-alive.yml`:

```yaml
name: keep-supabase-alive

on:
  schedule:
    - cron: "0 3 */3 * *"   # 3일마다 UTC 03:00 (KST 정오)
  workflow_dispatch:         # 수동 실행도 가능

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase REST
        run: |
          code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 \
            "${{ secrets.SUPABASE_URL }}/rest/v1/" \
            -H "apikey: ${{ secrets.SUPABASE_ANON_KEY }}")
          echo "HTTP $code"
          # 목적은 "Data API가 응답하는가"를 확인해 일시정지 타이머를 리셋하는 것이다.
          # anon에는 테이블 권한을 주지 않았으므로 401/403도 정상 응답이다 — 서버가
          # 살아있다는 증거다. 일시정지된 프로젝트는 5xx이거나 아예 응답이 없다.
          test -n "$code" && test "$code" -lt 500
```

**Step 3: GitHub Secrets 등록**

GitHub 레포 → Settings → Secrets and variables → Actions → New repository secret로 두 개 등록:
- `SUPABASE_URL` — `https://<ref>.supabase.co`
- `SUPABASE_ANON_KEY` — anon public 키

**Step 4: 워크플로우 수동 실행으로 검증**

GitHub → Actions → `keep-supabase-alive` → Run workflow.
Expected: 초록 체크. 로그의 `HTTP xxx`가 200이든 401이든 5xx만 아니면 정상이다.

**Step 5: 커밋**

```bash
git add vercel.json .github/workflows/keep-alive.yml
git commit -m "chore: add Vercel SPA rewrites and Supabase keep-alive cron"
```

---

## Task 16: 배포와 README

**Files:**
- Modify: `README.md`

**Step 1: GitHub 레포 생성 후 푸시**

```bash
gh repo create share-calendar --private --source=. --remote=origin --push
```

**Step 2: Vercel 연결**

1. https://vercel.com 에 GitHub으로 로그인 → Add New Project → `share-calendar` import
2. Framework Preset이 **Vite**로 자동 인식되는지 확인 (Build Command `pnpm build`, Output `dist`)
3. Environment Variables에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 추가
4. Deploy

**Step 3: 배포 후 인증 설정 마무리**

배포 도메인(`https://<app>.vercel.app`)이 나오면:
1. Supabase → Authentication → URL Configuration → `Site URL`을 배포 도메인으로, `Redirect URLs`에 `https://<app>.vercel.app/**`와 `http://localhost:5173/**` 추가
2. 카카오 개발자 → 카카오 로그인 → Redirect URI에 `https://<ref>.supabase.co/auth/v1/callback`이 있는지 재확인
3. 카카오 개발자 → 앱 설정 → 플랫폼 → Web 사이트 도메인에 배포 도메인 추가

**Step 4: 실제 배포본에서 전체 흐름 확인**

배포된 URL에서:
1. 카카오 로그인
2. 그룹 생성 → 초대 링크 복사
3. 다른 브라우저(또는 시크릿 창)에서 초대 링크 열기 → 다른 카카오 계정으로 로그인 → 그룹 가입 확인
4. 한쪽에서 항목 추가 → 다른 쪽 새로고침 시 보이는지 확인
5. 음력 매년 항목 추가 → 다음 해로 이동해 양력 날짜가 바뀌는지 확인

**Step 5: README 교체**

`README.md` 전체를 아래로 교체한다.

````markdown
# 우리 달력 (share-calendar)

가족·친구 그룹이 함께 쓰는 달력. 날짜별로 계획을 적고, 음력 생신·제사 같은 반복 일정을
매년 자동으로 양력 날짜에 표시한다.

## 로컬 실행

```bash
pnpm install
cp .env.example .env.local   # Supabase URL과 anon key를 채운다
pnpm dev
```

## 명령어

| 명령 | 설명 |
|------|------|
| `pnpm dev` | 개발 서버 |
| `pnpm build` | 타입체크 + 프로덕션 빌드 |
| `pnpm test` | 날짜 계산 로직 테스트 |
| `pnpm lint` | oxlint |

## 구조

- `src/lib/lunar.ts` — 음력↔양력 변환 (korean-lunar-calendar 래핑)
- `src/lib/recurrence.ts` — 반복 일정을 실제 날짜로 전개
- `src/lib/calendar.ts` — 월 그리드 생성
- `src/lib/api.ts` — Supabase 조회/저장
- `supabase/schema.sql` — 테이블·트리거·RLS 정책 (SQL Editor에 붙여넣어 실행)

날짜 계산은 눈으로 검증하기 어려워 테스트로 고정해 두었다. 로직을 바꾸면 `pnpm test`가
먼저 깨지도록 되어 있다.

## 운영

- Supabase 무료 티어는 7일간 요청이 없으면 일시정지된다.
  `.github/workflows/keep-alive.yml`이 3일마다 ping을 보내 이를 막는다.
- 배포는 main 브랜치 push 시 Vercel이 자동으로 처리한다.

## 설계 문서

- `docs/plans/2026-08-08-share-calendar-design.md` — 설계 결정과 근거
- `docs/plans/2026-08-08-share-calendar-implementation.md` — 구현 계획
````

**Step 6: 커밋**

```bash
git add README.md
git commit -m "docs: rewrite README for share-calendar"
git push
```

---

## 완료 기준

- [ ] `pnpm test` 전체 통과 (음력 변환, 반복 전개, 그리드 — 약 30개)
- [ ] `pnpm build` 타입 에러 없이 성공
- [ ] 배포본에서 서로 다른 카카오 계정 2개가 같은 그룹의 일정을 주고받는다
- [ ] 음력 매년 항목이 해가 바뀌면 다른 양력 날짜에 찍힌다
- [ ] 모바일 375px과 데스크톱 1280px 모두 레이아웃이 깨지지 않는다
- [ ] 로그인하지 않은 상태로 REST를 직접 호출하면 권한 거부가 온다 (anon 미노출 확인)
- [ ] 그룹 A 멤버가 그룹 B의 일정을 조회할 수 없다 (RLS 동작 확인)
- [ ] keep-alive 워크플로우가 수동 실행에서 HTTP 200을 받는다
