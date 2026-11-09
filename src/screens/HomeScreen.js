import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore, scheduleStatus, countPlanned } from '../store';
import { useNav } from '../nav';
import { Avatar, Button, Card, IconBtn, MealIcon, ProgressBar, Row, SchedulePill, Tap, Txt, useFeedback, haptic } from '../ui';
import { CreateWeekSheet, GroceryEditorSheet, HistoryRow } from '../sheets';
import { CountUp, FadeIn, Pulse, Wiggle } from '../motion';
import { CATEGORIES, MEALS, colors, fonts, mealMeta, radius, shadow } from '../theme';
import { addDays, diffDays, dowLong, fmtRange, fmtShort, greeting, relTime, todayISO } from '../dates';

export default function HomeScreen() {
  const { me, t, isCreator, data, visibleSchedules, scheduleFor, thisMonday, unreadCount, setGroceryStatus } = useStore();
  const nav = useNav();
  const { toast } = useFeedback();
  const insets = useSafeAreaInsets();
  const [createOpen, setCreateOpen] = useState(false);
  const [addItem, setAddItem] = useState(false);

  const today = todayISO();
  const cur = scheduleFor(today);
  const next = visibleSchedules.find((s) => diffDays(s.startDate, thisMonday) >= 7 && diffDays(s.startDate, thisMonday) < 14);
  const todayMeals = cur ? cur.days[today] : null;

  const g = data.groceries;
  const pending = g.filter((x) => x.status === 'pending');
  const partial = g.filter((x) => x.status === 'partial');
  const purchased = g.filter((x) => x.status === 'purchased');
  const toBuy = [...pending, ...partial];
  const urgent = toBuy.filter((x) => x.priority === 'urgent' || (x.requiredBy && diffDays(x.requiredBy, today) <= 1));
  const recent = data.history.filter((h) => h.action !== 'created').slice(0, 3);

  // Viewer hero: the next meal coming up today
  const h = new Date().getHours();
  const nextMeal = h < 10 ? 'breakfast' : h < 15 ? 'lunch' : 'dinner';

  const quick = async (it) => {
    const r = setGroceryStatus(it.id, 'purchased', { version: it.version });
    if (!r.ok) { toast(r.error, { tone: 'error' }); return; }
    haptic('success');
    toast(`${it.name} marked purchased`, { undo: r.undo });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}>
        {/* Header */}
        <LinearGradient colors={[colors.primaryDark, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: 86, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}>
          <Row>
            <Tap onPress={() => nav.setTab('more')} accessibilityLabel="Profile"><Avatar user={me} size={42} /></Tap>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.medium, color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>{greeting()},</Text>
              <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 18 }}>{me.name.split(' ')[0]} 👋</Text>
            </View>
            <Wiggle trigger={unreadCount}><IconBtn icon="notifications-outline" label={t('notifications')} badge={unreadCount} onPress={() => nav.setTab('activity')} bg="rgba(255,255,255,0.14)" color="#fff" /></Wiggle>
          </Row>
          <Row style={{ marginTop: 22, justifyContent: 'space-between' }} center={false}>
            <FadeIn style={{ flex: 1 }} delay={120}>
              <Text style={{ fontFamily: fonts.bold, color: colors.accent, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>{t('today')} · {dowLong(today)}</Text>
              <Text style={{ fontFamily: fonts.display, color: '#fff', fontSize: 27, marginTop: 4, lineHeight: 33 }}>
                {isCreator ? "Here's what's cooking" : todayMeals?.[nextMeal]?.length ? `${t(nextMeal)}: ${todayMeals[nextMeal][0].name}` : "Today's menu"}
              </Text>
            </FadeIn>
          </Row>
        </LinearGradient>

        {/* Today's meals */}
        <FadeIn delay={180} from={24} style={{ marginHorizontal: 16, marginTop: -64 }}>
          <Card pad={6} style={shadow.float}>
            {todayMeals ? MEALS.map((m, i) => {
              const items = todayMeals[m];
              const highlight = !isCreator && m === nextMeal;
              return (
                <Tap key={m} scaleTo={0.985} onPress={() => nav.setTab('plan', { date: today })} accessibilityLabel={`${t(m)}: ${items.map((x) => x.name).join(', ') || t('notPlanned')}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: highlight ? mealMeta[m].soft : 'transparent' }}>
                  <MealIcon meal={m} size={42} />
                  <View style={{ flex: 1 }}>
                    <Row gap={6}>
                      <Txt v="label" style={{ color: mealMeta[m].color }}>{t(m)}</Txt>
                      <Txt v="caption">· {mealMeta[m].time}</Txt>
                      {highlight ? <Pulse><View style={{ backgroundColor: mealMeta[m].color, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}><Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 10 }}>NEXT</Text></View></Pulse> : null}
                    </Row>
                    {items.length ? (
                      <>
                        <Txt v="title" numberOfLines={1} style={{ marginTop: 2 }}>{items.map((x) => x.name).join(' + ')}</Txt>
                        {items[0].side ? <Txt v="caption" numberOfLines={1}>with {items.map((x) => x.side).filter(Boolean).join(', ')}</Txt> : null}
                      </>
                    ) : <Txt v="small" style={{ fontStyle: 'italic', marginTop: 2 }}>{t('notPlanned')}</Txt>}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.lineStrong} />
                </Tap>
              );
            }) : (
              <View style={{ padding: 18, alignItems: 'center' }}>
                <Text style={{ fontSize: 34 }}>🍽️</Text>
                <Txt v="title" style={{ marginTop: 6, textAlign: 'center' }}>{isCreator ? 'No menu for today yet' : "Today's menu isn't published yet"}</Txt>
                {isCreator ? <Button small title="Plan this week" icon="add" onPress={() => setCreateOpen(true)} style={{ marginTop: 12, alignSelf: 'center' }} /> : null}
              </View>
            )}
          </Card>
        </FadeIn>

        <View style={{ paddingHorizontal: 16, marginTop: 18, gap: 14 }}>
          <FadeIn index={1} delay={200} style={{ gap: 14 }}>
          {/* Getting started — new Creator household */}
          {isCreator && (!data.schedules.length || !g.length || data.users.length < 2) ? (
            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt v="h2">Get started</Txt>
                <Txt v="caption">{[data.schedules.length > 0, g.length > 0, data.users.length > 1].filter(Boolean).length}/3 done</Txt>
              </Row>
              <Txt v="small" style={{ marginTop: 2, marginBottom: 10 }}>Three quick steps to set up {data.household.name}.</Txt>
              {[
                { done: data.schedules.length > 0, icon: 'calendar-outline', title: 'Plan your first week', sub: 'Pick dishes for breakfast, lunch & dinner', on: () => setCreateOpen(true) },
                { done: g.length > 0, icon: 'basket-outline', title: 'Add grocery items', sub: 'Or build them from your menu', on: () => setAddItem(true) },
                { done: data.users.length > 1, icon: 'person-add-outline', title: 'Invite your family', sub: 'They join as Viewers with a code', on: () => nav.push('members') },
              ].map((x, i) => (
                <Tap key={x.title} onPress={x.on} disabled={x.done} scaleTo={0.985}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: x.done ? colors.purchased : colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={x.done ? 'checkmark' : x.icon} size={18} color={x.done ? '#fff' : colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt v="title" style={{ fontSize: 14.5, textDecorationLine: x.done ? 'line-through' : 'none', color: x.done ? colors.muted : colors.ink }}>{x.title}</Txt>
                    <Txt v="caption">{x.sub}</Txt>
                  </View>
                  {!x.done ? <Ionicons name="chevron-forward" size={18} color={colors.lineStrong} /> : null}
                </Tap>
              ))}
            </Card>
          ) : null}

          </FadeIn>
          <FadeIn index={2} delay={200} style={{ gap: 14 }}>
          {/* Quick actions — Creator */}
          {isCreator ? (
            <Row gap={10}>
              {[
                { icon: 'restaurant-outline', label: t('addDish'), on: () => nav.setTab('plan', { date: today }), c: colors.lunch, bg: colors.lunchSoft },
                { icon: 'cart-outline', label: t('addItem'), on: () => setAddItem(true), c: '#A86A07', bg: colors.accentSoft },
                { icon: 'copy-outline', label: t('newWeek'), on: () => setCreateOpen(true), c: colors.dinner, bg: colors.dinnerSoft },
                { icon: 'person-add-outline', label: 'Invite', on: () => nav.push('members'), c: colors.danger, bg: colors.dangerSoft },
              ].map((a) => (
                <Tap key={a.label} onPress={a.on} accessibilityLabel={a.label} style={{ flex: 1, alignItems: 'center', gap: 7, backgroundColor: colors.surface, borderRadius: 18, paddingVertical: 14, borderWidth: 1, borderColor: colors.line }}>
                  <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: a.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={a.icon} size={20} color={a.c} />
                  </View>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.ink, textAlign: 'center' }} numberOfLines={1}>{a.label}</Text>
                </Tap>
              ))}
            </Row>
          ) : null}

          </FadeIn>
          <FadeIn index={3} delay={200} style={{ gap: 14 }}>
          {/* Shopping card */}
          <Card onPress={() => nav.setTab('grocery')}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={10}>
                <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="basket" size={20} color="#A86A07" /></View>
                <View>
                  <Txt v="title">{t('groceryList')}</Txt>
                  <Txt v="caption">{toBuy.length ? `${toBuy.length} to buy · ${purchased.length} bought` : 'All caught up'}</Txt>
                </View>
              </Row>
              <Ionicons name="chevron-forward" size={18} color={colors.lineStrong} />
            </Row>
            <Row gap={8} style={{ marginTop: 14 }}>
              <Stat n={pending.length} label={t('pending')} color={colors.pending} bg={colors.pendingSoft} icon="ellipse-outline" />
              <Stat n={partial.length} label={data.lang === 'en' ? 'Partial' : t('partial')} color={colors.partial} bg={colors.partialSoft} icon="contrast-outline" />
              <Stat n={purchased.length} label={t('purchased')} color={colors.purchased} bg={colors.purchasedSoft} icon="checkmark-circle" />
            </Row>
            {urgent.length ? (
              <View style={{ marginTop: 14 }}>
                <Row gap={6} style={{ marginBottom: 6 }}><Ionicons name="flash" size={14} color={colors.danger} /><Txt v="label" style={{ color: colors.danger }}>Needed soon</Txt></Row>
                {urgent.slice(0, 3).map((it) => (
                  <Row key={it.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line }}>
                    <Text style={{ fontSize: 18 }}>{CATEGORIES.find((c) => c.key === it.category)?.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Txt v="title" style={{ fontSize: 14.5 }}>{it.name}</Txt>
                      <Txt v="caption">{it.qty - (it.purchasedQty || 0)} {it.unit}{it.requiredBy ? ` · by ${diffDays(it.requiredBy, today) <= 0 ? 'today' : diffDays(it.requiredBy, today) === 1 ? 'tomorrow' : fmtShort(it.requiredBy)}` : ''}</Txt>
                    </View>
                    <Tap onPress={() => quick(it)} accessibilityLabel={`Mark ${it.name} purchased`} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.primarySoft, flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                      <Ionicons name="checkmark" size={15} color={colors.primary} />
                      <Text style={{ fontFamily: fonts.bold, color: colors.primary, fontSize: 12.5 }}>Bought</Text>
                    </Tap>
                  </Row>
                ))}
              </View>
            ) : null}
            {toBuy.length ? <Button title={t('shoppingMode')} icon="cart" full kind={isCreator ? 'soft' : 'primary'} onPress={() => nav.push('shopping')} style={{ marginTop: 14 }} /> : null}
          </Card>

          </FadeIn>
          <FadeIn index={4} delay={200} style={{ gap: 14 }}>
          {/* Week status */}
          <Txt v="label" style={{ marginTop: 6, marginLeft: 4 }}>{isCreator ? 'Your weekly plans' : 'Weekly menus'}</Txt>
          <WeekCard s={cur} label={t('thisWeek')} start={thisMonday} t={t} isCreator={isCreator} onOpen={(s) => nav.setTab('plan', { start: s.startDate })} onCreate={() => setCreateOpen(true)} />
          <WeekCard s={next} label={t('nextWeek')} start={addDays(thisMonday, 7)} t={t} isCreator={isCreator} onOpen={(s) => nav.setTab('plan', { start: s.startDate })} onCreate={() => setCreateOpen(true)} />

          </FadeIn>
          <FadeIn index={5} delay={200} style={{ gap: 14 }}>
          {/* Recent activity */}
          {recent.length ? (
            <>
              <Row style={{ justifyContent: 'space-between', marginTop: 6, marginHorizontal: 4 }}>
                <Txt v="label">Recent activity</Txt>
                <Text onPress={() => nav.setTab('activity', { seg: 'history' })} style={{ fontFamily: fonts.bold, color: colors.primary, fontSize: 13 }}>See all</Text>
              </Row>
              <Card>
                {recent.map((h, i) => <HistoryRow key={h.id} h={h} last={i === recent.length - 1} />)}
              </Card>
            </>
          ) : null}
          </FadeIn>
        </View>
      </ScrollView>

      <CreateWeekSheet visible={createOpen} onClose={() => setCreateOpen(false)} onCreated={(id, s) => nav.setTab('plan', { start: s })} />
      <GroceryEditorSheet visible={addItem} onClose={() => setAddItem(false)} />
    </View>
  );
}

const Stat = ({ n, label, color, bg, icon }) => (
  <View style={{ flex: 1, backgroundColor: bg, borderRadius: 14, padding: 10 }} accessibilityLabel={`${n} ${label}`}>
    <Row gap={4}><Ionicons name={icon} size={13} color={color} /><Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color, flexShrink: 1 }} numberOfLines={2}>{label}</Text></Row>
    <CountUp value={n} style={{ fontFamily: fonts.display, fontSize: 24, color: colors.ink, marginTop: 2 }} />
  </View>
);

function WeekCard({ s, label, start, t, isCreator, onOpen, onCreate }) {
  if (!s) {
    if (!isCreator) {
      return (
        <Card style={{ backgroundColor: colors.surfaceAlt, borderStyle: 'dashed' }}>
          <Row><Ionicons name="time-outline" size={20} color={colors.muted} /><View style={{ flex: 1 }}><Txt v="title">{label} · {fmtRange(start)}</Txt><Txt v="caption">Not published yet — you'll be notified.</Txt></View></Row>
        </Card>
      );
    }
    return (
      <Card onPress={onCreate} style={{ borderStyle: 'dashed', borderWidth: 1.5, borderColor: colors.lineStrong, backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 }}>
        <Row>
          <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="add" size={22} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Txt v="title">Plan {label.toLowerCase()}</Txt>
            <Txt v="caption">{fmtRange(start)} · start fresh or copy a past week</Txt>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.lineStrong} />
        </Row>
      </Card>
    );
  }
  const st = scheduleStatus(s);
  const n = countPlanned(s);
  return (
    <Card onPress={() => onOpen(s)}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Txt v="caption">{label}</Txt>
          <Txt v="title">{fmtRange(s.startDate)}</Txt>
        </View>
        <SchedulePill status={st} t={t} edited={s.editedAfterPublish} />
      </Row>
      <View style={{ marginTop: 12 }}>
        <ProgressBar value={n / 21} color={st === 'draft' ? colors.accent : colors.primary} height={6} />
        <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
          <Txt v="caption">{n} of 21 meals planned</Txt>
          <Txt v="caption">{st === 'draft' ? `Edited ${relTime(s.updatedAt)}` : `Published ${relTime(s.publishedAt)}`}</Txt>
        </Row>
      </View>
      {isCreator && st === 'draft' ? (
        <Row gap={6} style={{ marginTop: 12, backgroundColor: colors.accentSoft, borderRadius: 12, padding: 10 }}>
          <Ionicons name="eye-off-outline" size={16} color="#8A5A08" />
          <Txt v="caption" style={{ color: '#8A5A08', flex: 1 }}>Family can't see this yet. Finish and publish when ready.</Txt>
        </Row>
      ) : null}
    </Card>
  );
}
