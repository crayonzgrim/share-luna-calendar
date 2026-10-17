import { useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import DayPanel from '../components/DayPanel'
import EntryList from '../components/EntryList'
import GroupSwitcher from '../components/GroupSwitcher'
import NewGroupForm from '../components/NewGroupForm'
import MonthGrid from '../components/MonthGrid'
import Sheet from '../components/Sheet'
import type { SheetHandle } from '../components/Sheet'
import { CenterMsg, ErrorText, Eyebrow, Loading, NavBtn, Pill } from '../components/ui'
import { isSameDay, shiftMonth } from '../../src/lib/calendar'
import { createGroup } from '../../src/lib/api'
import { useEntries } from '../../src/lib/useEntries'
import { useAuth } from '../lib/useAuth'
import { useGroups } from '../lib/useGroups'
import { DEMO, DEMO_USER_ID, useDemoEntries, useDemoGroups } from '../lib/demo'
import { lift, radius, useColors } from '../lib/theme'

export default function CalendarScreen() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()

  // ponytail: 임시 — DEMO면 메모리 데이터로 갈아끼운다. 훅은 둘 다 호출해야 순서가 안 깨진다.
  const realGroups = useGroups(!DEMO && !!user)
  const demoGroups = useDemoGroups()
  const { groups, selectedId, select, loading: groupsLoading, error: groupsError } =
    DEMO ? demoGroups : realGroups

  const realEntries = useEntries(DEMO ? null : selectedId)
  const demoEntries = useDemoEntries(selectedId)
  const { entries, add, edit, remove, error: entriesError } = DEMO ? demoEntries : realEntries

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [selected, setSelected] = useState(today)
  // 한 화면에 달력과 연간 목록을 같이 쌓으면 달력이 눌린다. 탭으로 갈라 달력에 화면을 준다.
  const [tab, setTab] = useState<'calendar' | 'list'>('calendar')
  // 그 날 상세는 달력 밑에 깔지 않고 시트로 띄운다. 밑에 두면 달력이 줄고 상세도 잘린다.
  const [sheetOpen, setSheetOpen] = useState(false)
  const sheet = useRef<SheetHandle>(null)

  function move(delta: number) {
    const [y, m] = shiftMonth(year, month, delta)
    setYear(y)
    setMonth(m)
  }

  // 첫 터치는 날짜만 고른다 — 이미 고른 날을 한 번 더 눌러야 상세가 열린다
  function openDay(d: Date) {
    if (isSameDay(d, selected)) setSheetOpen(true)
    else setSelected(d)
  }

  function jumpTo(d: Date) {
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
    setSelected(d)
    setTab('calendar')
  }

  function goToday() {
    const now = new Date()
    setYear(now.getFullYear())
    setMonth(now.getMonth() + 1)
    setSelected(now)
  }

  // 그룹을 새로 만들고 그쪽으로 옮긴다. 그룹 선택 창과 첫 화면이 같이 쓴다.
  async function newGroup(name: string) {
    if (DEMO) {
      demoGroups.addGroup(name)
      return
    }
    if (!user) return
    const g = await createGroup(name, user.id)
    await realGroups.reload()
    select(g.id)
  }

  // 목록을 다시 불러올 때마다 화면 전체를 로딩으로 덮으면 깜빡인다 — 처음 한 번만
  if (groupsLoading && groups.length === 0) return <Loading />

  if (groups.length === 0) {
    return (
      <CenterMsg>
        <Eyebrow>시작하기</Eyebrow>
        <Text style={{ textAlign: 'center', color: c.muted, fontSize: 15, lineHeight: 25 }}>
          아직 속한 그룹이 없어요.{'\n'}달력을 함께 볼 그룹을 만들어 보세요.
        </Text>
        <View style={{ alignSelf: 'stretch', paddingHorizontal: 8 }}>
          <NewGroupForm onCreate={newGroup} />
        </View>
        {/* 초대받은 사람은 만들 필요 없이 코드로 들어온다 */}
        <Pill label="초대 코드가 있어요" onPress={() => router.push('/groups')} />
        {groupsError && <ErrorText>{groupsError}</ErrorText>}
      </CenterMsg>
    )
  }

  const problem = groupsError ?? entriesError

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* 웹의 sticky .topbar — 스크롤과 무관하게 자리를 지킨다 */}
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginHorizontal: 16,
            marginTop: 8,
            paddingVertical: 5,
            paddingHorizontal: 6,
            borderRadius: radius.pill,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: c.shellLine,
            backgroundColor: c.surface,
          },
          lift(c),
        ]}
      >
        <GroupSwitcher groups={groups} selectedId={selectedId} onSelect={select} onCreate={newGroup} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* 달력/일정 목록 전환 — 지금 화면이 아니라 '누르면 갈 화면' 이름을 보여준다.
              목록 화면에선 진보라로 채워 '지금 목록 보는 중'이 한눈에 보이게 한다 */}
          <Pill
            label={tab === 'calendar' ? '일정 목록' : '달력'}
            tone={tab === 'calendar' ? 'soft' : 'solid'}
            onPress={() => setTab(tab === 'calendar' ? 'list' : 'calendar')}
            accessibilityLabel={tab === 'calendar' ? '일정 목록으로 보기' : '달력으로 돌아가기'}
          />
          <Pill label="그룹" onPress={() => router.push('/groups')} />
          {/* 로그아웃은 설정 안으로 — 자주 누를 일이 없고 막대가 좁다 */}
          <Pill label="설정" onPress={() => router.push('/settings')} />
        </View>
      </View>

      {tab === 'calendar' ? (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          {/* 좌우 화살표는 월을 감싼다 — 옮기는 대상이 월이라는 게 바로 보이게.
              오늘 버튼은 오른쪽에 따로 둔다 (가운데 끼어 있으면 화살표가 '일'을 옮기는 것처럼 읽힌다) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 4, marginBottom: 12 }}>
            <NavBtn label="‹" size={34} onPress={() => move(-1)} accessibilityLabel="이전 달" />
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={{ fontSize: 13, color: c.faint }}>{year}</Text>
              <Text style={{ fontSize: 38, fontWeight: '500', letterSpacing: -2.2, color: c.fg }}>
                {month}
              </Text>
              <Text style={{ fontSize: 15, color: c.muted }}>월</Text>
            </View>
            <NavBtn label="›" size={34} onPress={() => move(1)} accessibilityLabel="다음 달" />
            {/* 점 대신 오늘 날짜 — 눌러 오늘로 돌아온다 */}
            <View style={{ marginLeft: 'auto' }}>
              <NavBtn
                label={String(today.getDate())}
                size={34}
                onPress={goToday}
                accessibilityLabel={`오늘(${today.getMonth() + 1}월 ${today.getDate()}일)로`}
              />
            </View>
          </View>

          {problem && <ErrorText style={{ marginBottom: 10 }}>{problem}</ErrorText>}

          <MonthGrid
            year={year}
            month={month}
            entries={entries}
            selected={selected}
            onSelect={openDay}
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          {problem && <ErrorText style={{ marginTop: 12 }}>{problem}</ErrorText>}
          <EntryList entries={entries} onJump={jumpTo} />
        </ScrollView>
      )}

      <Sheet ref={sheet} visible={sheetOpen} onClose={() => setSheetOpen(false)}>
              {/* 날짜가 바뀌면 새로 마운트해 열려 있던 폼과 입력값을 비운다 */}
              <DayPanel
                key={selected.toDateString()}
                date={selected}
                groupId={selectedId}
                userId={DEMO ? DEMO_USER_ID : (user?.id ?? '')}
                entries={entries}
                onAdd={add}
                onEdit={edit}
                onDelete={remove}
                onMoved={jumpTo}
                onFormOpen={() => sheet.current?.expand()}
              />
      </Sheet>

    </View>
  )
}
