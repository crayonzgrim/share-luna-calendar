import { describe, it, expect } from 'vitest'
import { ENTRY_ICONS, findIcon } from './icons'

describe('findIcon', () => {
  it('저장된 key로 이모지와 라벨을 찾는다', () => {
    expect(findIcon('birthday')).toMatchObject({ emoji: '🎂', label: '생일' })
  })

  it('아이콘 없는 일정은 null', () => {
    expect(findIcon(null)).toBeNull()
    expect(findIcon(undefined)).toBeNull()
    expect(findIcon('')).toBeNull()
  })

  it('프리셋에서 사라진 key도 터지지 않고 null', () => {
    // 프리셋을 줄이면 예전 일정에 남아 있는 key가 여기로 들어온다
    expect(findIcon('this-was-removed')).toBeNull()
  })
})

describe('ENTRY_ICONS', () => {
  it('key가 중복되지 않는다', () => {
    const keys = ENTRY_ICONS.map((i) => i.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('버튼에 넣는 짧은 이름은 3글자 이하 (좁은 칸에서 잘리지 않게)', () => {
    for (const i of ENTRY_ICONS) {
      expect(i.short.length, `${i.key}의 short가 너무 김`).toBeLessThanOrEqual(3)
    }
  })
})
