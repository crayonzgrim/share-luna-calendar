import { lunarToSolarClamped, solarToLunar } from './lunar'

export type DateType = 'solar' | 'lunar'
export type RepeatRule = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export type EntryLike = {
  date_type: DateType
  repeat: RepeatRule
  /** 양력 기준일 'YYYY-MM-DD'. 음력 항목은 첫 발생일의 양력 날짜. */
  event_date: string
  lunar_month: number | null
  lunar_day: number | null
  /** n일/주/개월/년마다의 n. 없으면 1 (매일·매주·매월·매년) */
  repeat_interval?: number
}

/** 'YYYY-MM-DD' → 로컬 Date. new Date(문자열)은 UTC로 파싱돼 하루 밀리므로 직접 자른다. */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Date → 'YYYY-MM-DD' (DB 저장용) */
export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** month는 1-based. 그 달의 마지막 날. */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/**
 * 그 해에 이 항목이 찍히는 날짜들.
 * 매년 반복은 1개, 매월 반복은 12개, 일회성은 그 해에 속할 때만 1개.
 */
export function occurrencesInYear(entry: EntryLike, year: number): Date[] {
  const out: Date[] = []
  for (let m = 1; m <= 12; m++) out.push(...occurrencesInMonth(entry, year, m))
  return out.sort((a, b) => a.getTime() - b.getTime())
}

/**
 * from(그 날 포함) 이후 처음 찍히는 날짜.
 * 반복 없는 지난 일정처럼 앞으로 나올 일이 없으면 null.
 *
 * 음력 반복은 양력 날짜가 해마다 달라 계산으로 바로 구할 수 없다.
 * 한 달씩 앞으로 훑는다 — 최대 24개월이면 매년 반복도 반드시 걸린다.
 */
export function nextOccurrence(
  entry: EntryLike,
  from: Date,
  // n년마다면 다음 발생이 n년 뒤일 수 있다
  maxMonths = entry.repeat === 'yearly' ? Math.max(24, 12 * (entry.repeat_interval ?? 1) + 12) : 24,
): Date | null {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  for (let i = 0; i <= maxMonths; i++) {
    const probe = new Date(start.getFullYear(), start.getMonth() + i, 1)
    const hits = occurrencesInMonth(entry, probe.getFullYear(), probe.getMonth() + 1)
      .filter((d) => d.getTime() >= start.getTime())
      .sort((a, b) => a.getTime() - b.getTime())
    if (hits.length) return hits[0]
  }
  return null
}

/**
 * 여러 항목을 한 달치로 펼쳐 날짜순으로 정렬한다.
 * 반복 항목은 그 달에 실제로 찍히는 날짜로 바뀌어 나온다.
 * 달력 그리드와 아래 목록이 같은 결과를 보게 하려고 한 곳에 모아둔다.
 */
export function expandMonth<T extends EntryLike>(
  entries: T[],
  year: number,
  month: number,
): Array<{ date: Date; entry: T }> {
  const out: Array<{ date: Date; entry: T }> = []
  for (const entry of entries) {
    for (const date of occurrencesInMonth(entry, year, month)) out.push({ date, entry })
  }
  out.sort((a, b) => a.date.getTime() - b.date.getTime())
  return out
}

/**
 * 항목이 지정된 양력 월(year, month 1-based)에 표시될 날짜들.
 * 보통 0개 또는 1개를 돌려준다.
 */
const DAY_MS = 24 * 60 * 60 * 1000

/** b - a 를 날짜 수로. 서머타임이 없어도 반올림해 두면 자정 경계에서 안전하다. */
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS)
}

/** n칸마다 반복일 때 기준에서 k칸 떨어진 곳이 해당하는지. 기준보다 앞도 대칭으로 본다(매년 생일처럼). */
function onStep(k: number, n: number): boolean {
  return ((k % n) + n) % n === 0
}

export function occurrencesInMonth(entry: EntryLike, year: number, month: number): Date[] {
  if (entry.date_type === 'lunar' && entry.repeat === 'yearly') {
    const { lunar_month, lunar_day } = entry
    if (lunar_month == null || lunar_day == null) return []
    // 음력 해 Y는 양력 Y 2월경 ~ Y+1 2월경에 걸쳐 있다.
    // 따라서 양력 year에 나타나는 날짜는 음력 해 year-1 또는 year에서 나온다.
    const n = entry.repeat_interval ?? 1
    // n년마다면 음력 해 기준으로 센다. 기준 해는 저장된 양력 기준일의 음력 해.
    const baseLunarYear = n > 1 ? solarToLunar(parseISODate(entry.event_date))?.year : undefined
    const found: Date[] = []
    for (const lunarYear of [year - 1, year]) {
      if (baseLunarYear !== undefined && !onStep(lunarYear - baseLunarYear, n)) continue
      const d = lunarToSolarClamped(lunarYear, lunar_month, lunar_day)
      if (d && d.getFullYear() === year && d.getMonth() === month - 1) found.push(d)
    }
    return found
  }

  const base = parseISODate(entry.event_date)
  const n = entry.repeat_interval ?? 1

  switch (entry.repeat) {
    case 'none':
      return base.getFullYear() === year && base.getMonth() === month - 1 ? [base] : []
    case 'yearly':
      if (base.getMonth() !== month - 1) return []
      if (!onStep(year - base.getFullYear(), n)) return []
      return [new Date(year, month - 1, Math.min(base.getDate(), lastDayOfMonth(year, month)))]
    case 'monthly':
      if (!onStep((year - base.getFullYear()) * 12 + (month - 1 - base.getMonth()), n)) return []
      return [new Date(year, month - 1, Math.min(base.getDate(), lastDayOfMonth(year, month)))]
    case 'daily':
    case 'weekly': {
      // 매일·매주는 기준일부터 앞으로만 — 지난 날짜까지 끝없이 채우면 달력이 덮인다
      const step = n * (entry.repeat === 'weekly' ? 7 : 1)
      const first = new Date(year, month - 1, 1)
      const last = new Date(year, month - 1, lastDayOfMonth(year, month))
      const fromDay = Math.max(0, daysBetween(base, first))
      const out: Date[] = []
      for (let k = Math.ceil(fromDay / step) * step; ; k += step) {
        const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + k)
        if (d > last) break
        out.push(d)
      }
      return out
    }
  }
}
