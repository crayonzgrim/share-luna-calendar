import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { buildMonthGrid, isSameDay, WEEKDAY_LABELS } from '../../src/lib/calendar'
import { findIcon } from '../../src/lib/icons'
import { solarToLunar } from '../../src/lib/lunar'
import { expandMonth } from '../../src/lib/recurrence'
import type { EntryWithAuthor } from '../../src/lib/types'
import { eventColor, radius, useColors } from '../lib/theme'
import { Shell } from './ui'

type Props = {
  year: number
  month: number
  entries: EntryWithAuthor[]
  selected: Date
  onSelect: (d: Date) => void
}

/** 웹은 CSS grid 42칸이지만 RN에는 grid가 없다. 7칸씩 6줄로 나눠 flex로 채운다. */
const ROWS = 6
const COLS = 7
/** 요일 머리글은 높이를 고정해야 남은 높이를 6으로 나눌 수 있다 */
const HEADER_H = 32

export default function MonthGrid({ year, month, entries, selected, onSelect }: Props) {
  const c = useColors()
  const cells = buildMonthGrid(year, month)
  const today = new Date()

  // 칸은 남은 높이를 6등분해 늘어난다. 실제 높이를 재야 제목을 몇 줄 넣을지 정할 수 있다.
  const [gridH, setGridH] = useState(0)
  const rowH = gridH ? (gridH - HEADER_H) / ROWS : 0
  const maxTitles = rowH >= 108 ? 4 : rowH >= 88 ? 3 : 2

  // 웹과 같은 전개 결과를 쓴다 — 달력과 아래 목록이 어긋나지 않게 expandMonth를 공유한다.
  const byDate = new Map<string, EntryWithAuthor[]>()
  for (const { date, entry } of expandMonth(entries, year, month)) {
    const key = date.toDateString()
    const list = byDate.get(key)
    if (list) list.push(entry)
    else byDate.set(key, [entry])
  }

  return (
    <Shell fill>
      <View style={{ flex: 1 }} onLayout={(e) => setGridH(e.nativeEvent.layout.height)}>
      <View
        style={{
          height: HEADER_H,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: c.line,
        }}
      >
        {WEEKDAY_LABELS.map((label, i) => (
          <Text
            key={label}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 11,
              fontWeight: '600',
              letterSpacing: 1.1,
              color: i === 0 ? c.sunday : i === 6 ? c.saturday : c.faint,
            }}
          >
            {label}
          </Text>
        ))}
      </View>

      {Array.from({ length: ROWS }, (_, row) => (
        <View key={row} style={{ flex: 1, flexDirection: 'row' }}>
          {cells.slice(row * COLS, row * COLS + COLS).map((date, col) => {
            const inMonth = date.getMonth() === month - 1
            const lunar = solarToLunar(date)
            const dayEntries = byDate.get(date.toDateString()) ?? []
            const isToday = isSameDay(date, today)
            const isSelected = isSameDay(date, selected)
            const dayColor = col === 0 ? c.sunday : col === 6 ? c.saturday : c.fg

            return (
              <Pressable
                key={date.toDateString()}
                onPress={() => onSelect(date)}
                accessibilityRole="button"
                accessibilityLabel={`${date.getMonth() + 1}월 ${date.getDate()}일, 일정 ${dayEntries.length}건`}
                style={{
                  flex: 1,
                  minWidth: 0,
                  paddingTop: 5,
                  paddingHorizontal: 3,
                  paddingBottom: 4,
                  borderRightWidth: col === COLS - 1 ? 0 : StyleSheet.hairlineWidth,
                  borderRightColor: c.line,
                  borderBottomWidth: row === ROWS - 1 ? 0 : StyleSheet.hairlineWidth,
                  borderBottomColor: c.line,
                  backgroundColor: isSelected ? c.accentSoft : 'transparent',
                  opacity: inMonth ? 1 : 0.32,
                }}
              >
                {/* 웹의 .cell.selected::after — 선택 칸을 감싸는 얇은 테두리 */}
                {isSelected && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      borderWidth: 1.5,
                      borderColor: c.accent,
                    }}
                  />
                )}

                {/* 음력을 날짜 옆에 붙여 제목 줄을 하나 더 확보한다 */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <View
                    style={{
                      minWidth: 21,
                      height: 21,
                      borderRadius: radius.pill,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isToday ? c.accentStrong : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12.5,
                        fontWeight: '600',
                        color: isToday ? c.accentFg : dayColor,
                      }}
                    >
                      {date.getDate()}
                    </Text>
                  </View>
                  {lunar && (
                    <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 8.5, color: c.faint }}>
                      {lunar.month}.{lunar.day}
                    </Text>
                  )}
                </View>

                {/* 삼성 기본 캘린더처럼 제목을 한 줄씩 — 넘치면 잘라내고 +N으로 센다 */}
                <View style={{ marginTop: 2, gap: 1.5 }}>
                  {dayEntries.slice(0, maxTitles).map((e) => {
                    const ico = findIcon(e.icon)
                    return (
                      <View
                        key={e.id}
                        style={{
                          borderRadius: 4,
                          paddingLeft: 4,
                          paddingRight: 3,
                          paddingVertical: 1,
                          backgroundColor: c.shell,
                          // 종류색은 왼쪽 바에만 — 칸을 색으로 채우면 달력이 무지개가 된다
                          borderLeftWidth: 2.5,
                          borderLeftColor: eventColor(e.icon, c),
                        }}
                      >
                        <Text numberOfLines={1} style={{ fontSize: 9.5, lineHeight: 12, color: c.fg }}>
                          {ico ? `${ico.emoji} ` : ''}
                          {e.title}
                        </Text>
                      </View>
                    )
                  })}
                  {dayEntries.length > maxTitles && (
                    <Text style={{ fontSize: 9, color: c.faint, paddingHorizontal: 3 }}>
                      +{dayEntries.length - maxTitles}
                    </Text>
                  )}
                </View>
              </Pressable>
            )
          })}
        </View>
      ))}
      </View>
    </Shell>
  )
}
