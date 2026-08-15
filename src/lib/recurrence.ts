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
