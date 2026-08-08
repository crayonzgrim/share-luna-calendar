import { describe, it, expect } from 'vitest'
import { lunarToSolar, lunarToSolarClamped, solarToLunar } from './lunar'

describe('lunarToSolar', () => {
  it('설날(음력 1/1)을 그 해의 양력 날짜로 변환한다', () => {
    expect(lunarToSolar(2026, 1, 1)).toEqual(new Date(2026, 1, 17)) // 2026-02-17
    expect(lunarToSolar(2027, 1, 1)).toEqual(new Date(2027, 1, 7)) // 2027-02-07
    expect(lunarToSolar(2028, 1, 1)).toEqual(new Date(2028, 0, 27)) // 2028-01-27 (1월로 당겨짐)
  })

  it('음력 12월 일정은 다음 양력 해로 넘어간다', () => {
    expect(lunarToSolar(2026, 12, 15)).toEqual(new Date(2027, 0, 22)) // 2027-01-22
  })

  it('윤달은 평달과 다른 날짜로 변환된다', () => {
    expect(lunarToSolar(2025, 6, 10, false)).toEqual(new Date(2025, 6, 4)) // 2025-07-04
    expect(lunarToSolar(2025, 6, 10, true)).toEqual(new Date(2025, 7, 3)) // 2025-08-03 (윤6월)
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
      year: 2026,
      month: 1,
      day: 1,
      isLeap: false,
    })
  })

  it('연초 양력은 전년도 음력에 속한다', () => {
    expect(solarToLunar(new Date(2026, 0, 1))).toEqual({
      year: 2025,
      month: 11,
      day: 13,
      isLeap: false,
    })
  })
})
