import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { errorMessage } from '../../src/lib/errors'
import { signInWithKakao } from '../lib/useAuth'
import { lift, radius, useColors } from '../lib/theme'
import { ErrorText, Eyebrow } from './ui'

export default function Login() {
  const c = useColors()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start(signIn: () => Promise<void>, fallback: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await signIn()
    } catch (e) {
      setError(errorMessage(e, fallback))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        padding: 32,
        backgroundColor: c.bg,
      }}
    >
      <Eyebrow>가족·친구와 함께</Eyebrow>

      <Text style={{ fontSize: 52, fontWeight: '500', letterSpacing: -3, color: c.fg }}>
        우리 달력
      </Text>

      <Text style={{ maxWidth: 320, textAlign: 'center', color: c.muted, fontSize: 15, lineHeight: 25 }}>
        음력 생신도, 제사도 매년 알아서 자리를 찾아갑니다.
      </Text>

      <Pressable
        onPress={() => void start(signInWithKakao, '로그인하지 못했어요')}
        disabled={busy}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            marginTop: 14,
            backgroundColor: '#fee500',
            borderRadius: radius.pill,
            paddingLeft: 24,
            paddingRight: 10,
            paddingVertical: 10,
            opacity: busy ? 0.6 : 1,
            transform: [{ scale: pressed ? 0.975 : 1 }],
          },
          lift(c),
        ]}
      >
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#191600', letterSpacing: -0.3 }}>
          {busy ? '카카오로 이동 중…' : '카카오로 시작하기'}
        </Text>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.09)',
          }}
        >
          <Text style={{ fontSize: 14, color: '#191600' }}>↗</Text>
        </View>
      </Pressable>

      {error && <ErrorText style={{ textAlign: 'center' }}>{error}</ErrorText>}
    </View>
  )
}
