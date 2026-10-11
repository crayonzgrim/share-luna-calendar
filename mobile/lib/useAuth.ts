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
  // 앞 슬래시를 붙이면 sharecalendar:///auth-callback(슬래시 3개)이 나온다.
  // Supabase는 등록된 문자열과 정확히 맞아야 통과시키므로 그대로면 Site URL로 떨어진다.
  const redirectTo = Linking.createURL('auth-callback')

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

export function signOut() {
  return supabase.auth.signOut()
}

/**
 * 계정 삭제. 내가 올린 사진 파일을 먼저 지우고(DB 함수는 Storage를 건드리지 않는다),
 * delete_my_account()로 계정·내 일정을 지운 뒤 이 기기의 세션만 정리한다.
 * 사진 경로는 {group_id}/{내 user_id}/... 라서 내 그룹마다 내 폴더를 비우면 된다.
 */
/** heirs: { 그룹 id: 다음 그룹장 user id } — 내가 만든 그룹마다 삭제 화면에서 고른 사람 */
export async function deleteAccount(userId: string, heirs: Record<string, string>): Promise<void> {
  const bucket = supabase.storage.from('entry-images')
  const { data: groups, error } = await supabase.from('groups').select('id')
  if (error) throw error
  for (const g of groups ?? []) {
    const folder = `${g.id}/${userId}`
    // ponytail: 한 번에 1000개까지 본다. 한 사람이 한 그룹에 사진을 1000장 넘게 올리면 남는다 — 그때 페이지를 넘길 것
    const { data: files } = await bucket.list(folder, { limit: 1000 })
    if (files?.length) await bucket.remove(files.map((f) => `${folder}/${f.name}`))
  }

  const { error: rpcError } = await supabase.rpc('delete_my_account', { heirs })
  if (rpcError) throw rpcError
  // 서버에서는 이미 사용자가 없다. 전역 로그아웃은 실패하니 이 기기 세션만 지운다
  await supabase.auth.signOut({ scope: 'local' })
}
