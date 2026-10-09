import { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { MAX_ENTRY_IMAGES, removeEntryImages, uploadEntryImage } from '../../src/lib/api'
import type { EntryPatch, NewEntry } from '../../src/lib/api'
import { isSameDay } from '../../src/lib/calendar'
import { errorMessage } from '../../src/lib/errors'
import { ENTRY_ICONS, findIcon } from '../../src/lib/icons'
import { lunarToSolarClamped, solarToLunar } from '../../src/lib/lunar'
import { occurrencesInMonth, toISODate } from '../../src/lib/recurrence'
import type { DateType, RepeatRule } from '../../src/lib/recurrence'
import type { EntryWithAuthor } from '../../src/lib/types'
import { useImageUrls } from '../../src/lib/useImageUrls'
import { eventColor, radius, useColors } from '../lib/theme'
import { Badge, ErrorText } from './ui'
import Segmented from './Segmented'
import Thumbs from './Thumbs'

type Props = {
  date: Date
  groupId: string | null
  userId: string
  entries: EntryWithAuthor[]
  onAdd: (e: NewEntry) => Promise<void>
  onEdit: (id: string, patch: EntryPatch) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function DayPanel({
  date, groupId, userId, entries, onAdd, onEdit, onDelete,
}: Props) {
  const c = useColors()
  const [editingId, setEditingId] = useState<string | null>(null)
  // 좁은 화면에서 폼이 항상 펼쳐져 있으면 그 날 일정이 폼에 밀려 안 보인다.
  // 기본은 목록만, 추가·수정을 누를 때만 펼친다.
  const [formOpen, setFormOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [memo, setMemo] = useState('')
  const [icon, setIcon] = useState<string | null>(null)
  const [dateType, setDateType] = useState<DateType>('solar')
  const [repeat, setRepeat] = useState<RepeatRule>('none')
  // 이미 올라간 사진(경로)과 이번에 고른 사진(기기 안 파일)을 따로 든다.
  // 고른 사진은 저장을 누를 때 올린다 — 취소하면 Storage에 쓰레기가 남지 않는다.
  const [keptPaths, setKeptPaths] = useState<string[]>([])
  const [newUris, setNewUris] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lunar = solarToLunar(date)

  const dayEntries = entries.filter((e) =>
    occurrencesInMonth(e, date.getFullYear(), date.getMonth() + 1).some((d) => isSameDay(d, date)),
  )
  const urls = useImageUrls(dayEntries.flatMap((e) => e.image_paths ?? []))
  const imageCount = keptPaths.length + newUris.length

  function reset() {
    setEditingId(null)
    setFormOpen(false)
    setTitle('')
    setMemo('')
    setIcon(null)
    setRepeat('none')
    setDateType('solar')
    setKeptPaths([])
    setNewUris([])
    setError(null)
  }

  function startEdit(e: EntryWithAuthor) {
    setEditingId(e.id)
    setFormOpen(true)
    setTitle(e.title)
    setMemo(e.memo ?? '')
    setIcon(e.icon)
    setRepeat(e.repeat)
    setDateType(e.date_type)
    setKeptPaths(e.image_paths ?? [])
    setNewUris([])
    setError(null)
  }

  async function pickImages() {
    const room = MAX_ENTRY_IMAGES - imageCount
    if (room <= 0) return
    // 시스템 사진 선택기라 저장소 권한을 묻지 않는다
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: room,
      quality: 1,
    })
    if (res.canceled) return
    try {
      const shrunk = await Promise.all(res.assets.slice(0, room).map(shrink))
      setNewUris((prev) => [...prev, ...shrunk])
    } catch (err) {
      setError(errorMessage(err, '사진을 불러오지 못했어요'))
    }
  }

  function removeImage(i: number) {
    if (i < keptPaths.length) setKeptPaths((prev) => prev.filter((_, j) => j !== i))
    else setNewUris((prev) => prev.filter((_, j) => j !== i - keptPaths.length))
  }

  // 음력은 매월 반복을 지원하지 않으므로 선택지를 되돌린다
  function changeDateType(next: DateType) {
    setDateType(next)
    if (next === 'lunar' && repeat === 'monthly') setRepeat('yearly')
  }

  // 웹은 확인 없이 지운다. 손가락은 마우스보다 굵어 잘못 눌리기 쉬워 한 번 묻는다.
  function confirmDelete(id: string, entryTitle: string) {
    Alert.alert('일정을 지울까요?', entryTitle, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => void onDelete(id).then(reset, (err) => setError(errorMessage(err, '지우지 못했어요'))),
      },
    ])
  }

  async function submit() {
    if (!groupId || !title.trim() || saving) return

    const isLunar = dateType === 'lunar'
    if (!editingId && isLunar && !lunar) {
      setError('이 날짜는 음력으로 바꿀 수 없어요 (지원 범위 밖)')
      return
    }

    setSaving(true)
    setError(null)
    const uploaded: string[] = []
    try {
      // 하나씩 올린다 — 중간에 실패해도 어디까지 올라갔는지 알아야 치울 수 있다
      for (const uri of newUris) {
        const body = await (await fetch(uri)).arrayBuffer()
        uploaded.push(await uploadEntryImage(groupId, userId, body))
      }
      const image_paths = [...keptPaths, ...uploaded]

      if (editingId) {
        // 날짜 관련 필드는 건드리지 않는다. 반복 일정의 기준일이 조용히 옮겨가면
        // 다른 달에 찍히던 날짜까지 바뀌어 사용자가 예상하지 못한 결과가 된다.
        await onEdit(editingId, {
          title: title.trim(),
          memo: memo.trim() || null,
          icon,
          repeat,
          image_paths,
        })
      } else {
        await onAdd({
          group_id: groupId,
          author_id: userId,
          title: title.trim(),
          memo: memo.trim() || null,
          icon,
          date_type: dateType,
          repeat,
          event_date: toISODate(date),
          lunar_month: lunar && isLunar ? lunar.month : null,
          lunar_day: lunar && isLunar ? lunar.day : null,
          is_leap_month: lunar && isLunar ? lunar.isLeap : false,
          image_paths,
        })
      }
      reset()
    } catch (err) {
      // 일정이 저장되지 않았으니 방금 올린 사진은 아무도 안 가리킨다
      void removeEntryImages(uploaded).catch(() => {})
      setError(errorMessage(err, '저장하지 못했어요'))
    } finally {
      setSaving(false)
    }
  }

  const field = {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.shellLine,
    borderRadius: radius.field,
    backgroundColor: c.shell,
    color: c.fg,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
  } as const

  const adding = formOpen && !editingId
  const canSubmit = !!title.trim() && !saving

  return (
    <View style={{ padding: 18 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            gap: 8,
            paddingBottom: 14,
            marginBottom: 14,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: c.line,
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: '600', color: c.fg, letterSpacing: -0.8 }}>
            {date.getMonth() + 1}월 {date.getDate()}일
          </Text>
          {lunar && (
            <Text style={{ fontSize: 12, color: c.muted }}>
              음력 {lunar.month}.{lunar.day}
            </Text>
          )}
        </View>

        {/* 추가 중에는 그 날 목록을 감춘다 — 새로 쓸 내용에만 집중하게 */}
        {!adding && (
          <View style={{ marginBottom: 18 }}>
            {dayEntries.length === 0 && (
              <Text style={{ color: c.faint, fontSize: 13, textAlign: 'center', paddingVertical: 18 }}>
                아직 계획이 없어요
              </Text>
            )}

            {dayEntries.map((e, i) => {
              const ico = findIcon(e.icon)
              const editing = editingId === e.id
              // 폼이 열려 있는 동안 다른 행은 잠근다 — 누르면 입력하던 내용이 조용히 날아간다
              const tappable = e.author_id === userId && (!formOpen || editing)
              return (
                <Pressable
                  key={e.id}
                  onPress={() => (editing ? reset() : startEdit(e))}
                  disabled={!tappable}
                  accessibilityRole={tappable ? 'button' : undefined}
                  accessibilityLabel={tappable ? `${e.title} 수정하기` : undefined}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 10,
                    paddingVertical: 11,
                    paddingHorizontal: editing ? 10 : 0,
                    marginHorizontal: editing ? -10 : 0,
                    borderRadius: editing || pressed ? 12 : 0,
                    backgroundColor: editing ? c.accentSoft : pressed ? c.shell : 'transparent',
                    borderBottomWidth: i === dayEntries.length - 1 ? 0 : StyleSheet.hairlineWidth,
                    borderBottomColor: c.line,
                  })}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* 색만으로 구분하지 않는다 — 점 옆에 이모지와 이름이 함께 간다 */}
                      <View
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: radius.pill,
                          marginRight: 7,
                          backgroundColor: eventColor(e.icon, c),
                        }}
                      />
                      {ico && <Text style={{ fontSize: 15, marginRight: 5 }}>{ico.emoji}</Text>}
                      <Text style={{ fontSize: 15, fontWeight: '600', color: c.fg, letterSpacing: -0.3 }}>
                        {e.title}
                      </Text>
                      {e.date_type === 'lunar' && <Badge label="음력" tone="lunar" />}
                      {e.repeat !== 'none' && <Badge label={e.repeat === 'yearly' ? '매년' : '매월'} />}
                    </View>
                    {e.memo && (
                      <Text style={{ marginTop: 5, fontSize: 13, lineHeight: 20, color: c.muted }}>
                        {e.memo}
                      </Text>
                    )}
                    {!!e.image_paths?.length && (
                      <View style={{ marginTop: 8 }}>
                        <Thumbs uris={e.image_paths.map((p) => urls[p])} />
                      </View>
                    )}
                    <Text style={{ marginTop: 5, fontSize: 11, color: c.faint }}>
                      {e.author?.name ?? '알 수 없음'}
                    </Text>
                  </View>

                  {/* 누를 수 있다는 표시 — 남의 일정이나 폼이 열린 동안에는 없다 */}
                  {tappable && !editing && (
                    <Text style={{ fontSize: 15, color: c.faint, marginTop: 2 }}>›</Text>
                  )}
                </Pressable>
              )
            })}
          </View>
        )}

        {!formOpen ? (
          <Pressable
            onPress={() => setFormOpen(true)}
            style={({ pressed }) => ({
              alignItems: 'center',
              paddingVertical: 12,
              borderRadius: radius.pill,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: c.shellLine,
              backgroundColor: pressed ? c.surface : c.shell,
            })}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: c.fg }}>+ 일정 추가</Text>
          </Pressable>
        ) : (
        <View style={{ gap: 9 }}>
          {editingId && (
            <Text style={{ fontSize: 12, fontWeight: '500', color: c.accentStrong }}>
              수정 중 — 날짜는 그대로 두고 내용만 바꿉니다
            </Text>
          )}

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="무엇을 할 예정인가요?"
            placeholderTextColor={c.faint}
            maxLength={200}
            style={field}
          />
          <TextInput
            value={memo}
            onChangeText={setMemo}
            placeholder="메모 (선택)"
            placeholderTextColor={c.faint}
            multiline
            maxLength={2000}
            style={[field, { minHeight: 62, textAlignVertical: 'top' }]}
          />

          {imageCount > 0 && (
            <View style={{ paddingTop: 6 }}>
              <Thumbs
                uris={[...keptPaths.map((p) => urls[p]), ...newUris]}
                onRemove={removeImage}
              />
            </View>
          )}
          {imageCount < MAX_ENTRY_IMAGES && (
            <Pressable
              onPress={() => void pickImages()}
              accessibilityRole="button"
              style={({ pressed }) => ({
                alignSelf: 'flex-start',
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: radius.pill,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: c.shellLine,
                backgroundColor: pressed ? c.surface : c.shell,
              })}
            >
              <Text style={{ fontSize: 13, fontWeight: '500', color: c.muted }}>
                + 사진 ({imageCount}/{MAX_ENTRY_IMAGES})
              </Text>
            </Pressable>
          )}

          {/* 이모지 키보드 대신 프리셋 — 웹과 같이 4열 */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            {ENTRY_ICONS.map((opt) => {
              const on = icon === opt.key
              return (
                <Pressable
                  key={opt.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={opt.label}
                  // 같은 걸 다시 누르면 해제된다
                  onPress={() => setIcon(on ? null : opt.key)}
                  style={{
                    width: `${(100 - 4 * 1.5) / 4}%`,
                    alignItems: 'center',
                    gap: 2,
                    paddingVertical: 8,
                    borderRadius: radius.chip,
                    borderWidth: 1,
                    borderColor: on ? c.accent : 'transparent',
                    backgroundColor: on ? c.accentSoft : c.shell,
                  }}
                >
                  <Text style={{ fontSize: 17 }}>{opt.emoji}</Text>
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 10, fontWeight: '500', color: on ? c.accent : c.muted }}
                  >
                    {opt.short}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Segmented
              value={dateType}
              // 날짜 종류를 바꾸면 저장된 음/양력 기준이 흔들린다. 수정 중엔 잠근다.
              disabled={!!editingId}
              onChange={(v) => changeDateType(v)}
              options={[
                { value: 'solar', label: '양력' },
                { value: 'lunar', label: '음력' },
              ]}
            />
            <Segmented
              value={repeat}
              onChange={(v) => setRepeat(v)}
              options={
                dateType === 'solar'
                  ? [
                      { value: 'none', label: '반복 없음' },
                      { value: 'yearly', label: '매년' },
                      { value: 'monthly', label: '매월' },
                    ]
                  : [
                      { value: 'none', label: '반복 없음' },
                      { value: 'yearly', label: '매년' },
                    ]
              }
            />
          </View>

          {!editingId && dateType === 'lunar' && repeat === 'yearly' && lunar && (
            <Text
              style={{
                fontSize: 12,
                lineHeight: 18,
                color: c.muted,
                backgroundColor: c.accentSoft,
                borderRadius: radius.chip,
                paddingVertical: 9,
                paddingHorizontal: 11,
              }}
            >
              매년 음력 {lunar.month}월 {lunar.day}일에 표시돼요.{' '}
              내년엔 {nextYearLabel(lunar.month, lunar.day, date.getFullYear() + 1)}.
            </Text>
          )}

          {error && <ErrorText>{error}</ErrorText>}

          <View style={{ flexDirection: 'row', gap: 7 }}>
            {/* 추가 중에도 접을 수 있어야 한다 — 폼을 열어둔 채로는 그 날 일정이 가려진다 */}
            <Pressable
              onPress={reset}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 18,
                borderRadius: radius.pill,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: c.shellLine,
                backgroundColor: c.shell,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '500', color: c.muted }}>취소</Text>
            </Pressable>
            {editingId && (
              <Pressable
                onPress={() => confirmDelete(editingId, title)}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                  borderRadius: radius.pill,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: c.shellLine,
                  backgroundColor: c.shell,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '500', color: c.danger }}>삭제</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => void submit()}
              disabled={!canSubmit}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                paddingVertical: 12,
                borderRadius: radius.pill,
                backgroundColor: c.accentStrong,
                opacity: !canSubmit ? 0.35 : pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.accentFg }}>
                {saving ? '저장 중…' : editingId ? '저장' : '추가'}
              </Text>
            </Pressable>
          </View>
        </View>
        )}
    </View>
  )
}

// 폰 사진은 한 장에 수 MB다. 긴 변 1280px JPEG로 줄이면 수백 KB — 무료 Storage 1GB를 오래 쓴다.
// iOS의 HEIC도 여기서 JPEG가 된다 (버킷이 image/jpeg만 받는다).
const MAX_SIDE = 1280

async function shrink(a: ImagePicker.ImagePickerAsset): Promise<string> {
  const ctx = ImageManipulator.manipulate(a.uri)
  if (Math.max(a.width, a.height) > MAX_SIDE) {
    ctx.resize(a.width >= a.height ? { width: MAX_SIDE } : { height: MAX_SIDE })
  }
  const img = await ctx.renderAsync()
  const out = await img.saveAsync({ compress: 0.8, format: SaveFormat.JPEG })
  return out.uri
}

function nextYearLabel(month: number, day: number, year: number): string {
  const d = lunarToSolarClamped(year, month, day)
  return d ? `양력 ${d.getMonth() + 1}월 ${d.getDate()}일` : '계산할 수 없어요'
}
