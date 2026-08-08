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
