import { useRef, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { radius, useColors } from '../lib/theme'

const ITEM_H = 40
const VISIBLE = 5 // 가운데 한 칸이 선택, 위아래 두 칸씩 미리 보인다
const PAD = ((VISIBLE - 1) / 2) * ITEM_H

const AMPM = ['오전', '오후']
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1)) // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

/**
 * 삼성 캘린더식 시간 고르기 — 오전/오후 · 시 · 분 세 줄을 위아래로 굴린다.
 * value/onChange는 'HH:MM'(24시간).
 *
 * ponytail: 삼성처럼 끝없이 도는 바퀴는 아니다(12시 다음에 1시로 이어지지 않는다). 아쉬우면 목록을 3벌 이어 붙여 가운데로 되돌리면 된다.
 */
export default function TimeWheel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const c = useColors()
  const [h24, m] = value.split(':').map(Number)
  const pm = h24 >= 12 ? 1 : 0
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12

  function set(next: { pm?: number; h12?: number; m?: number }) {
    const P = next.pm ?? pm
    const H = next.h12 ?? h12
    const M = next.m ?? m
    const hh = (H % 12) + (P ? 12 : 0)
    onChange(`${String(hh).padStart(2, '0')}:${String(M).padStart(2, '0')}`)
  }

  return (
    // 시트의 끌어내리기가 바퀴 굴리기를 가로채지 않게, 여기서 시작한 터치는 위로 올려보내지 않는다
    <View
      onTouchStart={(e) => e.stopPropagation()}
      style={{ flexDirection: 'row', height: ITEM_H * VISIBLE, justifyContent: 'center' }}
    >
      {/* 가운데 선택 띠 */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: PAD,
          height: ITEM_H,
          borderRadius: radius.chip,
          backgroundColor: c.accentSoft,
        }}
      />
      <Column items={AMPM} index={pm} onPick={(i) => set({ pm: i })} width={72} label="오전 오후" />
      <Column items={HOURS} index={h12 - 1} onPick={(i) => set({ h12: i + 1 })} width={64} label="시" />
      <Text style={{ alignSelf: 'center', fontSize: 20, fontWeight: '600', color: c.fg }}>:</Text>
      <Column items={MINUTES} index={m} onPick={(i) => set({ m: i })} width={64} label="분" />
    </View>
  )
}

function Column({
  items,
  index,
  onPick,
  width,
  label,
}: {
  items: string[]
  index: number
  onPick: (i: number) => void
  width: number
  label: string
}) {
  const c = useColors()
  // 굴리는 동안 가운데 글자를 진하게 — 놓기 전에도 무엇이 골라질지 보인다
  const [live, setLive] = useState(index)
  const last = useRef(index)

  function pick(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)))
    setLive(i)
    if (i !== last.current) {
      last.current = i
      onPick(i)
    }
  }

  return (
    <ScrollView
      style={{ width }}
      contentContainerStyle={{ paddingVertical: PAD }}
      contentOffset={{ x: 0, y: index * ITEM_H }}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      scrollEventThrottle={16}
      onScroll={(e) => setLive(Math.round(e.nativeEvent.contentOffset.y / ITEM_H))}
      // 휙 굴리면 momentum 끝에서, 천천히 놓으면 drag 끝에서 정해진다 — 둘 다 받는다
      onMomentumScrollEnd={pick}
      onScrollEndDrag={pick}
      accessibilityLabel={`${label} ${items[live] ?? ''}`}
    >
      {items.map((t, i) => (
        <View key={t} style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
          <Text
            style={{
              fontSize: i === live ? 20 : 17,
              fontWeight: i === live ? '600' : '400',
              color: i === live ? c.accentStrong : c.faint,
            }}
          >
            {t}
          </Text>
        </View>
      ))}
    </ScrollView>
  )
}
