import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import type { Group } from '../../src/lib/types'
import { lift, radius, useColors } from '../lib/theme'
import NewGroupForm from './NewGroupForm'

type Props = {
  groups: Group[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** 새 그룹을 만들고 그 그룹으로 옮긴다 */
  onCreate: (name: string) => Promise<void>
}

/** 웹은 <select>지만 RN에는 없다. 눌러서 여는 시트로 같은 일을 한다. */
export default function GroupSwitcher({ groups, selectedId, onSelect, onCreate }: Props) {
  const c = useColors()
  const [open, setOpen] = useState(false)
  // 목록 맨 아래 "+ 새 그룹 만들기"를 누르면 같은 창이 이름 입력으로 바뀐다
  const [creating, setCreating] = useState(false)
  const current = groups.find((g) => g.id === selectedId)

  function close() {
    setOpen(false)
    setCreating(false)
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="그룹 선택"
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          maxWidth: 180,
          paddingVertical: 7,
          paddingHorizontal: 11,
          borderRadius: radius.pill,
          backgroundColor: pressed ? c.shell : 'transparent',
        })}
      >
        <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', color: c.fg, letterSpacing: -0.2 }}>
          {current?.name ?? '그룹 선택'}
        </Text>
        <Text style={{ fontSize: 9, color: c.muted }}>▼</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable
          onPress={close}
          style={{ flex: 1, backgroundColor: c.scrim, justifyContent: 'center', padding: 28 }}
        >
          {/* 배경을 눌러 닫되, 시트 안쪽 탭은 배경으로 새어나가지 않게 막는다 */}
          <Pressable
            onPress={() => {}}
            style={[
              {
                backgroundColor: c.surface,
                borderRadius: radius.core,
                paddingVertical: 8,
                overflow: 'hidden',
              },
              lift(c, true),
            ]}
          >
            {creating ? (
              <View style={{ paddingHorizontal: 18, paddingVertical: 10 }}>
                <NewGroupForm
                  onCancel={() => setCreating(false)}
                  onCreate={async (name) => {
                    await onCreate(name)
                    close()
                  }}
                />
              </View>
            ) : (
              <>
                {groups.map((g, i) => {
                  const on = g.id === selectedId
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() => {
                        onSelect(g.id)
                        close()
                      }}
                      style={({ pressed }) => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 14,
                        paddingHorizontal: 18,
                        backgroundColor: pressed ? c.shell : 'transparent',
                        borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                        borderTopColor: c.line,
                      })}
                    >
                      <Text style={{ fontSize: 15, fontWeight: on ? '600' : '400', color: on ? c.accent : c.fg }}>
                        {g.name}
                      </Text>
                      {on && <Text style={{ color: c.accent, fontSize: 14 }}>✓</Text>}
                    </Pressable>
                  )
                })}
                {/* 고르는 줄(그룹)과 하는 일(만들기)을 떼어 놓는다 — 구분선 아래 칸에, 채운 알약 버튼으로.
                    선택된 그룹도 보라 글자라 글자색만으로는 구분이 안 됐다 */}
                <View
                  style={{
                    marginTop: 8,
                    paddingTop: 12,
                    paddingBottom: 4,
                    paddingHorizontal: 12,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: c.shellLine,
                  }}
                >
                  <Pressable
                    onPress={() => setCreating(true)}
                    accessibilityRole="button"
                    accessibilityLabel="새 그룹 만들기"
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      minHeight: 44,
                      borderRadius: radius.pill,
                      backgroundColor: c.accentSoft,
                      opacity: pressed ? 0.75 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: radius.pill,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: c.accentStrong,
                      }}
                    >
                      <Text style={{ color: c.accentFg, fontSize: 15, fontWeight: '600', lineHeight: 18 }}>+</Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: c.accentStrong }}>새 그룹 만들기</Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}
