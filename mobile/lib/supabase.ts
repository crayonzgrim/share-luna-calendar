import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { AppState } from 'react-native'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY가 없습니다. .env.example을 참고해 .env.local을 만드세요.',
  )
}

export const supabase = createClient(url, publishableKey, {
  auth: {
    // 웹은 브라우저 저장소를 알아서 쓰지만 네이티브에는 그런 게 없다.
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    // 주소창이 없으니 URL에서 세션을 주워 담을 일도 없다.
    detectSessionInUrl: false,
    // 앱에는 클라이언트 시크릿을 숨길 곳이 없다. PKCE가 네이티브의 정답.
    flowType: 'pkce',
  },
})

// 백그라운드에서는 토큰 갱신 타이머를 멈춘다.
// 안 멈추면 잠긴 화면 뒤에서 계속 깨어나 배터리를 먹고, 실패한 갱신이 쌓인다.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
})
