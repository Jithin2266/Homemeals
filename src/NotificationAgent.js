// Watches the household's notifications for the signed-in user and, for
// anything new: plays the chime, shows a system notification + an in-app
// banner with the number of items still to buy, keeps the app-icon badge
// up to date and schedules the daily "pending items" reminder.
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from './store';
import { useNav } from './nav';
import { useFeedback } from './ui';
import { colors } from './theme';
import { initNotifications, onNotificationTap, scheduleReminder, setBadge, showAlert } from './notify';

const FRESH_MS = 3 * 24 * 3600 * 1000;
const keyOf = (n) => `${n.id}@${n.at}`;

export const pendingCount = (data) => data.groceries.filter((g) => g.status === 'pending' || g.status === 'partial').length;

export function describeAlert(fresh, { isCreator, toBuy }) {
  const items = (n) => `${n} item${n === 1 ? '' : 's'}`;
  const grocery = fresh.filter((n) => n.type === 'grocery');
  const target = fresh.every((n) => n.type.startsWith('schedule')) ? 'plan' : fresh.every((n) => n.type === 'member') ? 'members' : 'grocery';
  if (!isCreator && grocery.length && grocery.length === fresh.length) {
    const n = grocery[0];
    return {
      title: grocery.length === 1 ? `🛒 ${n.title}` : `🛒 ${grocery.length} grocery updates`,
      body: `${grocery.length === 1 && n.body ? n.body + ' · ' : ''}${items(toBuy)} to buy now`,
      count: toBuy, icon: 'basket', target,
    };
  }
  if (fresh.length === 1) {
    const n = fresh[0];
    const icon = { purchase: 'checkmark-done', schedule: 'calendar', 'schedule-update': 'refresh', member: 'person-add', grocery: 'basket' }[n.type] || 'notifications';
    return { title: n.title, body: n.type === 'grocery' ? `${n.body} · ${items(toBuy)} to buy` : n.body, icon, target, count: n.type === 'grocery' ? toBuy : undefined };
  }
  return {
    title: `${fresh.length} new updates`,
    body: fresh.slice(0, 3).map((n) => n.title).join(' · ') + (toBuy && !isCreator ? ` · ${items(toBuy)} to buy` : ''),
    icon: 'notifications', target, count: !isCreator ? toBuy : undefined,
  };
}

export default function NotificationAgent() {
  const { me, data, isCreator, myNotifications, unreadCount } = useStore();
  const nav = useNav();
  const { banner } = useFeedback();
  const seen = useRef(null);
  const prefs = (data.prefs && data.prefs[me.id]) || {};
  const sound = prefs.sound !== false;
  const toBuy = pendingCount(data);
  const storeKey = `hm:alerted:${me.id}`;

  // Permissions, channels, taps on system notifications
  useEffect(() => {
    initNotifications();
    return onNotificationTap((d) => nav.setTab(d.open || 'grocery'));
  }, []);

  // Load what this user has already been alerted about
  useEffect(() => {
    let alive = true;
    (async () => {
      let ids = [];
      try { ids = JSON.parse((await AsyncStorage.getItem(storeKey)) || '[]'); } catch (e) {}
      if (!alive) return;
      seen.current = new Set(ids);
      check();
    })();
    return () => { alive = false; };
  }, [me.id]);

  useEffect(() => { if (seen.current) check(); }, [myNotifications]);

  // Catch up when the app comes back to the foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active' && seen.current) check(); });
    return () => sub.remove();
  }, [myNotifications]);

  function check() {
    const fresh = myNotifications.filter((n) => !seen.current.has(keyOf(n)) && !n.readBy.includes(me.id) && Date.now() - n.at < FRESH_MS);
    if (!fresh.length) return;
    fresh.forEach((n) => seen.current.add(keyOf(n)));
    AsyncStorage.setItem(storeKey, JSON.stringify([...seen.current].slice(-400))).catch(() => {});
    const a = describeAlert(fresh, { isCreator, toBuy });
    showAlert({ title: a.title, body: a.body, sound, badge: isCreator ? unreadCount : toBuy, data: { open: a.target, tag: fresh[0].id } });
    banner({
      title: a.title, body: a.body, icon: a.icon, count: a.count,
      bg: a.icon === 'basket' ? colors.accentSoft : colors.primarySoft, color: a.icon === 'basket' ? '#A86A07' : colors.primary,
      onPress: () => (a.target === 'members' ? nav.push('members') : nav.setTab(a.target)),
    });
  }

  // App-icon badge: items to buy for Viewers, unread updates for the Creator
  useEffect(() => { setBadge(isCreator ? unreadCount : toBuy); }, [toBuy, unreadCount, isCreator]);

  // Daily reminder while items are pending
  useEffect(() => {
    const id = setTimeout(() => scheduleReminder({ enabled: prefs.reminders !== false, count: toBuy, hour: prefs.reminderHour ?? 18, sound }), 800);
    return () => clearTimeout(id);
  }, [toBuy, prefs.reminders, prefs.reminderHour, sound]);

  return null;
}
