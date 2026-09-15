import { useEffect, useState } from 'react'
import * as Linking from 'expo-linking'
import * as WebBrowser from 'expo-web-browser'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

/** 웹의 src/lib/useAuth.ts와 같다. 세션 저장소만 supabase 쪽에서 갈린다. */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  return { session, user: session?.user ?? null, loading }
}

/**
 * 웹은 카카오 페이지로 아예 이동했다가 돌아오지만, 앱에는 이동할 주소창이 없다.
 * 대신 시스템 인증 브라우저를 띄우고(iOS ASWebAuthenticationSession / 안드로이드 Custom Tabs)
 * sharecalendar:// 로 돌아온 URL에서 code를 꺼내 세션으로 바꾼다.
 *
 * 이 redirectTo는 Supabase Dashboard > Authentication > URL Configuration의
 * Redirect URLs에 등록돼 있어야 한다.
 */
export async function signInWithKakao(): Promise<void> {
  const redirectTo = Linking.createURL('/auth-callback')
  // ponytail: 임시 — Supabase Redirect URLs에 등록한 값과 같은지 눈으로 확인하려고 찍는다
  console.log('[auth] redirectTo =', redirectTo)

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: { redirectTo, skipBrowserRedirect: true },
  })
  if (error) throw error
  if (!data.url) throw new Error('로그인 주소를 받지 못했어요')

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
  // 사용자가 그냥 닫은 경우 — 에러가 아니라 취소다.
  if (result.type !== 'success') return

  const code = new URL(result.url).searchParams.get('code')
  if (!code) throw new Error('로그인 코드를 받지 못했어요')

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) throw exchangeError
}

/**
 * 임시 — 카카오 없이 화면을 둘러보려고 익명 세션을 만든다.
 *
 * 가짜 세션이 아니라 진짜 auth.uid()가 생기므로 RLS가 정상 동작하고,
 * handle_new_user 트리거가 프로필('이름없음')까지 만들어줘서
 * 그룹 생성·일정 추가가 실제로 다 된다.
 *
 * 동작하려면 Supabase Dashboard > Authentication > Sign In / Providers에서
 * Anonymous sign-ins를 켜야 한다.
 *
 * ponytail: 카카오 로그인 왕복이 확인되면 이 함수와 Login의 버튼을 함께 지운다.
 */
export async function signInAnonymously(): Promise<void> {
  const { error } = await supabase.auth.signInAnonymously()
  if (error) throw error
}

export function signOut() {
  return supabase.auth.signOut()
}
