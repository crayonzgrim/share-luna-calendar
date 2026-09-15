import { Platform, useColorScheme } from 'react-native'

/**
 * 밝은 Slate 중성 + Indigo 프라이머리 (Material 3 톤). 앱 전용이다 —
 * 웹(src/index.css)의 에메랄드 계열과 더 이상 1:1이 아니니 한쪽만 고쳐도 된다.
 *
 * 색 순서: 중성이 화면 구조를 잡고, Indigo는 누를 것·오늘·선택에만 쓴다.
 * 일정 색은 EVENT_COLORS로 따로 뺐다 — Primary와 경쟁하면 무엇이 강조인지 안 읽힌다.
 * 본문·보조 텍스트는 배경 대비 WCAG AA를 넘긴다(faint 4.5:1, muted 7.5:1).
 * Slate-400(#94a3b8)은 2.4:1밖에 안 나와 비활성 표시에만 쓰고 텍스트로는 안 쓴다.
 */
const light = {
  bg: '#f8fafc',
  surface: '#ffffff',
  shell: '#f1f5f9',
  shellLine: '#e2e8f0',
  fg: '#0f172a',
  muted: '#475569',
  faint: '#5f6b7d',
  line: '#e2e8f0',
  /** 테두리·표시선 전용. 글자나 흰 글씨 받침으로 쓰면 대비가 4.5:1에 못 미친다. */
  accent: '#6366f1',
  /** 액센트 글자와 채워진 버튼은 이걸 쓴다 — 흰 글씨 6.3:1, 흰 배경 위 글씨 6.3:1. */
  accentStrong: '#4f46e5',
  accentSoft: '#eef2ff',
  accentFg: '#ffffff',
  danger: '#dc2626',
  sunday: '#dc2626',
  saturday: '#2563eb',
  shadow: '#0f172a',
  scrim: 'rgba(15, 23, 42, 0.45)',
}

/** 반전이 아니라 다시 짠 관계 — bg < surface < shell 순으로 떠오르고, Indigo는 밝은 쪽으로 옮긴다 */
const dark: typeof light = {
  bg: '#0b1220',
  surface: '#151c2c',
  shell: '#1b2334',
  shellLine: '#2b3648',
  fg: '#e8edf7',
  muted: '#a5b2c6',
  faint: '#8593a8',
  line: '#2b3648',
  accent: '#818cf8',
  accentStrong: '#818cf8',
  accentSoft: 'rgba(129, 140, 248, 0.18)',
  accentFg: '#0b1220',
  danger: '#f87171',
  sunday: '#f87171',
  saturday: '#7da9f9',
  shadow: '#000000',
  scrim: 'rgba(2, 6, 16, 0.6)',
}

/**
 * 일정 색은 종류(icon key)에서 뽑는다 — DB에 색 칸을 만들지 않아도 구분이 생긴다.
 * 종류가 없는 일정은 중성색. 색은 점·왼쪽 바로만 쓰고 면을 채우지 않는다(달력이 무지개가 된다).
 */
const EVENT_COLORS: Record<string, string> = {
  birthday: '#ec4899',
  memorial: '#6366f1',
  wedding: '#a855f7',
  celebrate: '#f97316',
  travel: '#06b6d4',
  hospital: '#ef4444',
  meal: '#22c55e',
  money: '#f59e0b',
}

export function eventColor(iconKey: string | null | undefined, colors: Colors): string {
  return (iconKey && EVENT_COLORS[iconKey]) || colors.faint
}

export type Colors = typeof light

/**
 * 웹(--r-shell 28 / --r-core 22)의 절반. 앱에서는 그만큼 둥글면 과했다.
 * core는 shell - BEZEL이어야 안쪽 모서리가 바깥과 같은 중심을 돈다.
 */
export const radius = { shell: 14, core: 8, pill: 999, field: 14, chip: 12 } as const
export const BEZEL = 6

/**
 * 웹의 --lift. RN에는 다중 그림자가 없어 큰 쪽 하나만 남긴다.
 * 안드로이드는 elevation만 먹으므로 색·번짐을 세밀하게 맞출 수 없다.
 */
export function lift(colors: Colors, strong = false) {
  return Platform.select({
    ios: {
      shadowColor: colors.shadow,
      shadowOpacity: strong ? 0.18 : 0.12,
      shadowRadius: strong ? 28 : 12,
      shadowOffset: { width: 0, height: strong ? 12 : 4 },
    },
    default: { elevation: strong ? 6 : 2 },
  })
}

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light
}

