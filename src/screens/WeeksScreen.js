import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore, scheduleStatus, countPlanned } from '../store';
import { useNav, ScreenHeader } from '../nav';
import { Button, Card, EmptyState, ProgressBar, Row, SchedulePill, Tap, Txt } from '../ui';
import { CreateWeekSheet } from '../sheets';
import { colors, fonts, shadow } from '../theme';
import { diffDays, fmtRange, relTime, todayISO } from '../dates';

export default function WeeksScreen() {
  const { t, isCreator, visibleSchedules } = useStore();
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const [create, setCreate] = useState(null);
  const today = todayISO();

  const bucket = (s) => { const d = diffDays(today, s.startDate); return d < 0 ? 'Upcoming' : d < 7 ? 'This week' : 'Past weeks'; };
  const sections = ['Upcoming', 'This week', 'Past weeks'].map((k) => ({ k, items: visibleSchedules.filter((s) => bucket(s) === k).sort((a, b) => (k === 'Past weeks' ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate))) })).filter((s) => s.items.length);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader back title={t('allWeeks')} subtitle={`${visibleSchedules.length} weekly ${visibleSchedules.length === 1 ? 'plan' : 'plans'}`} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 + insets.bottom }}>
        {!sections.length ? <EmptyState emoji="📅" title="No weekly plans yet" action={isCreator ? t('newWeek') : null} onAction={() => setCreate({})} /> : null}
        {sections.map((sec) => (
          <View key={sec.k} style={{ marginBottom: 10 }}>
            <Txt v="label" style={{ marginLeft: 4, marginBottom: 8, marginTop: 6 }}>{sec.k}</Txt>
            {sec.items.map((s) => {
              const st = scheduleStatus(s);
              const n = countPlanned(s);
              const lunches = Object.values(s.days).flatMap((d) => d.lunch.map((x) => x.name));
              return (
                <Card key={s.id} style={{ marginBottom: 10 }} onPress={() => nav.push('preview', { id: s.id })}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Txt v="title">{fmtRange(s.startDate)}</Txt>
                    <SchedulePill status={st} t={t} edited={s.editedAfterPublish} />
                  </Row>
                  <Txt v="caption" numberOfLines={1} style={{ marginTop: 6 }}>{lunches.length ? [...new Set(lunches)].slice(0, 4).join(' · ') : 'No meals yet'}</Txt>
                  <View style={{ marginTop: 10 }}><ProgressBar value={n / 21} height={5} color={st === 'draft' ? colors.accent : st === 'archived' ? colors.cancelled : colors.primary} /></View>
                  <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
                    <Txt v="caption">{n}/21 meals · {st === 'draft' ? `edited ${relTime(s.updatedAt)}` : `published ${relTime(s.publishedAt)}`}</Txt>
                    {isCreator ? (
                      <Tap onPress={() => setCreate({ sourceId: s.id })} accessibilityLabel={`Reuse ${fmtRange(s.startDate)}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.primarySoft }}>
                        <Ionicons name="copy-outline" size={14} color={colors.primary} />
                        <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.primary }}>Reuse</Text>
                      </Tap>
                    ) : null}
                  </Row>
                </Card>
              );
            })}
          </View>
        ))}
      </ScrollView>
      {isCreator ? (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16 + insets.bottom }}>
          <Button title={t('newWeek')} icon="add" full onPress={() => setCreate({})} style={shadow.float} />
        </View>
      ) : null}
      <CreateWeekSheet visible={!!create} sourceId={create?.sourceId} onClose={() => setCreate(null)} onCreated={(id, start) => { nav.pop(); setTimeout(() => nav.setTab('plan', { start }), 260); }} />
    </View>
  );
}
