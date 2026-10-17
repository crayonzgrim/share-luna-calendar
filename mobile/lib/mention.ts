import type { Profile } from '../../src/lib/types'

/** 글 끝에 친 '@검색어'. 없으면 null. ponytail: 커서가 글 끝에 있다고 본다 — 중간에 끼워 넣는 @는 못 잡는다 */
export function mentionQuery(text: string): string | null {
  return text.match(/(?:^|\s)@([^\s@]*)$/)?.[1] ?? null
}

/** 글에 '@이름'이 들어 있는 멤버들. ponytail: 이름이 같은 사람이 둘이면 둘 다 불린다 */
export function mentionedIds(members: Profile[], text: string): string[] {
  return members.filter((m) => text.includes(`@${m.name}`)).map((m) => m.id)
}

/** 글 끝의 '@검색어'를 '@이름 '으로 채운다 */
export function completeMention(text: string, name: string): string {
  return text.replace(/@[^\s@]*$/, `@${name} `)
}
