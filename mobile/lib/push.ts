import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { supabase } from './supabase'

/**
 * 일정에서 @로 불렸을 때 받는 푸시 알림.
 * 서버는 push_tokens에 행이 있는 사람에게만 보낸다 — 끄면 행을 지운다 (supabase/migrations/010-mention-push.sql).
 * 기본은 켜짐. 설정에서 끈 것만 기기에 기억해 둔다.
 */
const OFF_KEY = 'share-calendar:mention-push-off'

// 앱을 보고 있을 때도 배너를 띄운다. 기본은 앱이 켜져 있으면 조용히 버린다
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export async function mentionPushOn(): Promise<boolean> {
  return (await AsyncStorage.getItem(OFF_KEY)) !== '1'
}

/** 권한을 받고 이 기기의 토큰을 저장한다. 권한을 거부하면 false */
export async function enableMentionPush(userId: string): Promise<boolean> {
  if (!Device.isDevice) throw new Error('실제 기기에서만 알림을 받을 수 있어요')
  // 안드로이드 8+는 채널이 있어야 뜬다. 서버도 channelId 'default'로 보낸다
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '일정 알림',
      importance: Notifications.AndroidImportance.HIGH,
    })
  }
  const { granted } = await Notifications.requestPermissionsAsync()
  if (!granted) return false
  // projectId는 app.json의 extra.eas.projectId에서 알아서 읽는다
  const { data: token } = await Notifications.getExpoPushTokenAsync()
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ user_id: userId, token, updated_at: new Date().toISOString() })
  if (error) throw error
  await AsyncStorage.removeItem(OFF_KEY)
  return true
}

export async function disableMentionPush(userId: string): Promise<void> {
  const { error } = await supabase.from('push_tokens').delete().eq('user_id', userId)
  if (error) throw error
  await AsyncStorage.setItem(OFF_KEY, '1')
}

/** 앱을 열 때마다 — 켜져 있으면 토큰을 다시 올린다 (토큰은 재설치 등으로 바뀔 수 있다) */
export async function syncMentionPush(userId: string): Promise<void> {
  if (await mentionPushOn()) await enableMentionPush(userId)
}

/** 일정을 저장한 뒤 부른 사람들에게 알린다. 실패해도 일정 저장은 이미 끝났다 */
export async function notifyMentions(groupId: string, userIds: string[], title: string, day: string) {
  if (userIds.length === 0) return
  const { error } = await supabase.rpc('notify_mentions', { gid: groupId, users: userIds, title, day })
  if (error) throw error
}
