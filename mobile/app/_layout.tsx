import { Appearance } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import Login from '../components/Login'
import { Loading } from '../components/ui'
import { useAuth } from '../lib/useAuth'
import { useColors } from '../lib/theme'
import { DEMO } from '../lib/demo'

// ponytail: 지금은 라이트 고정. 설정 화면이 생기면 저장된 값을 여기 넘기면 된다
// ('dark', 또는 기기 설정을 따라가려면 null). useColors가 이 값을 그대로 읽는다.
Appearance.setColorScheme('light')

export default function RootLayout() {
  const c = useColors()
  const { user, loading } = useAuth()

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {/* ponytail: 임시 — DEMO면 로그인을 건너뛴다. lib/demo.ts 참고 */}
      {!DEMO && loading ? (
        <Loading />
      ) : !DEMO && !user ? (
        // 웹과 같은 규칙: 비로그인 상태에서는 어떤 경로로 들어와도 로그인 화면.
        // 앱은 화면을 떠나지 않고 인증 브라우저만 띄웠다 닫으므로, 초대 링크로 들어왔다면
        // 로그인 직후 그 화면이 그대로 이어진다.
        <Login />
      ) : (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: c.bg },
            animation: 'slide_from_right',
          }}
        />
      )}
    </SafeAreaProvider>
  )
}
