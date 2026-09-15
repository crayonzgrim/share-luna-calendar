import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import DayPanel from '../components/DayPanel'
import EntryList from '../components/EntryList'
import GroupSwitcher from '../components/GroupSwitcher'
import MonthGrid from '../components/MonthGrid'
import Segmented from '../components/Segmented'
import { CenterMsg, ErrorText, Eyebrow, Loading, NavBtn, Pill } from '../components/ui'
import { isSameDay, shiftMonth } from '../../src/lib/calendar'
import { useEntries } from '../../src/lib/useEntries'
import { signOut, useAuth } from '../lib/useAuth'
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

  if (groupsLoading) return <Loading />

  if (groups.length === 0) {
    return (
      <CenterMsg>
        <Eyebrow>시작하기</Eyebrow>
        <Text style={{ textAlign: 'center', color: c.muted, fontSize: 15, lineHeight: 25 }}>
          아직 속한 그룹이 없어요.{'\n'}달력을 함께 볼 그룹을 만들어 보세요.
        </Text>
        <Pressable
          onPress={() => router.push('/groups')}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: c.accentStrong,
              borderRadius: radius.pill,
              paddingLeft: 22,
              paddingRight: 9,
              paddingVertical: 9,
              transform: [{ scale: pressed ? 0.975 : 1 }],
            },
            lift(c),
          ]}
        >
          <Text style={{ color: c.accentFg, fontSize: 15, fontWeight: '600' }}>그룹 만들기</Text>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.22)',
            }}
          >
            <Text style={{ color: c.accentFg, fontSize: 14 }}>↗</Text>
          </View>
        </Pressable>
        {groupsError && <ErrorText>{groupsError}</ErrorText>}
      </CenterMsg>
    )
  }

  const problem = groupsError ?? entriesError

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
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
        <GroupSwitcher groups={groups} selectedId={selectedId} onSelect={select} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pill label="그룹" onPress={() => router.push('/groups')} />
          <Pill label="로그아웃" onPress={() => void signOut()} />
        </View>
      </View>

      {tab === 'calendar' ? (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 9, marginTop: 4, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginRight: 'auto' }}>
              <Text style={{ fontSize: 13, color: c.faint }}>{year}</Text>
              <Text style={{ fontSize: 38, fontWeight: '500', letterSpacing: -2.2, color: c.fg }}>
                {month}
              </Text>
              <Text style={{ fontSize: 15, color: c.muted }}>월</Text>
            </View>
            <NavBtn label="‹" size={34} onPress={() => move(-1)} accessibilityLabel="이전 달" />
            {/* 점 대신 오늘 날짜 — 눌러 오늘로 돌아온다 */}
            <NavBtn
              label={String(today.getDate())}
              size={34}
              onPress={goToday}
              accessibilityLabel={`오늘(${today.getMonth() + 1}월 ${today.getDate()}일)로`}
            />
            <NavBtn label="›" size={34} onPress={() => move(1)} accessibilityLabel="다음 달" />
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

      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSheetOpen(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          {/* 바깥을 누르면 닫힌다 — 안드로이드 뒤로가기는 onRequestClose가 받는다 */}
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]}
            onPress={() => setSheetOpen(false)}
            accessibilityLabel="닫기"
          />
          <View
            style={{
              maxHeight: '88%',
              backgroundColor: c.surface,
              borderTopLeftRadius: radius.shell,
              borderTopRightRadius: radius.shell,
              paddingBottom: insets.bottom,
            }}
          >
            <View
              style={{
                alignSelf: 'center',
                width: 38,
                height: 4,
                borderRadius: radius.pill,
                backgroundColor: c.shellLine,
                marginTop: 10,
              }}
            />
            <ScrollView keyboardShouldPersistTaps="handled">
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
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View
        style={{
          alignItems: 'center',
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: c.shellLine,
        }}
      >
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'calendar', label: '달력' },
            { value: 'list', label: '일정 목록' },
          ]}
        />
      </View>
    </View>
  )
}
