import { useState } from 'react'
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { radius, useColors } from '../lib/theme'

/**
 * 첨부 사진 썸네일 줄. 누르면 전체 화면으로 크게 본다.
 * onRemove를 주면 모서리에 ✕가 붙는다 (작성 폼에서).
 * uri가 비어 있는 칸은 서명 URL을 아직 못 받은 사진 — 빈 상자로 자리만 잡는다.
 */
export default function Thumbs({
  uris,
  onRemove,
}: {
  uris: (string | undefined)[]
  onRemove?: (index: number) => void
}) {
  const c = useColors()
  const [open, setOpen] = useState<string | null>(null)

  if (uris.length === 0) return null

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {uris.map((uri, i) => (
        <View key={`${i}-${uri}`}>
          <Pressable
            onPress={() => uri && setOpen(uri)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`사진 ${i + 1} 크게 보기`}
          >
            <Image
              source={{ uri }}
              style={{
                width: 64,
                height: 64,
                borderRadius: radius.chip,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: c.shellLine,
                backgroundColor: c.shell,
              }}
            />
          </Pressable>
          {onRemove && (
            <Pressable
              onPress={() => onRemove(i)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`사진 ${i + 1} 빼기`}
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                width: 22,
                height: 22,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: c.fg,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: c.surface }}>✕</Text>
            </Pressable>
          )}
        </View>
      ))}

      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Pressable
          onPress={() => setOpen(null)}
          accessibilityLabel="사진 닫기"
          style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.92)' }}
        >
          {open && (
            <Image source={{ uri: open }} resizeMode="contain" style={{ width: '100%', height: '100%' }} />
          )}
        </Pressable>
      </Modal>
    </View>
  )
}
