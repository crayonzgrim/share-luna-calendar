import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { WEEKDAY_LABELS } from '../../src/lib/calendar'
import { ENTRY_ICONS, findIcon } from '../../src/lib/icons'
import { solarToLunar } from '../../src/lib/lunar'
import { occurrencesInYear, parseISODate } from '../../src/lib/recurrence'
import type { EntryWithAuthor } from '../../src/lib/types'
import { eventColor, lift, radius, useColors } from '../lib/theme'
import { byTime, formatTime } from '../lib/time'
import { repeatLabel } from '../lib/repeat'
import { Badge, NavBtn } from './ui'

type Props = {
  entries: EntryWithAuthor[]
  onJump: (d: Date) => void
}

/** 종류 없는 항목을 거를 때 쓰는 값. 실제 key와 겹치지 않게 둔다. */
const NONE = ' none'

type Row = { entry: EntryWithAuthor; date: Date | null }

export default function EntryList({ entries, onJump }: Props) {
  const c = useColors()
  const [year, setYear] = useState(new Date().getFullYear())
  // 빈 배열 = 전체. 칩을 한 줄씩 늘어놓으면 종류가 여덟이라 화면이 칩으로 덮인다.
  const [types, setTypes] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)

  const rows: Row[] = entries
    .map((entry) => {
      const dates = occurrencesInYear(entry, year)
      // 매월 반복을 12줄로 늘어놓으면 목록이 묻힌다. 첫 날짜만 대표로 쓴다.
      return { entry, date: dates[0] ?? null }
    })
    .filter((r) => r.date !== null || r.entry.repeat !== 'none')
    .sort(byDate)

  // 실제로 있는 종류만 선택지로 — 골라도 빈 목록인 항목은 만들지 않는다
  const present = new Set(rows.map((r) => r.entry.icon ?? NONE))
  const options = [
    ...ENTRY_ICONS.filter((i) => present.has(i.key)).map((i) => ({
      key: i.key,
      label: `${i.emoji} ${i.label}`,
    })),
    ...(present.has(NONE) ? [{ key: NONE, label: '종류 없음' }] : []),
  ]

  const shown = types.length === 0 ? rows : rows.filter((r) => types.includes(r.entry.icon ?? NONE))
  const thisYear = new Date().getFullYear()

  function toggleType(key: string) {
    setTypes((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const pickerLabel =
    types.length === 0
      ? '종류'
      : types.length === 1
        ? (options.find((o) => o.key === types[0])?.label ?? '종류 1개')
        : `종류 ${types.length}개`

  return (
    <View style={{ marginTop: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <NavBtn label="‹" size={32} onPress={() => setYear(year - 1)} accessibilityLabel="이전 해" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 112 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: c.fg, letterSpacing: -0.5 }}>
            {year}년 일정
          </Text>
          {rows.length > 0 && (
            <View style={{ backgroundColor: c.shell, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '500', color: c.muted }}>{rows.length}</Text>
            </View>
          )}
        </View>
        <NavBtn label="›" size={32} onPress={() => setYear(year + 1)} accessibilityLabel="다음 해" />

        {/* 종류 고르기 — 되돌리기 버튼 왼쪽에 붙는다 */}
        {options.length > 1 && (
          <Pressable
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`종류 고르기, 현재 ${types.length === 0 ? '모든 종류' : pickerLabel}`}
            style={({ pressed }) => ({
              marginLeft: 'auto',
              flexShrink: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: radius.pill,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: types.length > 0 ? c.accent : c.shellLine,
              backgroundColor: types.length > 0 ? c.accentSoft : pressed ? c.surface : c.shell,
            })}
          >
            <Text
              numberOfLines={1}
              style={{ fontSize: 12, fontWeight: '500', color: types.length > 0 ? c.accentStrong : c.muted }}
            >
              {pickerLabel}
            </Text>
            <Text style={{ fontSize: 10, color: types.length > 0 ? c.accentStrong : c.faint }}>▾</Text>
          </Pressable>
        )}

        {/* 다른 해를 보고 있을 때만 — 줄 맨 오른쪽에서 되돌린다 */}
        {year !== thisYear && (
          <View style={{ marginLeft: options.length > 1 ? 0 : 'auto' }}>
            <NavBtn
              label="↺"
              size={32}
              onPress={() => setYear(thisYear)}
              accessibilityLabel={`올해(${thisYear}년)로`}
            />
          </View>
        )}
      </View>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPickerOpen(false)}
      >
        {/* 바깥을 누르면 닫힌다 — 고른 값은 누를 때마다 바로 반영된다 */}
        <Pressable
          onPress={() => setPickerOpen(false)}
          style={{ flex: 1, backgroundColor: c.scrim, justifyContent: 'center', padding: 28 }}
        >
          <Pressable
            onPress={() => {}}
            style={[
              { backgroundColor: c.surface, borderRadius: radius.shell, padding: 8 },
              lift(c, true),
            ]}
          >
            <TypeRow label="모든 종류" on={types.length === 0} onPress={() => setTypes([])} />
            <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line, marginVertical: 4 }} />
            {options.map((o) => (
              <TypeRow
                key={o.key}
                label={o.label}
                on={types.includes(o.key)}
                onPress={() => toggleType(o.key)}
              />
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {shown.length === 0 ? (
        <Text style={{ paddingVertical: 24, textAlign: 'center', color: c.faint, fontSize: 14 }}>
          {rows.length === 0 ? `${year}년에는 일정이 없어요` : '고른 종류의 일정이 없어요'}
        </Text>
      ) : (
        shown.map(({ entry, date }) => {
          const ico = findIcon(entry.icon)
          const lunar = date ? solarToLunar(date) : null
          // 날짜 칸은 좁게 — 반복 표시는 오른쪽 배지로 옮겨 내용이 폭을 가장 많이 쓴다
          const note = lunar ? `음력 ${lunar.month}.${lunar.day}` : ''
          return (
            <Pressable
              key={entry.id}
              disabled={!date}
              onPress={() => date && onJump(date)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
                paddingVertical: 11,
                paddingHorizontal: 10,
                borderRadius: radius.field,
                opacity: date ? 1 : 0.5,
                backgroundColor: pressed && date ? c.shell : 'transparent',
              })}
            >
              <View style={{ width: 80, flexShrink: 0 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: c.fg, letterSpacing: -0.35 }}>
                  {date
                    ? `${date.getMonth() + 1}월 ${date.getDate()}일`
                    : // 음력 변환은 2050년까지만 가능하다
                      '계산 범위 밖'}
                </Text>
                <Text numberOfLines={1} style={{ fontSize: 10.5, color: c.muted }}>
                  {date ? [WEEKDAY_LABELS[date.getDay()], note].filter(Boolean).join(' · ') : note}
                </Text>
                {entry.event_time && (
                  <Text style={{ fontSize: 10.5, fontWeight: '600', color: c.accentStrong, marginTop: 1 }}>
                    {formatTime(entry.event_time)}
                  </Text>
                )}
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: radius.pill,
                      marginRight: 7,
                      backgroundColor: eventColor(entry.icon, c),
                    }}
                  />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: c.fg, letterSpacing: -0.3 }}>
                    {ico ? `${ico.emoji} ` : ''}
                    {entry.title}
                  </Text>
                  {entry.date_type === 'lunar' && <Badge label="음력" tone="lunar" />}
                  {entry.repeat !== 'none' && (
                    <Badge
                      label={
                        entry.repeat === 'monthly' && (entry.repeat_interval ?? 1) === 1
                          ? `매월 ${parseISODate(entry.event_date).getDate()}일`
                          : repeatLabel(entry.repeat, entry.repeat_interval)
                      }
                    />
                  )}
                </View>
                {entry.memo && (
                  <Text numberOfLines={2} style={{ marginTop: 3, fontSize: 13, color: c.muted }}>
                    {entry.memo}
                  </Text>
                )}
              </View>

              <Text
                numberOfLines={1}
                style={{ flexShrink: 1, maxWidth: 60, fontSize: 11, color: c.faint, paddingTop: 2 }}
              >
                {entry.author?.name ?? ''}
              </Text>
            </Pressable>
          )
        })
      )}
    </View>
  )
}

/** 종류 고르기 한 줄. 여러 개를 켤 수 있고 다시 누르면 꺼진다. */
function TypeRow({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 11,
        paddingHorizontal: 12,
        borderRadius: radius.field,
        backgroundColor: pressed ? c.shell : 'transparent',
      })}
    >
      <Text
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: on ? '600' : '400',
          color: on ? c.accentStrong : c.fg,
        }}
      >
        {label}
      </Text>
      {on && <Text style={{ fontSize: 14, color: c.accentStrong }}>✓</Text>}
    </Pressable>
  )
}

/** 그 해 날짜순. 날짜가 없는(매월) 항목은 맨 뒤. */
function byDate(a: Row, b: Row): number {
  // 같은 날이면 종일 먼저, 그다음 이른 시각부터
  if (a.date && b.date) return a.date.getTime() - b.date.getTime() || byTime(a.entry, b.entry)
  if (a.date) return -1
  if (b.date) return 1
  return a.entry.title.localeCompare(b.entry.title, 'ko')
}
