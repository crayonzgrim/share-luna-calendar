/**
 * 일정 종류. DB에는 key만 저장하고 이모지·라벨은 여기서 매핑한다.
 * 이모지를 직접 저장하지 않는 이유: 나중에 이모지를 바꾸면 기존 일정도 함께 바뀌고,
 * 화면 낭독기에 읽어줄 한글 이름이 필요하기 때문이다.
 */
export type EntryIcon = {
  key: string
  emoji: string
  /** 전체 이름. title 속성과 화면 낭독기에 쓴다. */
  label: string
  /** 버튼에 보이는 짧은 이름. 좁은 칸에서 잘리지 않도록 최대 3글자. */
  short: string
}

export const ENTRY_ICONS: EntryIcon[] = [
  { key: 'birthday', emoji: '🎂', label: '생일', short: '생일' },
  { key: 'memorial', emoji: '🕯️', label: '제사', short: '제사' },
  { key: 'wedding', emoji: '💍', label: '결혼기념일', short: '결혼' },
  { key: 'celebrate', emoji: '🎉', label: '기념일', short: '기념일' },
  { key: 'travel', emoji: '✈️', label: '여행', short: '여행' },
  { key: 'hospital', emoji: '🏥', label: '병원', short: '병원' },
  { key: 'meal', emoji: '🍚', label: '모임', short: '모임' },
  { key: 'money', emoji: '💰', label: '납부', short: '납부' },
]

const BY_KEY = new Map(ENTRY_ICONS.map((i) => [i.key, i]))

/** 저장된 key로 아이콘을 찾는다. 없는 key(프리셋에서 뺀 뒤 남은 예전 일정)면 null. */
export function findIcon(key: string | null | undefined): EntryIcon | null {
  return key ? (BY_KEY.get(key) ?? null) : null
}
