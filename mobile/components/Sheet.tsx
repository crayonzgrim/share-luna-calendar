import { useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { ReactNode, Ref } from 'react'
import { Animated, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { lift, radius, useColors } from '../lib/theme'

/** 접힌 시트에 보이는 높이. 일정 1개(사진 한 줄 포함)가 들어가는 높이로 맞췄다 — 일정 수와 상관없이 늘 같다. */
const PEEK = 360

export type SheetHandle = { expand: () => void }

/**
 * 아래에서 올라오는 시트. 두 단계로 멈춘다.
 * - 접힘: 처음 열린 모습. 높이가 PEEK로 고정이라 일정이 많아도 달력을 덜 가린다.
 * - 펼침: 위로 끌어 올리면 화면의 88%까지. 이때만 안쪽이 스크롤된다.
 * 손가락을 따라 움직이고, 놓으면 가장 가까운 단계(펼침/접힘/닫힘)로 붙는다. 휙 튕기면 그 방향 다음 단계로.
 * 접힌 상태에서 절반 넘게 내리면 닫힌다.
 *
 * 시트는 늘 펼친 높이로 그려 두고 translateY로 아래로 밀어 접는다 — 높이를 애니메이션하지 않는다.
 */
export default function Sheet({
  visible,
  onClose,
  children,
  ref,
}: {
  visible: boolean
  onClose: () => void
  children: ReactNode
  ref?: Ref<SheetHandle>
}) {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { height: winH } = useWindowDimensions()
  const fullH = Math.round(winH * 0.88)
  // 각 단계의 translateY. 0이 펼침, 커질수록 아래로 내려간다.
  const FULL = 0
  const PEEKED = Math.max(0, fullH - (PEEK + insets.bottom))
  const CLOSED = fullH

  const [y] = useState(() => new Animated.Value(PEEKED))
  const [expanded, setExpanded] = useState(false)
  const at = useRef(PEEKED)
  const scrollTop = useRef(0)
  // 애니메이션 끝 콜백에서 최신 onClose를 부르려고 ref로 든다
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  function snapTo(to: number) {
    at.current = to
    if (to === CLOSED) {
      Animated.timing(y, { toValue: CLOSED, duration: 180, useNativeDriver: true }).start(() => close.current())
      return
    }
    setExpanded(to === FULL)
    Animated.spring(y, { toValue: to, bounciness: 0, useNativeDriver: true }).start()
  }

  // 일정 추가·수정 폼은 접힌 높이에 다 안 들어간다 — 폼을 열면 바깥에서 펼친다
  useImperativeHandle(ref, () => ({ expand: () => snapTo(FULL) }))

  // 다시 열릴 때는 늘 접힌 모습부터. 닫힐 때 펼침 표시를 끈다 — 다음에 열면 접힌 채로 시작한다
  useEffect(() => {
    if (!visible) return
    at.current = PEEKED
    y.setValue(PEEKED)
    return () => setExpanded(false)
  }, [visible, y, PEEKED])

  // ponytail: PanResponder 대신 터치 이벤트를 직접 쓴다. RN 0.86 Modal 안에서는
  // PanResponder의 이동 판정(onMoveShouldSet*)이 아예 호출되지 않았다(갤럭시 S23에서 확인).
  const drag = useRef<{ startY: number; lastY: number; lastT: number; vy: number; on: boolean } | null>(null)

  function settle() {
    const d = drag.current
    drag.current = null
    if (!d?.on) return
    const pos = at.current + (d.lastY - d.startY)
    const stops = [FULL, PEEKED, CLOSED]
    let to = stops.reduce((best, s) => (Math.abs(s - pos) < Math.abs(best - pos) ? s : best))
    // 휙 튕기면 거리와 상관없이 그 방향의 다음 단계로
    if (d.vy > 1.2) to = stops.find((s) => s > at.current) ?? CLOSED
    if (d.vy < -1.2) to = [...stops].reverse().find((s) => s < at.current) ?? FULL
    snapTo(to)
  }

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* 바깥을 누르면 닫힌다 — 안드로이드 뒤로가기는 onRequestClose가 받는다.
            어둡게 덮지 않는다(달력이 그대로 보이게). 대신 시트에 그림자를 줘 경계를 잡는다. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
        <Animated.View
          onTouchStart={(e) => {
            const { pageY, timestamp } = e.nativeEvent
            drag.current = { startY: pageY, lastY: pageY, lastT: timestamp, vy: 0, on: false }
          }}
          onTouchMove={(e) => {
            const d = drag.current
            if (!d) return
            const { pageY, timestamp } = e.nativeEvent
            const dy = pageY - d.startY
            // 6 넘게 움직였을 때부터 시트를 끈다 — 살짝 누른 건 탭으로 둔다.
            // 펼친 상태에선 아래로, 그리고 목록이 맨 위일 때만 — 위로 미는 건 안쪽 스크롤 몫이다.
            if (!d.on) {
              if (Math.abs(dy) <= 6) return
              if (expanded && (dy < 0 || scrollTop.current > 0)) return
              d.on = true
            }
            if (timestamp > d.lastT) d.vy = (pageY - d.lastY) / (timestamp - d.lastT)
            d.lastY = pageY
            d.lastT = timestamp
            y.setValue(Math.max(FULL, at.current + dy))
          }}
          onTouchEnd={settle}
          onTouchCancel={settle}
          style={{
            height: fullH,
            backgroundColor: c.surface,
            borderTopLeftRadius: radius.shell,
            borderTopRightRadius: radius.shell,
            paddingBottom: insets.bottom,
            transform: [{ translateY: y }],
            ...lift(c, true),
          }}
        >
          {/* 손잡이 줄 — 손가락이 닿기 쉽게 가로 전체·높이 24. 펼친 상태에서 내용이 스크롤 중이면 여기를 잡고 내린다 */}
          <View style={{ height: 24, alignItems: 'center', justifyContent: 'center' }}>
            <View
              style={{
                width: 38,
                height: 4,
                borderRadius: radius.pill,
                backgroundColor: c.shellLine,
              }}
            />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            scrollEnabled={expanded}
            onScroll={(e) => (scrollTop.current = e.nativeEvent.contentOffset.y)}
            scrollEventThrottle={16}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}
