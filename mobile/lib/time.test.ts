import { describe, expect, it } from 'vitest'
import { byTime, formatTime } from './time'

describe('time', () => {
  it('종일이 먼저, 그다음 이른 시각부터', () => {
    const list = [{ event_time: '15:00:00' }, { event_time: null }, { event_time: '09:30:00' }]
    expect(list.sort(byTime).map((e) => e.event_time)).toEqual([null, '09:30:00', '15:00:00'])
  })
  it('오전/오후 12시 경계', () => {
    expect(formatTime('00:05:00')).toBe('오전 12:05')
    expect(formatTime('12:00:00')).toBe('오후 12:00')
    expect(formatTime('23:59')).toBe('오후 11:59')
  })
})
