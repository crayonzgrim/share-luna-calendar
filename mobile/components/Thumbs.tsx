import { useState } from 'react'
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { File, Paths } from 'expo-file-system'
import { Asset } from 'expo-media-library'
import { errorMessage } from '../../src/lib/errors'
import { radius, useColors } from '../lib/theme'

/**
 * 서명 URL은 받을 때마다 ?token=…이 달라진다. 캐시 열쇠를 토큰 앞까지(=Storage 경로)로 잡아야
 * 앱을 껐다 켜도 한 번 받은 사진을 디스크에서 바로 꺼낸다. 기기 안 파일(file://)은 그대로.
 */
function source(uri: string) {
  return uri.startsWith('http') ? { uri, cacheKey: uri.split('?')[0] } : { uri }
}

/**
 * 첨부 사진 썸네일 줄. 누르면 전체 화면으로 크게 본다.
 * onRemove를 주면 모서리에 ✕가 붙는다 (작성 폼에서).
 * onAdd를 주면 맨 끝에 같은 크기의 + 칸이 붙는다.
 * uri가 비어 있는 칸은 서명 URL을 아직 못 받은 사진 — 빈 상자로 자리만 잡는다.
 */
export default function Thumbs({
  uris,
  full = uris,
  onRemove,
  onAdd,
}: {
  uris: (string | undefined)[]
  /** 크게 볼 때·저장할 때 쓰는 원본. 없으면 uris를 그대로 쓴다 (칸에는 작은 썸네일, 크게는 원본) */
  full?: (string | undefined)[]
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

  // 이미 올라간 사진(서명 URL)만 저장할 수 있다. 폼에서 막 고른 사진은 원래 기기에 있다
  const saved = full.filter((u): u is string => !!u?.startsWith('http'))

  /**
   * 사진을 기기 갤러리에 저장한다. 서명 URL을 캐시로 내려받아 MediaStore에 넣고 캐시는 지운다.
   * 안드로이드 10+에서는 앱이 새로 만드는 사진에 저장소 권한이 필요 없다 — 그래서 권한을 묻지 않는다.
   * 여러 장이면 한 장씩 — 중간에 실패해도 앞서 저장한 장수는 알려준다.
   */
  async function save(list: string[]) {
    setSaving(true)
    setSaveMsg(null)
    let done = 0
    try {
      for (const uri of list) {
        const file = await File.downloadFileAsync(uri, Paths.cache, { idempotent: true })
        await Asset.create(file.uri)
        file.delete()
        done++
      }
      setSaveMsg(list.length > 1 ? `${done}장을 갤러리에 저장했어요` : '갤러리에 저장했어요')
    } catch (err) {
      const why = errorMessage(err, '사진을 저장하지 못했어요')
      setSaveMsg(done > 0 ? `${done}장 저장 후 멈췄어요 — ${why}` : why)
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
            onPress={() => {
              const big = full[i] ?? uri
              if (big) view(big)
            }}
            accessibilityRole="imagebutton"
            accessibilityLabel={`사진 ${i + 1} 크게 보기`}
          >
            <Image
              source={uri ? source(uri) : null}
              transition={120}
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
              <Image source={source(open)} contentFit="contain" style={{ width: '100%', height: '100%' }} />
            )}
          </Pressable>
          {open?.startsWith('http') && (
            <View style={{ alignItems: 'center', gap: 8, paddingTop: 12, paddingBottom: insets.bottom + 20 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <SaveBtn label="↓  저장" busy={saving} onPress={() => void save([open])} a11y="이 사진 저장" />
                {saved.length > 1 && (
                  <SaveBtn
                    label={`↓  전체 저장 (${saved.length}장)`}
                    busy={saving}
                    onPress={() => void save(saved)}
                    a11y={`이 일정 사진 ${saved.length}장 모두 저장`}
                  />
                )}
              </View>
              {saveMsg && <Text style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.8)' }}>{saveMsg}</Text>}
            </View>
          )}
        </View>
      </Modal>
    </View>
  )
}

/** 사진 크게 보기 화면의 어두운 배경 위 버튼 */
function SaveBtn({ label, busy, onPress, a11y }: { label: string; busy: boolean; onPress: () => void; a11y: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ busy }}
      style={({ pressed }) => ({
        minHeight: 44,
        minWidth: 110,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        borderRadius: radius.pill,
        backgroundColor: 'rgba(255, 255, 255, 0.16)',
        opacity: busy ? 0.6 : pressed ? 0.75 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{label}</Text>
      )}
    </Pressable>
  )
}
