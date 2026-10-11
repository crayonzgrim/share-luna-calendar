// 이 파일은 mobile/에서도 그대로 쓴다. '@db'는 각 앱이 자기 supabase 클라이언트를
// 연결하는 통로다 — 웹은 vite.config.ts, 앱은 mobile/metro.config.js에서 이어준다.
import { supabase } from '@db'
import type { Entry, EntryWithAuthor, Group, Profile } from './types'

export async function fetchMyGroups(): Promise<Group[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, invite_code, created_by')
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function createGroup(name: string, userId: string): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .insert({ name, created_by: userId })
    .select('id, name, invite_code, created_by')
    .single()
  if (error) throw error
  return data
}

/**
 * 그룹 이름 변경. owner만 성공한다 — RLS의 "owner updates group" 정책이 막는다.
 * 화면에서 버튼을 숨기는 건 편의일 뿐이고 실제 차단은 DB가 한다.
 * owner가 아니면 업데이트된 행이 없어 .single()이 에러를 낸다.
 */
export async function updateGroupName(id: string, name: string): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .update({ name })
    .eq('id', id)
    .select('id, name, invite_code, created_by')
    .single()
  if (error) throw error
  return data
}

export async function joinGroupByCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_group_by_code', { code })
  if (error) throw error
  return data as string
}

export async function fetchGroupMembers(groupId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('profiles(id, name, avatar_url)')
    .eq('group_id', groupId)
  if (error) throw error
  return (data ?? []).flatMap((row) => (row.profiles ?? []) as unknown as Profile)
}

export async function fetchEntries(groupId: string): Promise<EntryWithAuthor[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('*, author:profiles(name, avatar_url)')
    .eq('group_id', groupId)
    .order('created_at')
  if (error) throw error
  return (data ?? []) as unknown as EntryWithAuthor[]
}

export type NewEntry = Omit<Entry, 'id' | 'created_at'>

export async function createEntry(entry: NewEntry): Promise<EntryWithAuthor> {
  const { data, error } = await supabase
    .from('entries')
    .insert(entry)
    .select('*, author:profiles(name, avatar_url)')
    .single()
  if (error) throw error
  return data as unknown as EntryWithAuthor
}

/** 수정 가능한 항목. 날짜 관련 필드는 뺀다 — 날짜를 바꾸려면 지우고 다시 만든다. */
export type EntryPatch = Pick<Entry, 'title' | 'memo' | 'icon' | 'repeat' | 'repeat_interval' | 'image_paths' | 'event_time'> &
  Partial<Pick<Entry, 'event_date' | 'lunar_month' | 'lunar_day' | 'is_leap_month'>>

export async function updateEntry(id: string, patch: EntryPatch): Promise<EntryWithAuthor> {
  const { data, error } = await supabase
    .from('entries')
    .update(patch)
    .eq('id', id)
    .select('*, author:profiles(name, avatar_url)')
    .single()
  if (error) throw error
  return data as unknown as EntryWithAuthor
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('entries').delete().eq('id', id)
  if (error) throw error
}

// ---------- 첨부 사진 ----------
// 비공개 버킷이다. 경로의 앞 두 칸(그룹/올린 사람)으로 Storage RLS가 권한을 가른다
// — supabase/migrations/006-entry-images.sql

const IMAGE_BUCKET = 'entry-images'
export const MAX_ENTRY_IMAGES = 5

/** 호출 쪽에서 JPEG로 줄여서 넘긴다. 돌려받은 경로를 일정의 image_paths에 넣는다. */
export async function uploadEntryImage(
  groupId: string,
  userId: string,
  body: ArrayBuffer | Blob,
): Promise<string> {
  // crypto.randomUUID는 RN(Hermes)에 없을 수 있다. 같은 사람이 같은 밀리초에 겹칠 일은 없다.
  const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  const path = `${groupId}/${userId}/${name}.jpg`
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, body, { contentType: 'image/jpeg' })
  if (error) throw error
  return path
}

/** 경로 → 1시간짜리 서명 URL. 실패한 경로는 결과에서 빠진다. */
export async function signImageUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data, error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .createSignedUrls(paths, 60 * 60)
  if (error) throw error
  const urls: Record<string, string> = {}
  for (const d of data) if (d.path && d.signedUrl) urls[d.path] = d.signedUrl
  return urls
}

export async function removeEntryImages(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(paths)
  if (error) throw error
}
