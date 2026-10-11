import { useState } from 'react'
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { File, Paths } from 'expo-file-system'
import { Asset } from 'expo-media-library'
import { errorMessage } from '../../src/lib/errors'
import { radius, useColors } from '../lib/theme'

/**
 * 첨부 사진 썸네일 줄. 누르면 전체 화면으로 크게 본다.
 * onRemove를 주면 모서리에 ✕가 붙는다 (작성 폼에서).
 * onAdd를 주면 맨 끝에 같은 크기의 + 칸이 붙는다.
 * uri가 비어 있는 칸은 서명 URL을 아직 못 받은 사진 — 빈 상자로 자리만 잡는다.
 */
export default function Thumbs({
  uris,
  onRemove,
  onAdd,
}: {
  uris: (string | undefined)[]
  onRemove?: (index: number) => void
  onAdd?: () => void
}) {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState<string | null>(null)
  // 저장 버튼 아래 한 줄 — 저장 중 / 저장됨 / 실패 메시지
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  function view(uri: string | null) {
    setOpen(uri)
    setSaveMsg(null)
  }

  /**
   * 크게 본 사진을 기기 갤러리에 저장한다. 서명 URL을 캐시로 내려받아 MediaStore에 넣고 캐시는 지운다.
   * 안드로이드 10+에서는 앱이 새로 만드는 사진에 저장소 권한이 필요 없다 — 그래서 권한을 묻지 않는다.
   */
  async function save(uri: string) {
    setSaving(true)
    setSaveMsg(null)
    try {
      const file = await File.downloadFileAsync(uri, Paths.cache, { idempotent: true })
      await Asset.create(file.uri)
      file.delete()
      setSaveMsg('갤러리에 저장했어요')
    } catch (err) {
      setSaveMsg(errorMessage(err, '사진을 저장하지 못했어요'))
    } finally {
      setSaving(false)
    }
  }

  if (uris.length === 0 && !onAdd) return null

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {uris.map((uri, i) => (
        <View key={`${i}-${uri}`}>
          <Pressable
            onPress={() => uri && view(uri)}
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

      {onAdd && (
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel="사진 추가"
          style={({ pressed }) => ({
            width: 64,
            height: 64,
            borderRadius: radius.chip,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: c.shellLine,
            backgroundColor: pressed ? c.surface : c.shell,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Text style={{ fontSize: 22, fontWeight: '300', color: c.muted, lineHeight: 24 }}>+</Text>
          <Text style={{ fontSize: 10, fontWeight: '500', color: c.muted }}>사진 추가</Text>
        </Pressable>
      )}

      <Modal visible={!!open} transparent animationType="fade" onRequestClose={() => view(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.92)' }}>
          <Pressable onPress={() => view(null)} accessibilityLabel="사진 닫기" style={{ flex: 1, justifyContent: 'center' }}>
            {open && (
              <Image source={{ uri: open }} resizeMode="contain" style={{ width: '100%', height: '100%' }} />
            )}
          </Pressable>
          {/* 이미 올라간 사진(서명 URL)만 저장할 수 있다. 폼에서 막 고른 사진은 원래 기기에 있다 */}
          {open?.startsWith('http') && (
            <View style={{ alignItems: 'center', gap: 8, paddingTop: 12, paddingBottom: insets.bottom + 20 }}>
              <Pressable
                onPress={() => void save(open)}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="사진 저장"
                style={({ pressed }) => ({
                  minHeight: 44,
                  minWidth: 120,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 22,
                  borderRadius: radius.pill,
                  backgroundColor: 'rgba(255, 255, 255, 0.16)',
                  opacity: saving ? 0.6 : pressed ? 0.75 : 1,
                })}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>↓  저장</Text>
                )}
              </Pressable>
              {saveMsg && <Text style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.8)' }}>{saveMsg}</Text>}
            </View>
          )}
        </View>
      </Modal>
    </View>
  )
}
