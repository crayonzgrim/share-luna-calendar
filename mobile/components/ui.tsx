import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import type { StyleProp, TextStyle, ViewStyle } from 'react-native'
import { BEZEL, lift, radius, useColors } from '../lib/theme'

/**
 * 웹의 .shell > .core — 바깥 트레이 안에 코어가 들어앉는 이중 베젤
 * fill: 남은 높이를 채운다. 바깥과 코어 둘 다 flex를 줘야 사슬이 안 끊긴다.
 */
export function Shell({
  children,
  style,
  fill,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  fill?: boolean
}) {
  const c = useColors()
  return (
    <View
      style={[
        {
          flex: fill ? 1 : undefined,
          backgroundColor: c.shell,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.shellLine,
          borderRadius: radius.shell,
          padding: BEZEL,
        },
        lift(c),
        style,
      ]}
    >
      <View
        style={{
          flex: fill ? 1 : undefined,
          backgroundColor: c.surface,
          borderRadius: radius.core,
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  )
}

/** 웹의 .eyebrow — 대문자 자간 넓은 작은 태그 */
export function Eyebrow({ children }: { children: ReactNode }) {
  const c = useColors()
  return (
    <View
      style={{
        alignSelf: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: c.shellLine,
        backgroundColor: c.shell,
        borderRadius: radius.pill,
        paddingVertical: 5,
        paddingHorizontal: 12,
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: '500', letterSpacing: 1.8, color: c.muted }}>
        {children}
      </Text>
    </View>
  )
}

/** 웹의 .pill — 투명 배경 텍스트 버튼 */
/** tone: 없으면 글자만, soft는 연보라 바탕, solid는 진보라 바탕 — 상태가 바뀌는 버튼을 눈에 띄게 */
export function Pill({
  label,
  onPress,
  tone,
  accessibilityLabel,
}: {
  label: string
  onPress: () => void
  tone?: 'soft' | 'solid'
  accessibilityLabel?: string
}) {
  const c = useColors()
  const bg = tone === 'solid' ? c.accentStrong : tone === 'soft' ? c.accentSoft : 'transparent'
  const fg = tone === 'solid' ? c.accentFg : tone === 'soft' ? c.accentStrong : c.muted
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        borderRadius: radius.pill,
        paddingVertical: 7,
        paddingHorizontal: 14,
        backgroundColor: pressed && !tone ? c.shell : bg,
        opacity: pressed && tone ? 0.85 : 1,
      })}
    >
      <Text style={{ fontSize: 13, fontWeight: tone ? '600' : '500', color: fg }}>{label}</Text>
    </Pressable>
  )
}

/** 웹의 .nav-btn — 동그란 아이콘 버튼 */
export function NavBtn({
  label,
  onPress,
  size = 38,
  accessibilityLabel,
}: {
  label: string
  onPress: () => void
  size?: number
  accessibilityLabel: string
}) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: c.shellLine,
        backgroundColor: pressed ? c.surface : c.shell,
        transform: [{ scale: pressed ? 0.93 : 1 }],
      })}
    >
      <Text style={{ fontSize: size > 34 ? 17 : 14, color: c.muted, lineHeight: size }}>
        {label}
      </Text>
    </Pressable>
  )
}

/** 웹의 .badge / .badge--lunar */
/**
 * 작성자 프로필 사진. 사진이 없으면 이름 첫 글자를 띄운다.
 * 카카오 프로필 주소가 http://로 오는 경우가 있는데 안드로이드 릴리스 빌드는 평문 http를 막는다 —
 * 카카오 CDN은 https도 받으므로 바꿔서 쓴다.
 */
export function Avatar({ name, url, size = 18 }: { name?: string; url?: string | null; size?: number }) {
  const c = useColors()
  const box = { width: size, height: size, borderRadius: radius.pill, backgroundColor: c.shellLine }
  if (url) {
    return <Image source={{ uri: url.replace(/^http:\/\//, 'https://') }} style={box} />
  }
  return (
    <View style={[box, { alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ fontSize: size * 0.55, fontWeight: '600', color: c.muted }}>{name?.[0] ?? '?'}</Text>
    </View>
  )
}

export function Badge({ label, tone }: { label: string; tone?: 'lunar' }) {
  const c = useColors()
  const isLunar = tone === 'lunar'
  return (
    <View
      style={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: isLunar ? c.accentSoft : c.shellLine,
        backgroundColor: isLunar ? c.accentSoft : 'transparent',
        borderRadius: radius.pill,
        paddingHorizontal: 7,
        paddingVertical: 1,
        marginLeft: 5,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: '500',
          letterSpacing: 0.4,
          color: isLunar ? c.accentStrong : c.muted,
        }}
      >
        {label}
      </Text>
    </View>
  )
}

/** 웹의 .center-msg */
export function CenterMsg({ children }: { children: ReactNode }) {
  const c = useColors()
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: 32,
        backgroundColor: c.bg,
      }}
    >
      {children}
    </View>
  )
}

export function Loading({ text = '불러오는 중…' }: { text?: string }) {
  const c = useColors()
  return (
    <CenterMsg>
      <ActivityIndicator color={c.muted} />
      <Text style={{ color: c.muted, fontSize: 15 }}>{text}</Text>
    </CenterMsg>
  )
}

/** 웹의 .error */
export function ErrorText({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const c = useColors()
  return <Text style={[{ color: c.danger, fontSize: 13, lineHeight: 19 }, style]}>{children}</Text>
}

/** 웹의 .section-label */
export function SectionLabel({ children }: { children: ReactNode }) {
  const c = useColors()
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 1.5,
        color: c.faint,
        marginTop: 32,
        marginBottom: 12,
      }}
    >
      {children}
    </Text>
  )
}
