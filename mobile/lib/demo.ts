import { useCallback, useState } from 'react'
import type { EntryPatch, NewEntry } from '../../src/lib/api'
import type { EntryWithAuthor, Group, Profile } from '../../src/lib/types'

/**
 * ponytail: 임시 — 카카오 로그인 없이 화면을 확인하려는 데모 모드.
 *
 * 로그인만 건너뛰면 세션이 없어 Supabase가 anon 역할로 막는다
 * (RLS 정책도 GRANT도 전부 authenticated 대상이다). 그래서 데이터까지 함께 끼워넣는다.
 * 저장은 메모리에만 남고 앱을 끄면 사라진다.
 *
 * 카카오 로그인이 확인되면 이 파일과 아래 세 곳의 참조를 지운다:
 *   app/_layout.tsx · app/index.tsx · app/groups.tsx
 */
export const DEMO = false

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001'

const ME = { name: '나', avatar_url: null }
const OTHER = { name: '김서연', avatar_url: null }
const OTHER_ID = '00000000-0000-4000-8000-000000000002'

const GROUPS: Group[] = [
  { id: 'demo-group-1', name: '우리 가족', invite_code: 'a1b2c3d4e5f6', created_by: DEMO_USER_ID },
  { id: 'demo-group-2', name: '친구들', invite_code: 'f6e5d4c3b2a1', created_by: DEMO_USER_ID },
]

const MEMBERS: Record<string, Profile[]> = {
  'demo-group-1': [
    { id: DEMO_USER_ID, name: '나', avatar_url: null },
    { id: OTHER_ID, name: '김서연', avatar_url: null },
  ],
  'demo-group-2': [{ id: DEMO_USER_ID, name: '나', avatar_url: null }],
}

/**
 * 음력 날짜는 korean-lunar-calendar로 실제 변환한 값이다 (2026년 기준).
 * 지어낸 값을 넣으면 달력에 엉뚱한 자리에 찍혀 검증이 무의미해진다.
 */
const ENTRIES: EntryWithAuthor[] = [
  entry({
    id: 'e1', title: '할아버지 제사', icon: 'memorial',
    date_type: 'lunar', repeat: 'yearly',
    event_date: '2026-08-27', lunar_month: 7, lunar_day: 15,
    memo: '저녁 7시, 큰집에서', author: ME,
  }),
  entry({
    id: 'e2', title: '어머니 생신', icon: 'birthday',
    date_type: 'lunar', repeat: 'yearly',
    event_date: '2026-08-15', lunar_month: 7, lunar_day: 3,
    author: ME,
  }),
  entry({
    id: 'e3', title: '아버지 생신', icon: 'birthday',
    date_type: 'lunar', repeat: 'yearly',
    event_date: '2026-08-02', lunar_month: 6, lunar_day: 20,
    author: OTHER, author_id: OTHER_ID,
  }),
  entry({
    id: 'e4', title: '결혼기념일', icon: 'wedding',
    date_type: 'solar', repeat: 'yearly', event_date: '2020-08-22',
    memo: '올해로 6주년', author: ME,
  }),
  entry({
    id: 'e5', title: '관리비 납부', icon: 'money',
    date_type: 'solar', repeat: 'monthly', event_date: '2026-08-25',
    author: ME,
  }),
  entry({
    id: 'e6', title: '제주도 여행', icon: 'travel',
    date_type: 'solar', repeat: 'none', event_date: '2026-08-19',
    memo: '2박 3일\n숙소 예약 완료', author: ME,
  }),
  entry({
    id: 'e7', title: '치과 정기검진', icon: 'hospital',
    date_type: 'solar', repeat: 'none', event_date: '2026-08-11',
    author: OTHER, author_id: OTHER_ID,
  }),
  // 종류를 안 고른 항목 — 목록의 '종류 없음' 필터와 달력의 점 표시를 확인한다
  entry({
    id: 'e8', title: '도서관 책 반납', icon: null,
    date_type: 'solar', repeat: 'none', event_date: '2026-08-16',
    author: ME,
  }),
]

function entry(o: {
  id: string
  title: string
  icon: string | null
  date_type: 'solar' | 'lunar'
  repeat: 'none' | 'yearly' | 'monthly'
  event_date: string
  lunar_month?: number
  lunar_day?: number
  memo?: string
  author: { name: string; avatar_url: string | null }
  author_id?: string
}): EntryWithAuthor {
  return {
    id: o.id,
    group_id: 'demo-group-1',
    author_id: o.author_id ?? DEMO_USER_ID,
    title: o.title,
    memo: o.memo ?? null,
    icon: o.icon,
    date_type: o.date_type,
    repeat: o.repeat,
    event_date: o.event_date,
    lunar_month: o.lunar_month ?? null,
    lunar_day: o.lunar_day ?? null,
    is_leap_month: false,
    created_at: '2026-08-01T00:00:00Z',
    author: o.author,
  }
}

export function demoMembers(groupId: string): Profile[] {
  return MEMBERS[groupId] ?? []
}

/** useGroups와 같은 모양. 화면 쪽에서 갈아끼우기만 하면 되도록 맞췄다. */
export function useDemoGroups() {
  const [selectedId, setSelectedId] = useState<string | null>(GROUPS[0].id)
  const [groups, setGroups] = useState<Group[]>(GROUPS)

  const select = useCallback((id: string) => setSelectedId(id), [])
  const reload = useCallback(async () => {}, [])
  const addGroup = useCallback((name: string) => {
    const created: Group = {
      id: `demo-group-${GROUPS.length + 1}`,
      name,
      invite_code: `demo${String(GROUPS.length + 1).padStart(8, '0')}`,
      created_by: DEMO_USER_ID,
    }
    // 모듈 배열에도 넣어야 달력 화면으로 돌아갔을 때 새 그룹이 보인다.
    // 화면마다 이 훅이 따로 상태를 들기 때문이다.
    GROUPS.push(created)
    setGroups([...GROUPS])
  }, [])

  const renameGroup = useCallback((id: string, name: string) => {
    const i = GROUPS.findIndex((g) => g.id === id)
    if (i >= 0) GROUPS[i] = { ...GROUPS[i], name }
    setGroups([...GROUPS])
  }, [])

  return { groups, selectedId, select, loading: false, error: null, reload, addGroup, renameGroup }
}

/** useEntries와 같은 모양. 저장은 메모리에만 남는다. */
export function useDemoEntries(groupId: string | null) {
  const [entries, setEntries] = useState<EntryWithAuthor[]>(ENTRIES)
  const [seq, setSeq] = useState(100)

  const add = useCallback(
    async (e: NewEntry) => {
      const id = `demo-${seq}`
      setSeq((n) => n + 1)
      setEntries((prev) => [
        ...prev,
        { ...e, id, created_at: new Date().toISOString(), author: ME },
      ])
    },
    [seq],
  )

  const edit = useCallback(async (id: string, patch: EntryPatch) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }, [])

  const remove = useCallback(async (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const reload = useCallback(async () => {}, [])

  return {
    entries: entries.filter((e) => e.group_id === groupId),
    loading: false,
    error: null,
    add,
    edit,
    remove,
    reload,
  }
}
