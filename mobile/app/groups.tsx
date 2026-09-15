import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import { router } from 'expo-router'
import { createGroup, fetchGroupMembers, updateGroupName } from '../../src/lib/api'
import { errorMessage } from '../../src/lib/errors'
import type { Profile } from '../../src/lib/types'
import { Badge, ErrorText, NavBtn, SectionLabel, Shell } from '../components/ui'
import { useAuth } from '../lib/useAuth'
import { useGroups } from '../lib/useGroups'
import { radius, useColors } from '../lib/theme'
import { DEMO, DEMO_USER_ID, demoMembers, useDemoGroups } from '../lib/demo'

/**
 * 초대 링크는 웹 주소여야 한다 — 받는 사람에게 앱이 깔려 있으리란 보장이 없다.
 * 주소를 안 넣었으면 딥링크로 떨어지지만, 앱이 있는 사람끼리만 열린다.
 */
const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL?.replace(/\/$/, '')

function inviteUrl(code: string): string {
  return SITE_URL ? `${SITE_URL}/join/${code}` : `sharecalendar://join/${code}`
}

/** 손가락이 닿는 최소 크기(iOS HIG 44pt). 버튼은 전부 이 높이를 넘긴다. */
const TAP = 44

export default function GroupsScreen() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const { user } = useAuth()

  // ponytail: 임시 — DEMO면 메모리 데이터로 갈아끼운다. lib/demo.ts 참고
  const realGroups = useGroups(!DEMO && !!user)
  const demoGroups = useDemoGroups()
  const { groups, loading, reload } = DEMO ? demoGroups : realGroups

  const [name, setName] = useState('')
  // null = 못 불러옴. undefined(키 없음) = 아직 불러오는 중 — 둘을 갈라야 영영 "불러오는 중"이 안 남는다.
  const [members, setMembers] = useState<Record<string, Profile[] | null>>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const nameInput = useRef<TextInput>(null)

  const myId = DEMO ? DEMO_USER_ID : user?.id

  useEffect(() => {
    for (const g of groups) {
      if (DEMO) {
        setMembers((prev) => ({ ...prev, [g.id]: demoMembers(g.id) }))
        continue
      }
      fetchGroupMembers(g.id)
        .then((list) => setMembers((prev) => ({ ...prev, [g.id]: list })))
        .catch(() => setMembers((prev) => ({ ...prev, [g.id]: null })))
    }
  }, [groups])

  async function submit() {
    const wanted = name.trim()
    if (!wanted || busy) return
    setBusy(true)
    try {
      if (DEMO) {
        demoGroups.addGroup(wanted)
      } else {
        if (!user) return
        await createGroup(wanted, user.id)
        await reload()
      }
      setName('')
      setError(null)
      // 만들고 나면 목록 어딘가에 카드가 생길 뿐이라 성공을 못 알아챈다 — 한 줄로 알린다
      setNotice(`'${wanted}' 그룹을 만들었어요`)
      setTimeout(() => setNotice(null), 2500)
    } catch (err) {
      setError(errorMessage(err, '그룹을 만들지 못했어요'))
    } finally {
      setBusy(false)
    }
  }

  async function submitRename(id: string) {
    if (!draft.trim() || busy) return
    setBusy(true)
    try {
      if (DEMO) {
        demoGroups.renameGroup(id, draft.trim())
      } else {
        await updateGroupName(id, draft.trim())
        await reload()
      }
      setRenamingId(null)
      setError(null)
    } catch (err) {
      setError(errorMessage(err, '이름을 바꾸지 못했어요'))
    } finally {
      setBusy(false)
    }
  }

  async function copyInvite(code: string) {
    await Clipboard.setStringAsync(inviteUrl(code))
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  const field = {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.shellLine,
    borderRadius: radius.field,
    backgroundColor: c.shell,
    color: c.fg,
    paddingHorizontal: 14,
    minHeight: TAP,
    fontSize: 15,
  } as const

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      {/* 뒤로가기는 왼쪽 위 고정 44pt — 스크롤과 무관하게 탈출구가 항상 같은 자리에 있다 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4 }}>
        <NavBtn
          label="‹"
          size={TAP}
          onPress={() => router.back()}
          accessibilityLabel="달력으로 돌아가기"
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 48 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text
          accessibilityRole="header"
          style={{ fontSize: 30, fontWeight: '500', letterSpacing: -1.4, color: c.fg, marginTop: 6 }}
        >
          함께 보는 사람들
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 21, color: c.muted, marginTop: 6 }}>
          그룹을 만들고 초대 링크를 보내면 같은 달력을 함께 봐요.
        </Text>

        <SectionLabel>내 그룹</SectionLabel>

        <View style={{ gap: 12 }}>
          {loading && groups.length === 0 && (
            // 불러오는 동안 "그룹이 없어요"를 먼저 보여주면 가입이 날아간 줄 안다
            <Shell>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 30 }}>
                <ActivityIndicator color={c.muted} />
                <Text style={{ color: c.muted, fontSize: 14 }}>그룹 불러오는 중…</Text>
              </View>
            </Shell>
          )}

          {!loading && groups.length === 0 && (
            <Shell>
              <View style={{ alignItems: 'center', gap: 6, paddingVertical: 28, paddingHorizontal: 24 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: c.fg }}>아직 그룹이 없어요</Text>
                <Text style={{ fontSize: 13, lineHeight: 19, color: c.muted, textAlign: 'center' }}>
                  가족이나 친구와 함께 볼 그룹을 하나 만들어 보세요.
                </Text>
                <Pressable
                  // ponytail: 목록이 비면 아래 입력칸이 이미 화면 안이라 포커스만 준다
                  onPress={() => nameInput.current?.focus()}
                  accessibilityRole="button"
                  accessibilityLabel="새 그룹 이름 입력하기"
                  style={({ pressed }) => ({
                    marginTop: 8,
                    minHeight: TAP,
                    justifyContent: 'center',
                    paddingHorizontal: 22,
                    borderRadius: radius.pill,
                    backgroundColor: c.accentStrong,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: c.accentFg }}>그룹 만들기</Text>
                </Pressable>
              </View>
            </Shell>
          )}

          {groups.map((g) => {
            const done = copied === g.invite_code
            const list = members[g.id]
            const renaming = renamingId === g.id
            return (
              <Shell key={g.id}>
                <View style={{ padding: 16 }}>
                  {/* 이름 변경은 owner만. 그룹을 만든 사람이 트리거로 owner가 되므로
                      created_by로 판별한다. 실제 차단은 RLS가 한다. */}
                  {renaming ? (
                    <View style={{ gap: 9 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: c.muted }}>그룹 이름</Text>
                      <TextInput
                        value={draft}
                        onChangeText={setDraft}
                        maxLength={50}
                        autoFocus
                        selectTextOnFocus
                        returnKeyType="done"
                        onSubmitEditing={() => void submitRename(g.id)}
                        style={field}
                      />
                      {error && <ErrorText>{error}</ErrorText>}
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable
                          onPress={() => {
                            setRenamingId(null)
                            setError(null)
                          }}
                          accessibilityRole="button"
                          style={({ pressed }) => ({
                            minHeight: TAP,
                            justifyContent: 'center',
                            paddingHorizontal: 20,
                            borderRadius: radius.pill,
                            borderWidth: StyleSheet.hairlineWidth,
                            borderColor: c.shellLine,
                            backgroundColor: pressed ? c.surface : c.shell,
                          })}
                        >
                          <Text style={{ fontSize: 14, fontWeight: '500', color: c.muted }}>취소</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => void submitRename(g.id)}
                          disabled={!draft.trim() || busy}
                          accessibilityRole="button"
                          accessibilityState={{ disabled: !draft.trim() || busy, busy }}
                          style={({ pressed }) => ({
                            flex: 1,
                            minHeight: TAP,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: radius.pill,
                            backgroundColor: c.accentStrong,
                            opacity: !draft.trim() || busy ? 0.35 : pressed ? 0.85 : 1,
                          })}
                        >
                          {busy ? (
                            <ActivityIndicator color={c.accentFg} />
                          ) : (
                            <Text style={{ fontSize: 14, fontWeight: '600', color: c.accentFg }}>저장</Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text
                          numberOfLines={1}
                          style={{ flex: 1, fontSize: 17, fontWeight: '600', color: c.fg, letterSpacing: -0.4 }}
                        >
                          {g.name}
                        </Text>
                        {list && <Badge label={`${list.length}명`} />}
                      </View>
                      <Text
                        numberOfLines={2}
                        style={{ color: list === null ? c.danger : c.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }}
                      >
                        {list === undefined
                          ? '멤버 불러오는 중…'
                          : list === null
                            ? '멤버를 불러오지 못했어요'
                            : list.length > 0
                              ? list.map((m) => m.name).join(', ')
                              : '아직 나뿐이에요'}
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                        <CardBtn
                          label={done ? '✓ 링크 복사됨' : '초대 링크 복사'}
                          on={done}
                          onPress={() => void copyInvite(g.invite_code)}
                          accessibilityLabel={`${g.name} 초대 링크 복사`}
                        />
                        {g.created_by === myId && (
                          <CardBtn
                            label="이름 수정"
                            accessibilityLabel={`${g.name} 이름 수정`}
                            onPress={() => {
                              setRenamingId(g.id)
                              setDraft(g.name)
                              setError(null)
                            }}
                          />
                        )}
                      </View>
                    </>
                  )}
                </View>
              </Shell>
            )
          })}
        </View>

        <SectionLabel>새 그룹 만들기</SectionLabel>

        <Shell>
          <View style={{ padding: 16, gap: 9 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: c.muted }}>그룹 이름</Text>
            <TextInput
              ref={nameInput}
              value={name}
              onChangeText={setName}
              placeholder="예: 우리 가족"
              placeholderTextColor={c.faint}
              maxLength={50}
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
              style={field}
            />
            <Text style={{ fontSize: 12, lineHeight: 17, color: c.faint }}>
              만든 사람이 이름을 바꿀 수 있어요. 만든 뒤 초대 링크를 보내면 돼요.
            </Text>
            <Pressable
              onPress={() => void submit()}
              disabled={!name.trim() || busy}
              accessibilityRole="button"
              accessibilityState={{ disabled: !name.trim() || busy, busy }}
              style={({ pressed }) => ({
                minHeight: TAP,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.pill,
                backgroundColor: c.accentStrong,
                opacity: !name.trim() || busy ? 0.35 : pressed ? 0.85 : 1,
              })}
            >
              {busy && !renamingId ? (
                <ActivityIndicator color={c.accentFg} />
              ) : (
                <Text style={{ fontSize: 14, fontWeight: '600', color: c.accentFg }}>만들기</Text>
              )}
            </Pressable>
            {/* 실패도 성공도 누른 버튼 바로 밑에서 알린다 — 화면 끝으로 보내면 못 본다 */}
            {notice && (
              <Text style={{ fontSize: 13, color: c.accentStrong }}>{notice}</Text>
            )}
            {error && !renamingId && <ErrorText>{error}</ErrorText>}
          </View>
        </Shell>
      </ScrollView>
    </View>
  )
}

/** 웹의 .copy-btn — 카드 안의 알약 버튼. 높이는 손가락(44pt)에 맞춘다. */
function CardBtn({
  label,
  onPress,
  on,
  accessibilityLabel,
}: {
  label: string
  onPress: () => void
  on?: boolean
  accessibilityLabel: string
}) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        minHeight: TAP,
        justifyContent: 'center',
        paddingHorizontal: 16,
        borderRadius: radius.pill,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: on ? c.accent : c.shellLine,
        backgroundColor: on ? c.accentSoft : pressed ? c.surface : c.shell,
      })}
    >
      <Text style={{ fontSize: 13, fontWeight: '500', color: on ? c.accentStrong : c.fg }}>
        {label}
      </Text>
    </Pressable>
  )
}
