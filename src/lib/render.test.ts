import { describe, it, expect } from 'vitest'
import { buildMonthGrid } from './calendar'
import { occurrencesInMonth } from './recurrence'
import type { EntryLike } from './recurrence'

/**
 * MonthGrid가 실제로 하는 일: 42칸을 만들고, 각 항목을 전개해 칸에 매칭한다.
 * 개별 함수가 맞아도 조합이 틀리면(그리드 밖 날짜에 매칭 등) 화면이 깨지므로 여기서 묶어 검증한다.
 */
function cellsWithEntry(entry: EntryLike, year: number, month: number): string[] {
  const grid = buildMonthGrid(year, month)
  const hits = new Set(occurrencesInMonth(entry, year, month).map((d) => d.toDateString()))
  return grid.filter((d) => hits.has(d.toDateString())).map((d) => d.toDateString())
}

const 어머니생신: EntryLike = {
  date_type: 'lunar',
  repeat: 'yearly',
  event_date: '2026-05-01',
  lunar_month: 3,
  lunar_day: 15,
}

describe('달력 렌더링 조합', () => {
  it('음력 매년 생신이 해마다 알맞은 칸 하나에 찍힌다', () => {
    expect(cellsWithEntry(어머니생신, 2026, 5)).toEqual([new Date(2026, 4, 1).toDateString()])
    expect(cellsWithEntry(어머니생신, 2027, 4)).toEqual([new Date(2027, 3, 21).toDateString()])
  })

  it('생신이 없는 달에는 아무 칸도 차지하지 않는다', () => {
    expect(cellsWithEntry(어머니생신, 2026, 6)).toEqual([])
  })

  it('전개된 날짜는 반드시 그 달 그리드 안에 존재한다', () => {
    // 그리드에 없는 날짜로 전개되면 항목이 조용히 사라진다 — 가장 위험한 실패 방식
    for (let year = 2025; year <= 2030; year++) {
      for (let month = 1; month <= 12; month++) {
        const occurrences = occurrencesInMonth(어머니생신, year, month)
        const grid = new Set(buildMonthGrid(year, month).map((d) => d.toDateString()))
        for (const o of occurrences) {
          expect(grid.has(o.toDateString())).toBe(true)
        }
      }
    }
  })

  it('음력 매년 항목은 한 해에 정확히 한 번만 나타난다', () => {
    for (let year = 2025; year <= 2030; year++) {
      const total = Array.from({ length: 12 }, (_, i) =>
        occurrencesInMonth(어머니생신, year, i + 1).length,
      ).reduce((a, b) => a + b, 0)
      expect(total).toBe(1)
    }
  })

  it('음력 12월 항목도 한 해에 한 번만 나타난다 (연말 경계)', () => {
    const 제사: EntryLike = {
      date_type: 'lunar',
      repeat: 'yearly',
      event_date: '2027-01-22',
      lunar_month: 12,
      lunar_day: 15,
    }
    for (let year = 2025; year <= 2030; year++) {
      const total = Array.from({ length: 12 }, (_, i) =>
        occurrencesInMonth(제사, year, i + 1).length,
      ).reduce((a, b) => a + b, 0)
      expect(total).toBe(1)
    }
  })
})
