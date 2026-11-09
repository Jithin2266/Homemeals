import React from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { useNav, ScreenHeader } from '../nav';
import { Avatar, Card, Chip, Row, Segmented, Tap, Txt, useFeedback, Button } from '../ui';
import { showAlert } from '../notify';
import { pendingCount } from '../NotificationAgent';
import { DEMO } from '../config';
import { colors, fonts } from '../theme';

export default function MoreScreen() {
  const { t, me, data, isCreator, logout, setLang, setPref, resetDemo } = useStore();
  const nav = useNav();
  const { confirm, toast, banner } = useFeedback();
  const insets = useSafeAreaInsets();
  const prefs = data.prefs[me.id] || {};
  const members = data.users.filter((u) => u.status !== 'deactivated');

  const LinkRow = ({ icon, label, sub, onPress, color = colors.ink, first }) => (
    <Tap onPress={onPress} scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14, borderTopWidth: first ? 0 : 1, borderTopColor: colors.line }}>
      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={18} color={color} /></View>
      <View style={{ flex: 1 }}>
        <Txt v="title" style={{ fontSize: 15, color }}>{label}</Txt>
        {sub ? <Txt v="caption">{sub}</Txt> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.lineStrong} />
    </Tap>
  );

  const Toggle = ({ k, label, sub, first }) => (
    <Row style={{ paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: first ? 0 : 1, borderTopColor: colors.line }}>
      <View style={{ flex: 1 }}>
        <Txt v="title" style={{ fontSize: 15 }}>{label}</Txt>
        {sub ? <Txt v="caption">{sub}</Txt> : null}
      </View>
      <Switch value={prefs[k] !== false} onValueChange={(v) => setPref(k, v)} trackColor={{ true: colors.primary, false: colors.lineStrong }} thumbColor="#fff" activeThumbColor="#fff" accessibilityLabel={label} />
    </Row>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t('more')} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 + insets.bottom, gap: 14 }}>
        <Card>
          <Row gap={14}>
            <Avatar user={me} size={56} />
            <View style={{ flex: 1 }}>
              <Txt v="h2">{me.name}</Txt>
              <Txt v="caption">{me.email || me.phone}</Txt>
              <Row gap={6} style={{ marginTop: 6 }}>
                <View style={{ backgroundColor: isCreator ? colors.primarySoft : colors.accentSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: isCreator ? colors.primary : '#8A5A08' }}>{isCreator ? 'Creator' : 'Viewer'}</Text>
                </View>
                <Txt v="caption">🏠 {data.household.name}</Txt>
              </Row>
            </View>
          </Row>
          <Row style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line }}>
            {members.slice(0, 5).map((u, i) => <View key={u.id} style={{ marginLeft: i ? -10 : 0, borderWidth: 2, borderColor: '#fff', borderRadius: 20, opacity: u.status === 'invited' ? 0.5 : 1 }}><Avatar user={u} size={32} /></View>)}
            <Txt v="small" style={{ flex: 1, marginLeft: 8 }}>{members.filter((u) => u.status === 'active').length} active members</Txt>
          </Row>
        </Card>

        <View>
          <Txt v="label" style={{ marginLeft: 4, marginBottom: 8 }}>Household</Txt>
          <Card pad={0}>
            <LinkRow first icon="people-outline" label={t('members')} sub={isCreator ? 'Invite, view and deactivate members' : 'See who shares this household'} onPress={() => nav.push('members')} />
            <LinkRow icon="albums-outline" label={t('allWeeks')} sub={isCreator ? 'Past, current and upcoming plans' : 'Past and current menus'} onPress={() => nav.push('weeks')} />
            <LinkRow icon="receipt-outline" label={t('history')} sub="Who bought what and when" onPress={() => nav.setTab('activity', { seg: 'history' })} />
            <LinkRow icon="server-outline" label="Data & storage" sub="Database tables and saved records" onPress={() => nav.push('data')} />
          </Card>
        </View>

        <View>
          <Txt v="label" style={{ marginLeft: 4, marginBottom: 8 }}>{t('language')}</Txt>
          <Segmented value={data.lang} onChange={setLang} options={[{ value: 'en', label: 'English' }, { value: 'ml', label: 'മലയാളം' }]} />
        </View>

        <View>
          <Txt v="label" style={{ marginLeft: 4, marginBottom: 8 }}>{t('notifications')}</Txt>
          <Card pad={0}>
            {!isCreator ? <Toggle first k="schedule" label="Menu published or updated" sub="When the weekly plan changes" /> : null}
            {!isCreator ? <Toggle k="grocery" label="Grocery items added" sub="Including urgent requests" /> : null}
            {isCreator ? <Toggle first k="purchase" label="Purchases by family" sub="When someone marks an item bought" /> : null}
            <Toggle k="sound" label="Notification sound" sub="Play the HomeMeal chime for new alerts" />
            <Toggle k="reminders" label="Daily reminder" sub="When items are still waiting to be bought" />
            {prefs.reminders !== false ? (
              <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                <Txt v="caption" style={{ marginBottom: 8 }}>Remind me at</Txt>
                <Row gap={8} style={{ flexWrap: 'wrap' }}>
                  {[[9, '9 AM'], [13, '1 PM'], [18, '6 PM'], [20, '8 PM']].map(([h, l]) => (
                    <Chip key={h} label={l} selected={(prefs.reminderHour ?? 18) === h} onPress={() => setPref('reminderHour', h)} />
                  ))}
                </Row>
              </View>
            ) : null}
            <View style={{ padding: 14, paddingTop: 4 }}>
              <Button small kind="soft" icon="notifications-outline" title="Send a test notification" onPress={() => {
                const n = pendingCount(data);
                const title = '🛒 Test: Coconut added to the list';
                const body = `${n} item${n === 1 ? '' : 's'} to buy now`;
                showAlert({ title, body, sound: prefs.sound !== false, badge: n, data: { open: 'grocery' } });
                banner({ title, body, count: n, icon: 'basket', onPress: () => nav.setTab('grocery') });
              }} />
            </View>
          </Card>
        </View>

        {DEMO ? (
        <View>
          <Txt v="label" style={{ marginLeft: 4, marginBottom: 8 }}>Demo</Txt>
          <Card pad={0}>
            <LinkRow first icon="swap-horizontal" label="Switch account" sub="Try the Creator and Viewer experiences" onPress={logout} />
            <LinkRow icon="refresh-circle-outline" label="Reset demo data" onPress={async () => {
              if (await confirm({ title: 'Reset demo data?', body: 'All changes in this demo will be replaced with the sample household.', ok: 'Reset', danger: true, icon: 'refresh' })) { resetDemo(); toast('Demo data reset'); }
            }} />
          </Card>
        </View>
        ) : null}

        <Card pad={0}>
          <LinkRow first icon="log-out-outline" label={t('signOut')} color={colors.danger} onPress={async () => { if (await confirm({ title: 'Sign out?', ok: t('signOut'), icon: 'log-out-outline' })) logout(); }} />
        </Card>
        <Txt v="caption" style={{ textAlign: 'center' }}>HomeMeal v1.2 · Built to SRS v1.0</Txt>
      </ScrollView>
    </View>
  );
}
