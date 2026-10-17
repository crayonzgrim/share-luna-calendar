import { useEffect, useState } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { errorMessage } from '../../src/lib/errors'
import { ErrorText, NavBtn, SectionLabel, Shell } from '../components/ui'
import { signOut, useAuth } from '../lib/useAuth'
import { disableMentionPush, enableMentionPush, mentionPushOn } from '../lib/push'
import { radius, useColors } from '../lib/theme'

const TAP = 44

export default function SettingsScreen() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()
  // null = 아직 기기에서 읽는 중
  const [on, setOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    void mentionPushOn().then(setOn)
  }, [])

  async function toggle(next: boolean) {
    if (!user || busy) return
    setBusy(true)
    setError(null)
    setDenied(false)
    try {
      if (next) {
        const granted = await enableMentionPush(user.id)
        setOn(granted)
        setDenied(!granted)
      } else {
        await disableMentionPush(user.id)
        setOn(false)
      }
    } catch (err) {
      setError(errorMessage(err, '알림 설정을 바꾸지 못했어요'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4 }}>
        <NavBtn label="‹" size={TAP} onPress={() => router.back()} accessibilityLabel="달력으로 돌아가기" />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 48 }}>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 30, fontWeight: '500', letterSpacing: -1.4, color: c.fg, marginTop: 6 }}
        >
          설정
        </Text>

        <SectionLabel>알림</SectionLabel>

        <Shell>
          <View style={{ padding: 16, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: TAP }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: c.fg }}>나를 부르면 알림</Text>
              <Switch
                value={!!on}
                disabled={on === null || busy}
                onValueChange={(v) => void toggle(v)}
                trackColor={{ false: c.shellLine, true: c.accent }}
                thumbColor={c.surface}
                accessibilityLabel="나를 부르면 알림"
              />
            </View>
            <Text style={{ fontSize: 13, lineHeight: 19, color: c.muted }}>
              가족이 일정에 @로 나를 부르면 휴대폰에 알려줘요.
            </Text>
            {denied && (
              // 한 번 거부하면 앱이 다시 물을 수 없다 — 시스템 설정으로 보낸다
              <Pressable onPress={() => void Linking.openSettings()} accessibilityRole="button">
                <Text style={{ fontSize: 13, lineHeight: 19, color: c.danger }}>
                  휴대폰 설정에서 알림을 허용해 주세요. 눌러서 열기 ›
                </Text>
              </Pressable>
            )}
            {error && <ErrorText>{error}</ErrorText>}
          </View>
        </Shell>

        <View style={{ marginTop: 48, alignItems: 'center' }}>
          <Pressable
            onPress={() => void signOut()}
            accessibilityRole="button"
            style={({ pressed }) => ({
              minHeight: TAP,
              justifyContent: 'center',
              paddingHorizontal: 20,
              borderRadius: radius.pill,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: c.shellLine,
              backgroundColor: pressed ? c.surface : c.shell,
            })}
          >
            <Text style={{ fontSize: 14, fontWeight: '500', color: c.muted }}>로그아웃</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}
