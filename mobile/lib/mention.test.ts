import { describe, expect, it } from 'vitest'
import { completeMention, mentionedIds, mentionQuery } from './mention'

const people = [
  { id: 'a', name: '엄마', avatar_url: null },
  { id: 'b', name: '아빠', avatar_url: null },
]

describe('mention', () => {
  it('글 끝의 @만 검색어로 본다', () => {
    expect(mentionQuery('저녁 @엄')).toBe('엄')
    expect(mentionQuery('@')).toBe('')
    expect(mentionQuery('저녁 @엄마 ')).toBeNull()
    expect(mentionQuery('메일 a@b')).toBeNull()
  })
  it('고르면 @이름 뒤에 한 칸 띄운다', () => {
    expect(completeMention('저녁 @엄', '엄마')).toBe('저녁 @엄마 ')
  })
  it('글에 남아 있는 이름만 부른다', () => {
    expect(mentionedIds(people, '@엄마 @아빠 저녁')).toEqual(['a', 'b'])
    expect(mentionedIds(people, '엄마랑 저녁')).toEqual([])
  })
})
