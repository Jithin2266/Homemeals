import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { useNav, ScreenHeader } from '../nav';
import { Avatar, Card, Chip, EmptyState, Row, Segmented, Tap, Txt } from '../ui';
import { HistoryRow } from '../sheets';
import { FadeIn } from '../motion';
import { colors, fonts } from '../theme';
import { relTime } from '../dates';

const typeMeta = {
  schedule: { icon: 'calendar', c: colors.primary, bg: colors.primarySoft },
  'schedule-update': { icon: 'refresh', c: colors.info, bg: colors.infoSoft },
  grocery: { icon: 'basket', c: '#A86A07', bg: colors.accentSoft },
  purchase: { icon: 'checkmark-done', c: colors.purchased, bg: colors.purchasedSoft },
  member: { icon: 'person-add', c: colors.dinner, bg: colors.dinnerSoft },
};

const dayKey = (ts) => {
  const d = new Date(ts); const n = new Date();
  const diff = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : diff < 7 ? 'This week' : 'Earlier';
};

export default function ActivityScreen({ params }) {
  const { t, me, data, myNotifications, unreadCount, markAllRead, userById } = useStore();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const [seg, setSeg] = useState(params?.seg || 'notifications');
  const [who, setWho] = useState(null);
  useEffect(() => { if (params?.seg) setSeg(params.seg); }, [params?._k]);

  const grouped = (list, ts) => {
    const out = [];
    list.forEach((x) => { const k = dayKey(ts(x)); let g = out.find((o) => o.k === k); if (!g) { g = { k, items: [] }; out.push(g); } g.items.push(x); });
    return out;
  };

  const hist = useMemo(() => data.history.filter((h) => !who || h.by === who), [data.history, who]);
  const people = data.users.filter((u) => data.history.some((h) => h.by === u.id));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t('activity')}
        right={seg === 'notifications' && unreadCount ? [<Text key="m" onPress={markAllRead} accessibilityRole="button" style={{ fontFamily: fonts.bold, color: colors.primary, fontSize: 14, padding: 6 }}>Mark all read</Text>] : null} />
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <Segmented value={seg} onChange={setSeg} options={[{ value: 'notifications', label: `${t('notifications')}${unreadCount ? ` (${unreadCount})` : ''}` }, { value: 'history', label: t('history') }]} />
      </View>

      {seg === 'notifications' ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 + insets.bottom }}>
          {!myNotifications.length ? <EmptyState emoji="🔔" title="No notifications yet" body="Menu updates and grocery changes will show up here." /> :
            grouped(myNotifications, (n) => n.at).map((g, gi) => (
              <FadeIn key={g.k} index={gi} style={{ marginBottom: 12 }}>
                <Txt v="label" style={{ marginLeft: 4, marginBottom: 8 }}>{g.k}</Txt>
                <Card pad={4}>
                  {g.items.map((n, i) => {
                    const m = typeMeta[n.type] || typeMeta.grocery;
                    const unread = !n.readBy.includes(me.id);
                    return (
                      <Tap key={n.id} scaleTo={0.985} onPress={() => (n.type === 'member' ? nav.push('members') : nav.setTab(n.type.startsWith('schedule') ? 'plan' : 'grocery'))}
                        style={{ flexDirection: 'row', gap: 12, padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line, alignItems: 'flex-start' }}>
                        <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: m.bg, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={m.icon} size={19} color={m.c} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Txt v="title" style={{ fontSize: 14.5, fontFamily: unread ? fonts.bold : fonts.semibold }}>{n.title}</Txt>
                          {n.body ? <Txt v="small" numberOfLines={2}>{n.body}</Txt> : null}
                          <Txt v="caption" style={{ marginTop: 3 }}>{relTime(n.at)}</Txt>
                        </View>
                        {unread ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger, marginTop: 6 }} accessibilityLabel="Unread" /> : null}
                      </Tap>
                    );
                  })}
                </Card>
              </FadeIn>
            ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 + insets.bottom }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12, paddingHorizontal: 4 }}>
            <Chip label="Everyone" selected={!who} onPress={() => setWho(null)} color={colors.ink} />
            {people.map((u) => <Chip key={u.id} label={u.name.split(' ')[0]} selected={who === u.id} onPress={() => setWho(who === u.id ? null : u.id)} color={u.color} />)}
          </ScrollView>
          {grouped(hist, (h) => h.at).map((g, gi) => (
            <FadeIn key={g.k + (who || '')} index={gi} style={{ marginBottom: 12 }}>
              <Txt v="label" style={{ marginLeft: 4, marginBottom: 8 }}>{g.k}</Txt>
              <Card>{g.items.map((h, i) => <HistoryRow key={h.id} h={h} last={i === g.items.length - 1} />)}</Card>
            </FadeIn>
          ))}
          {!hist.length ? <EmptyState emoji="🧾" title="No activity yet" /> : null}
        </ScrollView>
      )}
    </View>
  );
}
