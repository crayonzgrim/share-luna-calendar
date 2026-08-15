import { describe, it, expect } from 'vitest'
import {
  expandMonth,
  occurrencesInMonth,
  parseISODate,
  lastDayOfMonth,
  toISODate,
} from './recurrence'
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

describe('toISODate', () => {
  it('한 자리 월/일을 0으로 채운다', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toISODate(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('parseISODate와 왕복한다', () => {
    expect(parseISODate(toISODate(new Date(2026, 7, 15)))).toEqual(new Date(2026, 7, 15))
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
    expect(occurrencesInMonth(birthday, 2026, 5)).toEqual([new Date(2026, 4, 1)]) // 2026-05-01
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
      date_type: 'lunar',
      repeat: 'yearly',
      event_date: '2027-01-22',
      lunar_month: 12,
      lunar_day: 15,
    })
    expect(occurrencesInMonth(e, 2027, 1)).toEqual([new Date(2027, 0, 22)])
    expect(occurrencesInMonth(e, 2026, 2)).toEqual([new Date(2026, 1, 2)]) // 음력 2025/12/15
  })

  it('설날(음력 1/1)은 해에 따라 1월에도 2월에도 나타난다', () => {
    const e = entry({
      date_type: 'lunar',
      repeat: 'yearly',
      event_date: '2026-02-17',
      lunar_month: 1,
      lunar_day: 1,
    })
    expect(occurrencesInMonth(e, 2026, 2)).toEqual([new Date(2026, 1, 17)])
    expect(occurrencesInMonth(e, 2028, 1)).toEqual([new Date(2028, 0, 27)])
    expect(occurrencesInMonth(e, 2028, 2)).toEqual([])
  })

  it('30일이 없는 달이면 29일로 내려서 표시한다', () => {
    const e = entry({
      date_type: 'lunar',
      repeat: 'yearly',
      event_date: '2026-04-16',
      lunar_month: 2,
      lunar_day: 30,
    })
    expect(occurrencesInMonth(e, 2026, 4)).toEqual([new Date(2026, 3, 16)])
  })

  it('음력 월/일이 비어 있으면 아무것도 표시하지 않는다', () => {
    const e = entry({ date_type: 'lunar', repeat: 'yearly', lunar_month: null, lunar_day: null })
    expect(occurrencesInMonth(e, 2026, 8)).toEqual([])
  })

  it('지원 범위를 벗어난 해는 조용히 비운다', () => {
    expect(occurrencesInMonth(birthday, 2060, 4)).toEqual([])
  })
})

describe('expandMonth', () => {
  it('여러 항목을 날짜순으로 펼친다', () => {
    const late = entry({ event_date: '2026-08-25' })
    const early = entry({ event_date: '2026-08-03' })
    const mid = entry({ repeat: 'monthly', event_date: '2026-01-10' })

    const got = expandMonth([late, early, mid], 2026, 8)
    expect(got.map((o) => o.date.getDate())).toEqual([3, 10, 25])
  })

  it('그 달에 없는 항목은 빠진다', () => {
    const other = entry({ event_date: '2026-09-01' })
    expect(expandMonth([other], 2026, 8)).toEqual([])
  })

  it('음력 반복도 전개되어 섞여 정렬된다', () => {
    const solar = entry({ event_date: '2026-05-20' })
    const lunarYearly = entry({
      date_type: 'lunar', repeat: 'yearly',
      event_date: '2026-05-01', lunar_month: 3, lunar_day: 15,
    })
    const got = expandMonth([solar, lunarYearly], 2026, 5)
    expect(got.map((o) => o.date.getDate())).toEqual([1, 20])
  })
})

describe('occurrencesInMonth — 음력 일회성', () => {
  it('저장된 양력 날짜를 그대로 쓴다', () => {
    const e = entry({
      date_type: 'lunar',
      repeat: 'none',
      event_date: '2026-05-01',
      lunar_month: 3,
      lunar_day: 15,
    })
    expect(occurrencesInMonth(e, 2026, 5)).toEqual([new Date(2026, 4, 1)])
    expect(occurrencesInMonth(e, 2027, 4)).toEqual([])
  })
})
