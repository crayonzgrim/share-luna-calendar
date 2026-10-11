import { useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { Group, Profile } from '../../src/lib/types'
import { Avatar, ErrorText } from './ui'
import { lift, radius, useColors } from '../lib/theme'

/**
 * 계정 삭제 확인 창. 내가 만든 그룹 중 다른 멤버가 있는 곳마다 다음 그룹장을 고른다.
 * 기본 선택은 목록 첫 사람. 나 혼자인 그룹은 함께 지워진다고만 알린다.
 */
export default function DeleteAccountSheet({
  visible,
  myId,
  groups,
  members,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  visible: boolean
  myId: string
  groups: Group[]
  members: Record<string, Profile[] | null>
  busy: boolean
  error: string | null
  onCancel: () => void
  /** { 그룹 id: 다음 그룹장 user id } */
  onConfirm: (heirs: Record<string, string>) => void
}) {
  const c = useColors()
  const owned = groups.filter((g) => g.created_by === myId)
  const others = (g: Group) => (members[g.id] ?? []).filter((m) => m.id !== myId)
  const handOver = owned.filter((g) => others(g).length > 0)
  const alone = owned.filter((g) => others(g).length === 0)

  // 고르지 않은 그룹은 목록 첫 사람
  const [picked, setPicked] = useState<Record<string, string>>({})
  const heirOf = (g: Group) => picked[g.id] ?? others(g)[0]?.id

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: c.scrim, justifyContent: 'center', padding: 20 }}>
        <View style={[{ maxHeight: '85%', backgroundColor: c.surface, borderRadius: radius.core }, lift(c, true)]}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.fg }}>계정을 삭제할까요?</Text>
            <Text style={{ fontSize: 14, lineHeight: 21, color: c.muted }}>
              내가 쓴 일정과 올린 사진이 모두 지워지고 되돌릴 수 없어요.
            </Text>

            {handOver.map((g) => (
              <View key={g.id} style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: c.fg }}>
                  '{g.name}'의 다음 그룹장
                </Text>
                <View style={{ borderRadius: radius.chip, backgroundColor: c.shell, paddingVertical: 2 }}>
                  {others(g).map((m) => {
                    const on = heirOf(g) === m.id
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => setPicked((p) => ({ ...p, [g.id]: m.id }))}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}
                        accessibilityLabel={`${m.name}에게 그룹장 넘기기`}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 12 }}
                      >
                        <View
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: radius.pill,
                            borderWidth: on ? 5 : 1.5,
                            borderColor: on ? c.accentStrong : c.faint,
                          }}
                        />
                        <Avatar name={m.name} url={m.avatar_url} size={22} />
                        <Text style={{ fontSize: 14, color: c.fg, fontWeight: on ? '600' : '400' }}>{m.name}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            ))}

            {alone.length > 0 && (
              <Text style={{ fontSize: 13, lineHeight: 19, color: c.muted }}>
                나 혼자인 그룹은 함께 지워져요: {alone.map((g) => `'${g.name}'`).join(', ')}
              </Text>
            )}

            {error && <ErrorText>{error}</ErrorText>}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <Pressable
                onPress={onCancel}
                disabled={busy}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radius.pill,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: c.shellLine,
                  backgroundColor: pressed ? c.shell : c.surface,
                })}
              >
                <Text style={{ fontSize: 14, fontWeight: '500', color: c.muted }}>취소</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  onConfirm(Object.fromEntries(handOver.map((g) => [g.id, heirOf(g)!])))
                }
                disabled={busy}
                accessibilityRole="button"
                accessibilityState={{ busy }}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radius.pill,
                  backgroundColor: c.danger,
                  opacity: busy ? 0.5 : pressed ? 0.85 : 1,
                })}
              >
                {busy ? (
                  <ActivityIndicator color={c.accentFg} />
                ) : (
                  <Text style={{ fontSize: 14, fontWeight: '600', color: c.accentFg }}>삭제</Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}
