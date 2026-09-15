import { useEffect, useState } from 'react'
import { Pressable, Text } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { joinGroupByCode } from '../../../src/lib/api'
import { errorMessage } from '../../../src/lib/errors'
import { CenterMsg, ErrorText, Loading } from '../../components/ui'
import { radius, useColors } from '../../lib/theme'

export default function JoinScreen() {
  const c = useColors()
  const { code } = useLocalSearchParams<{ code: string }>()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    joinGroupByCode(code)
      .then(() => router.replace('/'))
      .catch((e: unknown) => setError(errorMessage(e, '가입에 실패했어요')))
  }, [code])

  if (error) {
    return (
      <CenterMsg>
        <ErrorText style={{ textAlign: 'center' }}>{error}</ErrorText>
        <Pressable
          onPress={() => router.replace('/')}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 22,
            borderRadius: radius.pill,
            backgroundColor: c.accentStrong,
          }}
        >
          <Text style={{ color: c.accentFg, fontSize: 14, fontWeight: '600' }}>달력으로</Text>
        </Pressable>
      </CenterMsg>
    )
  }

  return <Loading text="그룹에 들어가는 중…" />
}
