import { Redirect } from 'expo-router'

/**
 * 카카오에서 돌아오는 `sharecalendar://auth-callback` 딥링크가 도착하는 곳.
 *
 * 세션 교환은 signInWithKakao가 인증 브라우저 결과에서 이미 끝낸다. 그런데 안드로이드는
 * 그 복귀 URL을 딥링크로도 한 번 더 앱에 던지고, expo-router는 받을 라우트가 없으면
 * "Unmatched Route" 화면을 띄운다. 그래서 여기서 달력으로 돌려보내기만 한다.
 */
export default function AuthCallback() {
  return <Redirect href="/" />
}
