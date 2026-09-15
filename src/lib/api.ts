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
export type EntryPatch = Pick<Entry, 'title' | 'memo' | 'icon' | 'repeat'>

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
