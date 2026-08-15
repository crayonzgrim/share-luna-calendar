import type { DateType, RepeatRule } from './recurrence'

export type Profile = {
  id: string
  name: string
  avatar_url: string | null
}

export type Group = {
  id: string
  name: string
  invite_code: string
  created_by: string
}

export type Entry = {
  id: string
  group_id: string
  author_id: string
  title: string
  memo: string | null
  /** 일정 종류 key. 이모지·라벨 매핑은 lib/icons.ts */
  icon: string | null
  date_type: DateType
  repeat: RepeatRule
  event_date: string
  lunar_month: number | null
  lunar_day: number | null
  is_leap_month: boolean
  created_at: string
}

/** 목록 조회 시 작성자 프로필을 join해서 함께 받는다 */
export type EntryWithAuthor = Entry & { author: Pick<Profile, 'name' | 'avatar_url'> | null }
