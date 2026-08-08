import { describe, it, expect } from 'vitest'
import { buildMonthGrid, isSameDay, shiftMonth, CELLS } from './calendar'

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

  it('그 달의 1일과 말일을 모두 포함한다', () => {
    for (let m = 1; m <= 12; m++) {
      const grid = buildMonthGrid(2026, m)
      const inMonth = grid.filter((d) => d.getMonth() === m - 1)
      expect(inMonth[0].getDate()).toBe(1)
      expect(inMonth[inMonth.length - 1].getDate()).toBe(new Date(2026, m, 0).getDate())
    }
  })
})

describe('shiftMonth', () => {
  it('연말/연초를 넘어간다', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual([2027, 1])
    expect(shiftMonth(2026, 1, -1)).toEqual([2025, 12])
  })

  it('같은 해 안에서 이동한다', () => {
    expect(shiftMonth(2026, 8, 1)).toEqual([2026, 9])
    expect(shiftMonth(2026, 8, -1)).toEqual([2026, 7])
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
