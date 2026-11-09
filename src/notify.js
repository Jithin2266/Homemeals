// Phone notifications (Android / iOS) — local notifications with a custom chime,
// app-icon badge count and a daily "items still to buy" reminder.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const SOUND = 'grocery_chime.wav';
const REMINDER_ID = 'homemeal-pending-reminder';
let permission = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

export async function initNotifications() {
  try {
    if (Platform.OS === 'android') {
      // Channel sound is fixed once created, so there is a chime channel and a quiet one.
      await Notifications.setNotificationChannelAsync('grocery', {
        name: 'Grocery alerts', description: 'New items to buy and purchases', importance: Notifications.AndroidImportance.HIGH,
        sound: SOUND, vibrationPattern: [0, 220, 140, 220], enableVibrate: true, lightColor: '#1F5C46',
      });
      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Shopping reminders', description: 'Daily reminder when items are pending', importance: Notifications.AndroidImportance.DEFAULT,
        sound: SOUND, vibrationPattern: [0, 200], enableVibrate: true,
      });
      await Notifications.setNotificationChannelAsync('quiet', {
        name: 'Silent updates', importance: Notifications.AndroidImportance.DEFAULT, sound: null, enableVibrate: false,
      });
    }
    let p = await Notifications.getPermissionsAsync();
    if (!p.granted && p.canAskAgain) p = await Notifications.requestPermissionsAsync();
    permission = p.granted;
  } catch (e) { permission = false; }
  return permission;
}

export async function showAlert({ title, body, sound = true, badge, data, channel = 'grocery' }) {
  if (permission === false) return false;
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: sound ? SOUND : false, badge, data: data || {}, color: '#1F5C46' },
      trigger: Platform.OS === 'android' ? { channelId: sound ? channel : 'quiet' } : null,
    });
    return true;
  } catch (e) { return false; }
}

export async function setBadge(n) {
  try { await Notifications.setBadgeCountAsync(Math.max(0, n || 0)); } catch (e) {}
}

export async function scheduleReminder({ enabled, count, hour = 18, sound = true }) {
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
    if (!enabled || !count || permission === false) return;
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: {
        title: `🛒 ${count} item${count > 1 ? 's' : ''} still to buy`,
        body: 'Open HomeMeal to see the grocery list.',
        sound: sound ? SOUND : false, badge: count, data: { open: 'grocery' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 0, channelId: sound ? 'reminders' : 'quiet' },
    });
  } catch (e) {}
}

export function onNotificationTap(cb) {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => cb(r.notification.request.content.data || {}));
  return () => sub.remove();
}

// In-app sound is played by the system notification itself on phones.
export function playChime() {}
export const notificationsSupported = true;
