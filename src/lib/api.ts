import { supabase } from './supabase'
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

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('entries').delete().eq('id', id)
  if (error) throw error
}
