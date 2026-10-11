import type { RepeatRule } from '../../src/lib/recurrence'

export const REPEAT_UNITS: { rule: Exclude<RepeatRule, 'none'>; unit: string; every: string }[] = [
  { rule: 'daily', unit: '일', every: '매일' },
  { rule: 'weekly', unit: '주', every: '매주' },
  { rule: 'monthly', unit: '개월', every: '매월' },
  { rule: 'yearly', unit: '년', every: '매년' },
]

/** '반복 안 함' / '매주' / '3일마다' */
export function repeatLabel(rule: RepeatRule, n = 1): string {
  if (rule === 'none') return '반복 안 함'
  const u = REPEAT_UNITS.find((x) => x.rule === rule)!
  return n > 1 ? `${n}${u.unit}마다` : u.every
}
