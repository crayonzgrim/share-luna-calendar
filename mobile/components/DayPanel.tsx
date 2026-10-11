import { useState } from 'react'
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { MAX_ENTRY_IMAGES, removeEntryImages, thumbPath, uploadEntryImage } from '../../src/lib/api'
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
import { byTime, formatTime } from '../lib/time'
import { REPEAT_UNITS, repeatLabel } from '../lib/repeat'
import { Avatar, Badge, ErrorText } from './ui'
import Segmented from './Segmented'
import Thumbs from './Thumbs'
import TimeWheel from './TimeWheel'

type Props = {
  date: Date
  groupId: string | null
  userId: string
  entries: EntryWithAuthor[]
  onAdd: (e: NewEntry) => Promise<void>
  onEdit: (id: string, patch: EntryPatch) => Promise<void>
  onDelete: (id: string) => Promise<void>
  /** 다른 날짜로 저장했을 때 — 달력을 그 날로 옮겨 방금 저장한 일정이 보이게 한다 */
  onMoved: (d: Date) => void
  /** 추가·수정 폼을 열 때 — 시트를 펼쳐 폼이 다 보이게 한다 */
  onFormOpen?: () => void
}

export default function DayPanel({
  date, groupId, userId, entries, onAdd, onEdit, onDelete, onMoved, onFormOpen,
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
  const [repeatN, setRepeatN] = useState(1)
  // 반복 줄을 누르면 그 아래로 고르는 목록이 펼쳐진다
  const [repeatOpen, setRepeatOpen] = useState(false)
  // 저장할 날짜. 처음엔 지금 보고 있는 날이고, 폼에서 바꿀 수 있다.
  const [day, setDay] = useState(date)
  // 'HH:MM'. null이면 종일
  const [time, setTime] = useState<string | null>(null)
  // 이미 올라간 사진(경로)과 이번에 고른 사진(기기 안 파일)을 따로 든다.
  // 고른 사진은 저장을 누를 때 올린다 — 취소하면 Storage에 쓰레기가 남지 않는다.
  const [keptPaths, setKeptPaths] = useState<string[]>([])
  const [newUris, setNewUris] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lunar = solarToLunar(date)
  const dayLunar = solarToLunar(day)

  const dayEntries = entries.filter((e) =>
    occurrencesInMonth(e, date.getFullYear(), date.getMonth() + 1).some((d) => isSameDay(d, date)),
  ).sort(byTime)
  // 원본과 썸네일을 함께 서명한다 — 칸에는 썸네일, 크게 볼 땐 원본. 썸네일이 없는 예전 사진은 원본으로
  const urls = useImageUrls(dayEntries.flatMap((e) => (e.image_paths ?? []).flatMap((p) => [thumbPath(p), p])))
  const imageCount = keptPaths.length + newUris.length

  function reset() {
    setEditingId(null)
    setFormOpen(false)
    setTitle('')
    setMemo('')
    setIcon(null)
    setRepeat('none')
    setRepeatN(1)
    setRepeatOpen(false)
    setDateType('solar')
    setDay(date)
    setTime(null)
    setKeptPaths([])
    setNewUris([])
    setError(null)
  }

  function startEdit(e: EntryWithAuthor) {
    setEditingId(e.id)
    setFormOpen(true)
    onFormOpen?.()
    setTitle(e.title)
    setMemo(e.memo ?? '')
    setIcon(e.icon)
    setRepeat(e.repeat)
    setRepeatN(e.repeat_interval ?? 1)
    setRepeatOpen(false)
    setDateType(e.date_type)
    // 반복 일정은 연도(매월이면 달까지)를 안 보므로, 원래 기준일 대신 지금 보고 있는 날에서 시작한다
    setDay(date)
    setTime(e.event_time?.slice(0, 5) ?? null)
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
    // 음력은 해마다만 된다 — 매일·매주·매월은 양력 날짜로 세는 게 맞다
    if (next === 'lunar' && repeat !== 'none' && repeat !== 'yearly') setRepeat('yearly')
  }

  function pickDay() {
    DateTimePickerAndroid.open({
      value: day,
      mode: 'date',
      onChange: (ev, d) => ev.type === 'set' && d && setDay(d),
    })
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
    const moved = !isSameDay(day, date)
    if (isLunar && !dayLunar && (!editingId || moved)) {
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
        const thumb = await (await fetch(await makeThumb(uri))).arrayBuffer()
        uploaded.push(await uploadEntryImage(groupId, userId, body, thumb))
      }
      const image_paths = [...keptPaths, ...uploaded]

      if (editingId) {
        // 날짜는 바꿨을 때만 보낸다. 안 바꿨는데 보내면 반복 일정의 기준일이 지금 보는 날로 덮인다.
        await onEdit(editingId, {
          title: title.trim(),
          memo: memo.trim() || null,
          icon,
          repeat,
          repeat_interval: repeat === 'none' ? 1 : repeatN,
          image_paths,
          event_time: time,
          ...(moved && {
            event_date: toISODate(day),
            lunar_month: dayLunar && isLunar ? dayLunar.month : null,
            lunar_day: dayLunar && isLunar ? dayLunar.day : null,
            is_leap_month: dayLunar && isLunar ? dayLunar.isLeap : false,
          }),
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
          repeat_interval: repeat === 'none' ? 1 : repeatN,
          event_date: toISODate(day),
          lunar_month: dayLunar && isLunar ? dayLunar.month : null,
          lunar_day: dayLunar && isLunar ? dayLunar.day : null,
          is_leap_month: dayLunar && isLunar ? dayLunar.isLeap : false,
          event_time: time,
          image_paths,
        })
      }
      reset()
      if (moved) onMoved(day)
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

  // 폼이 열려 있으면 고른 날짜를, 아니면 달력에서 누른 날을 보여준다
  const shown = formOpen ? day : date
  const shownLunar = formOpen ? dayLunar : lunar
  const canSubmit = !!title.trim() && !saving

  return (
    <View style={{ padding: 18 }}>
        {/* 폼이 열려 있으면 맨 위 날짜가 곧 저장할 날짜다. 눌러서 바꾼다
            (안드로이드는 시스템 달력 창, iOS는 그 자리의 compact 피커) */}
        <Pressable
          onPress={formOpen && Platform.OS !== 'ios' ? pickDay : undefined}
          disabled={!formOpen || Platform.OS === 'ios'}
          accessibilityRole={formOpen ? 'button' : 'header'}
          accessibilityLabel={formOpen ? '날짜 바꾸기' : undefined}
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
          {formOpen && Platform.OS === 'ios' ? (
            <DateTimePicker value={day} mode="date" display="compact" onChange={(_, d) => d && setDay(d)} />
          ) : (
            <Text style={{ fontSize: 22, fontWeight: '600', color: c.fg, letterSpacing: -0.8 }}>
              {shown.getMonth() + 1}월 {shown.getDate()}일
              {formOpen && <Text style={{ fontSize: 15, color: c.accentStrong }}> ▾</Text>}
            </Text>
          )}
          {shownLunar && (
            <Text style={{ fontSize: 12, color: c.muted }}>
              음력 {shownLunar.month}.{shownLunar.day}
            </Text>
          )}
        </Pressable>

        {/* 추가·수정 중에는 그 날 목록을 감춘다 — 편집 화면에는 입력칸만 둔다 */}
        {!formOpen && (
          <View style={{ marginBottom: 18 }}>
            {dayEntries.length === 0 && (
              <Text style={{ color: c.faint, fontSize: 13, textAlign: 'center', paddingVertical: 18 }}>
                아직 계획이 없어요
              </Text>
            )}

            {dayEntries.map((e, i) => {
              const ico = findIcon(e.icon)
              const tappable = e.author_id === userId
              return (
                <Pressable
                  key={e.id}
                  onPress={() => startEdit(e)}
                  disabled={!tappable}
                  accessibilityRole={tappable ? 'button' : undefined}
                  accessibilityLabel={tappable ? `${e.title} 수정하기` : undefined}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 10,
                    paddingVertical: 11,
                    borderRadius: pressed ? 12 : 0,
                    backgroundColor: pressed ? c.shell : 'transparent',
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
                      {e.event_time && (
                        <Text style={{ fontSize: 13, fontWeight: '600', color: c.accentStrong, marginRight: 6 }}>
                          {formatTime(e.event_time)}
                        </Text>
                      )}
                      {ico && <Text style={{ fontSize: 15, marginRight: 5 }}>{ico.emoji}</Text>}
                      <Text style={{ fontSize: 15, fontWeight: '600', color: c.fg, letterSpacing: -0.3 }}>
                        {e.title}
                      </Text>
                      {e.date_type === 'lunar' && <Badge label="음력" tone="lunar" />}
                      {e.repeat !== 'none' && <Badge label={repeatLabel(e.repeat, e.repeat_interval)} />}
                    </View>
                    {e.memo && (
                      <Text style={{ marginTop: 5, fontSize: 13, lineHeight: 20, color: c.muted }}>
                        {e.memo}
                      </Text>
                    )}
                    {!!e.image_paths?.length && (
                      <View style={{ marginTop: 8 }}>
                        <Thumbs
                          uris={e.image_paths.map((p) => urls[thumbPath(p)] ?? urls[p])}
                          full={e.image_paths.map((p) => urls[p])}
                        />
                      </View>
                    )}
                    {/* 공유 달력이라 누가 적었는지가 중요하다 — 사진과 이름을 오른쪽 끝에 */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 5, marginTop: 6 }}>
                      <Avatar name={e.author?.name} url={e.author?.avatar_url} />
                      <Text style={{ fontSize: 11, color: c.muted }}>{e.author?.name ?? '알 수 없음'}</Text>
                    </View>
                  </View>

                  {/* 누를 수 있다는 표시 — 남의 일정에는 없다 */}
                  {tappable && (
                    <Text style={{ fontSize: 15, color: c.faint, marginTop: 2 }}>›</Text>
                  )}
                </Pressable>
              )
            })}
          </View>
        )}

        {!formOpen ? (
          <Pressable
            onPress={() => {
              setFormOpen(true)
              onFormOpen?.()
            }}
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
          {/* 시간 — 삼성 캘린더처럼 '하루 종일' 스위치를 끄면 그 자리에 시간 바퀴가 펼쳐진다 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: c.fg }}>하루 종일</Text>
            <Switch
              value={time === null}
              onValueChange={(allDay) => setTime(allDay ? null : '09:00')}
              trackColor={{ false: c.shellLine, true: c.accent }}
              thumbColor={c.surface}
              accessibilityLabel="하루 종일"
            />
          </View>
          {time !== null && <TimeWheel value={time} onChange={setTime} />}

          {/* 반복 — 줄을 누르면 고르는 목록이 펼쳐진다. 고른 줄에는 n을 바꾸는 −/+가 붙는다 */}
          <Pressable
            onPress={() => setRepeatOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityState={{ expanded: repeatOpen }}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}
          >
            <Text style={{ fontSize: 14, fontWeight: '500', color: c.fg }}>반복</Text>
            <Text style={{ fontSize: 14, fontWeight: '500', color: repeat === 'none' ? c.muted : c.accentStrong }}>
              {repeatLabel(repeat, repeatN)} {repeatOpen ? '▴' : '▾'}
            </Text>
          </Pressable>
          {repeatOpen && (
            <View style={{ borderRadius: radius.chip, backgroundColor: c.shell, paddingVertical: 4 }}>
              {[
                { rule: 'none' as const, unit: '' },
                // 음력은 해마다만 — 나머지는 양력 날짜로 센다
                ...REPEAT_UNITS.filter((u) => dateType === 'solar' || u.rule === 'yearly'),
              ].map((u) => {
                const on = repeat === u.rule
                return (
                  <Pressable
                    key={u.rule}
                    onPress={() => {
                      if (on) return
                      setRepeat(u.rule)
                      // 단위를 바꾸면 n은 1부터 — 3일마다에서 개월로 옮겨 '3개월마다'가 되면 뜻밖이다
                      setRepeatN(1)
                      if (u.rule === 'none') setRepeatOpen(false)
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 12, gap: 10 }}
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
                    {u.rule === 'none' ? (
                      <Text style={{ fontSize: 14, color: c.fg }}>반복 안 함</Text>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {on ? (
                          <>
                            <Stepper label="−" onPress={() => setRepeatN((n) => Math.max(1, n - 1))} />
                            <Text style={{ minWidth: 22, textAlign: 'center', fontSize: 15, fontWeight: '600', color: c.accentStrong }}>
                              {repeatN}
                            </Text>
                            <Stepper label="+" onPress={() => setRepeatN((n) => Math.min(99, n + 1))} />
                          </>
                        ) : (
                          <Text style={{ minWidth: 22, textAlign: 'center', fontSize: 14, color: c.muted }}>1</Text>
                        )}
                        <Text style={{ fontSize: 14, color: c.fg }}>{u.unit}마다</Text>
                      </View>
                    )}
                  </Pressable>
                )
              })}
            </View>
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

          {/* 사진 칸 끝의 + 칸으로 추가한다. 5장이 차면 + 칸이 사라진다 */}
          <View style={{ paddingTop: 6 }}>
            <Thumbs
              uris={[...keptPaths.map((p) => urls[thumbPath(p)] ?? urls[p]), ...newUris]}
              full={[...keptPaths.map((p) => urls[p]), ...newUris]}
              onRemove={removeImage}
              onAdd={imageCount < MAX_ENTRY_IMAGES ? () => void pickImages() : undefined}
            />
          </View>

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
            {/* 날짜 종류를 바꾸면 저장된 음/양력 기준이 흔들린다. 수정 중엔 아예 숨긴다 */}
            {!editingId && (
              <Segmented
                value={dateType}
                onChange={(v) => changeDateType(v)}
                options={[
                  { value: 'solar', label: '양력' },
                  { value: 'lunar', label: '음력' },
                ]}
              />
            )}
          </View>

          {!editingId && dateType === 'lunar' && repeat === 'yearly' && dayLunar && (
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
              매년 음력 {dayLunar.month}월 {dayLunar.day}일에 표시돼요.{' '}
              내년엔 {nextYearLabel(dayLunar.month, dayLunar.day, day.getFullYear() + 1)}.
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

// 목록 칸(64pt)용 썸네일. 원본(수백 KB)을 칸마다 받으면 사진 여러 장인 날이 느리다 — 이건 장당 10~20KB.
// 가로 240이면 3배 밀도 화면의 64pt 칸을 채운다.
const THUMB_WIDTH = 240

async function makeThumb(uri: string): Promise<string> {
  const img = await ImageManipulator.manipulate(uri).resize({ width: THUMB_WIDTH }).renderAsync()
  const out = await img.saveAsync({ compress: 0.7, format: SaveFormat.JPEG })
  return out.uri
}

function nextYearLabel(month: number, day: number, year: number): string {
  const d = lunarToSolarClamped(year, month, day)
  return d ? `양력 ${d.getMonth() + 1}월 ${d.getDate()}일` : '계산할 수 없어요'
}

/** 반복 간격 −/+ 버튼. 보이는 원은 28이지만 hitSlop으로 44를 채운다. */
function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? '간격 늘리기' : '간격 줄이기'}
      style={({ pressed }) => ({
        width: 28,
        height: 28,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? c.accentSoft : c.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: c.shellLine,
      })}
    >
      <Text style={{ fontSize: 16, color: c.accentStrong, lineHeight: 18 }}>{label}</Text>
    </Pressable>
  )
}
