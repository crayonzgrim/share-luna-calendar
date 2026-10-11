import { Appearance } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import Login from '../components/Login'
import { Loading } from '../components/ui'
import { useAuth } from '../lib/useAuth'
import { useColors } from '../lib/theme'
import { DEMO } from '../lib/demo'

// 라이트 고정 — 날짜 선택 창·알림창 같은 네이티브 창용. 앱 화면 색은 useColors가 따로 고정한다.
// 토글을 만들 때 둘을 같은 설정값으로 함께 바꿀 것.
Appearance.setColorScheme('light')

export default function RootLayout() {
  const c = useColors()
  const { user, loading } = useAuth()

  return (
    <SafeAreaProvider>
      {/* 배경이 늘 밝으니 상태바 아이콘은 늘 어둡게 — auto면 기기 다크 모드에서 흰 아이콘이 묻힌다 */}
      <StatusBar style="dark" />
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
