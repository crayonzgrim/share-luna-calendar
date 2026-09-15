import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text } from 'react-native'
import type { Group } from '../../src/lib/types'
import { lift, radius, useColors } from '../lib/theme'

type Props = {
  groups: Group[]
  selectedId: string | null
  onSelect: (id: string) => void
}

/** 웹은 <select>지만 RN에는 없다. 눌러서 여는 시트로 같은 일을 한다. */
export default function GroupSwitcher({ groups, selectedId, onSelect }: Props) {
  const c = useColors()
  const [open, setOpen] = useState(false)
  const current = groups.find((g) => g.id === selectedId)

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

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
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
            {groups.map((g, i) => {
              const on = g.id === selectedId
              return (
                <Pressable
                  key={g.id}
                  onPress={() => {
                    onSelect(g.id)
                    setOpen(false)
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
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}
