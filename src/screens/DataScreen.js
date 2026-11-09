import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { ScreenHeader } from '../nav';
import { Card, Row, Tap, Txt } from '../ui';
import { FadeIn, CountUp } from '../motion';
import { TABLES } from '../db/schema';
import { toTables } from '../db/mapper';
import { colors, fonts, radius } from '../theme';
import { relTime } from '../dates';

const GROUPS = [
  { title: 'People & household', icon: 'people-outline', tables: ['households', 'users', 'household_members', 'user_preferences'] },
  { title: 'Meal planning', icon: 'calendar-outline', tables: ['weekly_schedules', 'daily_meals', 'meal_items', 'dishes', 'dish_ingredients'] },
  { title: 'Groceries', icon: 'basket-outline', tables: ['grocery_categories', 'grocery_items', 'purchase_history'] },
  { title: 'Activity', icon: 'pulse-outline', tables: ['notifications', 'notification_reads', 'audit_log', 'app_settings'] },
];

const fmt = (col, v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (col.name === 'password_hash') return String(v).slice(0, 12) + '…';
  if (col.type === 'bool') return v ? 'true' : 'false';
  if (col.type === 'ts') return new Date(v).toLocaleString();
  if (col.type === 'json') return JSON.stringify(v);
  return String(v);
};

export default function DataScreen() {
  const { db, me, dbInfo } = useStore();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(null);

  // Only this household's rows (BR-011)
  const T = useMemo(() => {
    const hid = me.householdId;
    return toTables({ ...db, users: db.users.filter((u) => u.householdId === hid), households: { [hid]: db.households[hid] } });
  }, [db, me.householdId]);
  const total = TABLES.reduce((a, tb) => a + T[tb.name].length, 0);
  const lw = dbInfo.lastWrite;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader back title="Data & storage" subtitle="How your household's information is stored" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 + insets.bottom }}>
        <FadeIn>
          <Card style={{ backgroundColor: colors.primary, borderColor: colors.primary }}>
            <Row gap={12}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="server-outline" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 16 }}>{dbInfo.kind === 'sqlite' ? 'SQLite database' : 'Structured row store'}</Text>
                <Text style={{ fontFamily: fonts.medium, color: 'rgba(255,255,255,0.75)', fontSize: 12.5 }}>{dbInfo.label}</Text>
              </View>
            </Row>
            <Row style={{ marginTop: 16 }} gap={10}>
              <Stat n={TABLES.length} label="tables" />
              <Stat n={total} label="rows (yours)" />
              <Stat n={dbInfo.writes} label="rows written" />
            </Row>
            <View style={{ marginTop: 14, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 10 }}>
              <Text style={{ fontFamily: fonts.semibold, color: '#fff', fontSize: 12.5 }}>
                {lw ? `Last save: ${lw.rows} row${lw.rows > 1 ? 's' : ''} in ${lw.tables.join(', ')} · ${relTime(lw.at)}` : 'Each change saves only the rows it touched.'}
              </Text>
            </View>
          </Card>
        </FadeIn>

        {GROUPS.map((g, gi) => (
          <FadeIn key={g.title} index={gi + 1} style={{ marginTop: 18 }}>
            <Row gap={6} style={{ marginLeft: 4, marginBottom: 8 }}>
              <Ionicons name={g.icon} size={15} color={colors.muted} />
              <Txt v="label">{g.title}</Txt>
            </Row>
            <Card pad={0}>
              {g.tables.map((name, i) => {
                const tb = TABLES.find((x) => x.name === name);
                const rows = T[name];
                const isOpen = open === name;
                return (
                  <View key={name} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                    <Tap onPress={() => setOpen(isOpen ? null : name)} scaleTo={0.99} accessibilityLabel={`${tb.label}, ${rows.length} rows`}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
                      <View style={{ flex: 1 }}>
                        <Txt v="title" style={{ fontSize: 15 }}>{tb.label}</Txt>
                        <Text style={{ fontFamily: 'monospace', fontSize: 12, color: colors.muted }}>{name}</Text>
                      </View>
                      <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
                        <CountUp value={rows.length} style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.ink }} />
                      </View>
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
                    </Tap>
                    {isOpen ? (
                      <FadeIn from={-6} duration={260} style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                        {tb.note ? <Txt v="caption" style={{ marginBottom: 8 }}>{tb.note}</Txt> : null}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 10 }}>
                          {tb.columns.map((col) => (
                            <View key={col.name} style={{ backgroundColor: col.pk ? colors.accentSoft : col.ref ? colors.infoSoft : colors.surfaceAlt, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                              <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.ink }}>{col.pk ? '🔑 ' : col.ref ? '🔗 ' : ''}{col.name}<Text style={{ color: colors.muted }}> {col.type}</Text></Text>
                            </View>
                          ))}
                        </ScrollView>
                        {rows.length === 0 ? <Txt v="small" style={{ fontStyle: 'italic' }}>No rows yet</Txt> : null}
                        {rows.slice(0, 25).map((r) => (
                          <View key={r.id} style={{ backgroundColor: colors.bg, borderRadius: 12, padding: 10, marginBottom: 6 }}>
                            {tb.columns.map((col) => (
                              <Row key={col.name} gap={8} center={false}>
                                <Text style={{ width: 118, fontFamily: fonts.semibold, fontSize: 11.5, color: colors.muted }} numberOfLines={1}>{col.name}</Text>
                                <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 11.5, color: colors.ink }} numberOfLines={2}>{fmt(col, r[col.name])}</Text>
                              </Row>
                            ))}
                          </View>
                        ))}
                        {rows.length > 25 ? <Txt v="caption">…and {rows.length - 25} more rows</Txt> : null}
                      </FadeIn>
                    ) : null}
                  </View>
                );
              })}
            </Card>
          </FadeIn>
        ))}
        <Txt v="caption" style={{ textAlign: 'center', marginTop: 18 }}>🔑 primary key · 🔗 foreign key. The same schema is provided as PostgreSQL in database/schema.sql for the server.</Txt>
      </ScrollView>
    </View>
  );
}

const Stat = ({ n, label }) => (
  <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 10 }}>
    <CountUp value={n} style={{ fontFamily: fonts.display, fontSize: 22, color: '#fff' }} />
    <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: 'rgba(255,255,255,0.75)' }}>{label}</Text>
  </View>
);
