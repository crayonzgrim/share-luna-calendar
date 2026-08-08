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
