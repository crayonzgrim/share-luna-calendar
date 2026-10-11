import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { errorMessage } from '../../src/lib/errors'
import { ErrorText } from './ui'
import { radius, useColors } from '../lib/theme'

/** 그룹 이름 한 칸 + 만들기. 그룹 선택 창과 "그룹이 없어요" 첫 화면이 같이 쓴다. */
export default function NewGroupForm({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string) => Promise<void>
  onCancel?: () => void
}) {
  const c = useColors()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = !!name.trim() && !busy

  async function submit() {
    if (!ready) return
    setBusy(true)
    try {
      await onCreate(name.trim())
    } catch (err) {
      setError(errorMessage(err, '그룹을 만들지 못했어요'))
      setBusy(false)
    }
  }

  return (
    <View style={{ gap: 9 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: c.muted }}>새 그룹 이름</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="예: 우리 가족"
        placeholderTextColor={c.faint}
        maxLength={50}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
        style={{
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.shellLine,
          borderRadius: radius.field,
          backgroundColor: c.shell,
          color: c.fg,
          paddingHorizontal: 14,
          minHeight: 44,
          fontSize: 15,
        }}
      />
      {error && <ErrorText>{error}</ErrorText>}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {onCancel && (
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            style={({ pressed }) => ({
              minHeight: 44,
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
        )}
        <Pressable
          onPress={() => void submit()}
          disabled={!ready}
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready, busy }}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.pill,
            backgroundColor: c.accentStrong,
            opacity: !ready ? 0.35 : pressed ? 0.85 : 1,
          })}
        >
          {busy ? (
            <ActivityIndicator color={c.accentFg} />
          ) : (
            <Text style={{ fontSize: 14, fontWeight: '600', color: c.accentFg }}>만들기</Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}
