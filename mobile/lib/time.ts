import type { Entry } from '../../src/lib/types'

/** 'HH:MM[:SS]' → 정렬용 분. 종일 일정은 -1이라 그 날 맨 앞에 온다. */
export function timeKey(e: Pick<Entry, 'event_time'>): number {
  if (!e.event_time) return -1
  const [h, m] = e.event_time.split(':').map(Number)
  return h * 60 + m
}

/** 같은 날 안에서의 순서 — 종일 먼저, 그다음 이른 시각부터 */
export function byTime(a: Pick<Entry, 'event_time'>, b: Pick<Entry, 'event_time'>): number {
  return timeKey(a) - timeKey(b)
}

/** '15:30:00' → '오후 3:30' */
export function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h < 12 ? '오전' : '오후'} ${h12}:${String(m).padStart(2, '0')}`
}
