import { describe, it, expect } from 'vitest'
import { errorMessage } from './errors'

describe('errorMessage', () => {
  it('Error의 메시지를 그대로 쓴다', () => {
    expect(errorMessage(new Error('터졌어요'), '기본')).toBe('터졌어요')
  })

  it('Supabase 에러 객체에서 원인을 뽑아낸다', () => {
    // PostgrestError는 Error 인스턴스가 아니다 — 이걸 놓쳐서 원인이 사라졌었다
    const pgError = {
      message: 'column "icon" of relation "entries" does not exist',
      details: null,
      hint: null,
      code: '42703',
    }
    expect(errorMessage(pgError, '기본')).toBe(
      'column "icon" of relation "entries" does not exist (42703)',
    )
  })

  it('hint가 있으면 함께 보여준다', () => {
    expect(errorMessage({ message: '권한 없음', hint: 'GRANT가 필요합니다' }, '기본'))
      .toBe('권한 없음 — GRANT가 필요합니다')
  })

  it('알아볼 수 없으면 기본 문구', () => {
    expect(errorMessage(null, '저장하지 못했어요')).toBe('저장하지 못했어요')
    expect(errorMessage({}, '저장하지 못했어요')).toBe('저장하지 못했어요')
    expect(errorMessage(undefined, '저장하지 못했어요')).toBe('저장하지 못했어요')
  })
})
