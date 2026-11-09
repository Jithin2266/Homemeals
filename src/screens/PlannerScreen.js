import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore, scheduleStatus, countPlanned } from '../store';
import { useNav, ScreenHeader } from '../nav';
import { Button, Card, EmptyState, IconBtn, MealIcon, ProgressBar, Row, SchedulePill, Tap, Txt, useFeedback, haptic } from '../ui';
import { MealEditorSheet, CopyMealSheet, CreateWeekSheet } from '../sheets';
import { FadeIn, useCelebrate } from '../motion';
import { MEALS, colors, fonts, mealMeta, radius, shadow } from '../theme';
import { addDays, dayNum, diffDays, dow, dowLong, fmtRange, fmtShort, relTime, todayISO, weekDates } from '../dates';

export default function PlannerScreen({ params }) {
  const { t, isCreator, visibleSchedules, thisMonday, data, publishSchedule } = useStore();
  const nav = useNav();
  const { toast, confirm } = useFeedback();
  const insets = useSafeAreaInsets();
  const today = todayISO();

  // Week options: all visible schedules + this/next week placeholders (Creator)
  const weeks = useMemo(() => {
    const starts = visibleSchedules.map((s) => s.startDate);
    const covers = (d) => visibleSchedules.some((s) => { const x = diffDays(d, s.startDate); return x >= 0 && x < 7; });
    const extra = [];
    if (!covers(today)) extra.push(thisMonday);
    if (isCreator && !covers(addDays(thisMonday, 7)) && !covers(addDays(thisMonday, 13))) extra.push(addDays(thisMonday, 7));
    return [...new Set([...starts, ...extra])].sort();
  }, [visibleSchedules, isCreator]);

  const initialStart = () => {
    if (params?.start && weeks.includes(params.start)) return params.start;
    const d = params?.date || today;
    const s = visibleSchedules.find((x) => { const k = diffDays(d, x.startDate); return k >= 0 && k < 7; });
    return s ? s.startDate : thisMonday;
  };
  const [start, setStart] = useState(initialStart);
  const schedule = visibleSchedules.find((s) => s.startDate === start);
  const dates = weekDates(start);
  const [dayState, setDay] = useState(() => {
    const d = params?.date || today;
    return dates.includes(d) ? d : dates[0];
  });
  const day = dates.includes(dayState) ? dayState : dates.includes(today) ? today : dates[0];
  useEffect(() => { if (params?._k) { const s = initialStart(); setStart(s); if (params.date) setDay(params.date); } }, [params?._k]);

  const celebrate = useCelebrate();
  const dirRef = useRef(0);
  const [editor, setEditor] = useState(null);
  const [copy, setCopy] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const idx = weeks.indexOf(start);
  const status = scheduleStatus(schedule);
  const planned = countPlanned(schedule);
  const canEdit = isCreator && schedule && status !== 'archived';

  const go = (dir) => {
    const ni = idx + dir;
    if (ni >= 0 && ni < weeks.length) { haptic(); setStart(weeks[ni]); }
  };
  const dayIdx = dates.indexOf(day);
  const pan = useRef(null);
  const moveDay = (dir) => {
    const i = dates.indexOf(dayRef.current) + dir;
    if (i >= 0 && i < 7) { haptic(); dirRef.current = dir; setDay(dates[i]); }
  };
  const dayRef = useRef(day); dayRef.current = day;
  pan.current = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.8,
    onPanResponderRelease: (_, g) => { if (g.dx < -50) moveDay(1); else if (g.dx > 50) moveDay(-1); },
  });

  const publish = async () => {
    const empty = 21 - planned;
    const ok = await confirm({
      title: `Publish ${fmtRange(start)}?`,
      body: empty ? `${empty} meal slot${empty > 1 ? 's are' : ' is'} still empty — you can fill them later. The family will be notified.` : 'Everyone in the household will be notified and can view this menu.',
      ok: 'Publish', icon: 'paper-plane-outline',
    });
    if (!ok) return;
    const r = publishSchedule(schedule.id);
    if (!r.ok) { toast(r.error, { tone: 'error' }); return; }
    haptic('success');
    celebrate();
    toast('Published · family notified', { icon: 'paper-plane' });
  };

  // Viewer: upcoming not yet published notice (SRS §11)
  const nextUnpublished = !isCreator && !visibleSchedules.some((s) => diffDays(s.startDate, thisMonday) >= 7 && diffDays(s.startDate, thisMonday) < 14);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title={isCreator ? 'Weekly planner' : t('meals')}
        right={[
          <IconBtn key="h" icon="albums-outline" label={t('allWeeks')} onPress={() => nav.push('weeks')} />,
          schedule ? <IconBtn key="p" icon="eye-outline" label={t('preview')} onPress={() => nav.push('preview', { id: schedule.id })} /> : null,
        ]}
      />

      {/* Week switcher */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
        <Row style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 6, borderWidth: 1, borderColor: colors.line }}>
          <IconBtn icon="chevron-back" label="Previous week" onPress={() => go(-1)} bg={idx > 0 ? colors.surfaceAlt : 'transparent'} color={idx > 0 ? colors.ink : colors.lineStrong} size={18} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Txt v="title">{fmtRange(start)}</Txt>
            <Txt v="caption">{start === thisMonday || (diffDays(today, start) >= 0 && diffDays(today, start) < 7) ? t('thisWeek') : diffDays(start, today) > 0 ? 'Upcoming' : 'Past week'}</Txt>
          </View>
          <IconBtn icon="chevron-forward" label="Next week" onPress={() => go(1)} bg={idx < weeks.length - 1 ? colors.surfaceAlt : 'transparent'} color={idx < weeks.length - 1 ? colors.ink : colors.lineStrong} size={18} />
        </Row>
      </View>

      {!schedule ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          {isCreator ? (
            <EmptyState emoji="🗓️" title="No plan for this week yet" body="Start from scratch or copy a week your family enjoyed — then tweak and publish." action="Plan this week" onAction={() => setCreateOpen(true)} />
          ) : (
            <EmptyState emoji="⏳" title="Menu not published yet" body="The homemaker hasn't published meals for this week. You'll get a notification as soon as it's ready." />
          )}
        </ScrollView>
      ) : (
        <>
          {/* Status + progress */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <SchedulePill status={status} t={t} edited={schedule.editedAfterPublish} />
              <Txt v="caption">{planned}/21 meals planned</Txt>
            </Row>
            <ProgressBar value={planned / 21} color={status === 'draft' ? colors.accent : colors.primary} height={6} />
          </View>

          {/* Day strip */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingBottom: 12 }} style={{ flexGrow: 0, flexShrink: 0 }}>
            {dates.map((d) => {
              const on = d === day;
              const isToday = d === today;
              const dd = schedule.days[d];
              return (
                <Tap key={d} onPress={() => { dirRef.current = dates.indexOf(d) > dates.indexOf(day) ? 1 : -1; setDay(d); }} accessibilityRole="tab" accessibilityLabel={`${dowLong(d)} ${fmtShort(d)}`}
                  style={{ width: 48, paddingVertical: 9, borderRadius: 16, alignItems: 'center', backgroundColor: on ? colors.primary : colors.surface, borderWidth: 1, borderColor: on ? colors.primary : isToday ? colors.accent : colors.line, ...(on ? shadow.card : {}) }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: on ? 'rgba(255,255,255,0.8)' : isToday ? '#A86A07' : colors.muted }}>{isToday ? 'Today' : dow(d)}</Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: on ? '#fff' : colors.ink, marginTop: 1 }}>{dayNum(d)}</Text>
                  <Row gap={3} style={{ marginTop: 5 }}>
                    {MEALS.map((m) => (
                      <View key={m} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: dd[m].length ? (on ? '#fff' : mealMeta[m].color) : on ? 'rgba(255,255,255,0.3)' : colors.line }} />
                    ))}
                  </Row>
                </Tap>
              );
            })}
          </ScrollView>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: (canEdit ? 190 : 120) + insets.bottom }} {...pan.current.panHandlers}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 12, marginTop: 4 }}>
              <Txt v="h1">{dowLong(day)}<Text style={{ color: colors.muted, fontFamily: fonts.display }}>  {fmtShort(day)}</Text></Txt>
              <Row gap={4}>
                <IconBtn icon="arrow-back" size={17} label="Previous day" onPress={() => moveDay(-1)} bg="transparent" color={dayIdx > 0 ? colors.ink : colors.lineStrong} />
                <IconBtn icon="arrow-forward" size={17} label="Next day" onPress={() => moveDay(1)} bg="transparent" color={dayIdx < 6 ? colors.ink : colors.lineStrong} />
              </Row>
            </Row>

            {MEALS.map((m, mi) => (
              <FadeIn key={day + m} index={mi} dx={dirRef.current * 40} from={6} duration={340}>
              <MealCard meal={m} items={schedule.days[day][m]} t={t} canEdit={canEdit}
                onAdd={() => setEditor({ meal: m, item: null })}
                onEdit={(it) => setEditor({ meal: m, item: it })}
                onCopy={() => setCopy({ meal: m })} />
              </FadeIn>
            ))}

            {nextUnpublished && start === thisMonday ? (
              <View style={{ flexDirection: 'row', gap: 10, backgroundColor: colors.infoSoft, borderRadius: 16, padding: 14, marginTop: 4 }}>
                <Ionicons name="time-outline" size={20} color={colors.info} />
                <Txt v="small" style={{ flex: 1, color: colors.info }}>Next week's menu hasn't been published yet. We'll notify you when it is.</Txt>
              </View>
            ) : null}
            {canEdit ? <Txt v="caption" style={{ textAlign: 'center', marginTop: 6 }}>Tip: swipe left or right to change day</Txt> : null}
          </ScrollView>

          {canEdit ? (
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 64 + Math.max(insets.bottom, 10), paddingHorizontal: 16, paddingBottom: 10 }}>
              <View style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.line, ...shadow.float }}>
                {status === 'draft' ? (
                  <>
                    <View style={{ flex: 1, paddingLeft: 6 }}>
                      <Txt v="title" style={{ fontSize: 14 }}>Draft · only you can see it</Txt>
                      <Txt v="caption">Auto-saved {relTime(schedule.updatedAt)}</Txt>
                    </View>
                    <Button small title={t('publish')} icon="paper-plane-outline" onPress={publish} />
                  </>
                ) : (
                  <>
                    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.purchasedSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="people" size={17} color={colors.purchased} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt v="title" style={{ fontSize: 14 }}>Live for the family</Txt>
                      <Txt v="caption">Edits sync instantly and are flagged “Updated”</Txt>
                    </View>
                    <Button small kind="soft" title="Review" onPress={() => nav.push('preview', { id: schedule.id })} />
                  </>
                )}
              </View>
            </View>
          ) : null}
        </>
      )}

      {schedule ? (
        <>
          <MealEditorSheet visible={!!editor} onClose={() => setEditor(null)} schedule={schedule} date={day} meal={editor?.meal || 'breakfast'} item={editor?.item} />
          <CopyMealSheet visible={!!copy} onClose={() => setCopy(null)} schedule={schedule} date={day} meal={copy?.meal || 'breakfast'} />
        </>
      ) : null}
      <CreateWeekSheet visible={createOpen} onClose={() => setCreateOpen(false)} onCreated={(id, s) => setStart(s)} />
    </View>
  );
}

function MealCard({ meal, items, t, canEdit, onAdd, onEdit, onCopy }) {
  const m = mealMeta[meal];
  const [open, setOpen] = useState(null);
  return (
    <Card style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }} pad={0}>
      <View style={{ height: 4, backgroundColor: m.color, opacity: 0.85 }} />
      <View style={{ padding: 14 }}>
        <Row>
          <MealIcon meal={meal} size={38} />
          <View style={{ flex: 1 }}>
            <Txt v="title">{t(meal)}</Txt>
            <Txt v="caption">{m.time}{items.length > 1 ? ` · ${items.length} dishes` : ''}</Txt>
          </View>
          {canEdit && items.length ? <IconBtn icon="copy-outline" size={18} label={`Copy ${meal} to other days`} onPress={onCopy} bg={colors.surfaceAlt} /> : null}
          {canEdit ? <IconBtn icon="add" size={22} label={`Add dish to ${meal}`} onPress={onAdd} bg={m.soft} color={m.color} /> : null}
        </Row>

        {items.length === 0 ? (
          canEdit ? (
            <Pressable onPress={onAdd} accessibilityRole="button" style={{ marginTop: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.lineStrong, borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
              <Ionicons name="add" size={18} color={colors.muted} />
              <Text style={{ fontFamily: fonts.semibold, color: colors.muted, fontSize: 14 }}>{t('addDish')}</Text>
            </Pressable>
          ) : <Txt v="small" style={{ marginTop: 10, color: colors.muted, fontStyle: 'italic' }}>{t('notPlanned')}</Txt>
        ) : (
          <View style={{ marginTop: 10, gap: 8 }}>
            {items.map((it) => {
              const extra = it.description || it.notes;
              const expanded = open === it.id;
              return (
                <Tap key={it.id} scaleTo={0.985} onPress={() => (canEdit ? onEdit(it) : setOpen(expanded ? null : it.id))}
                  accessibilityLabel={`${it.name}${it.side ? ' with ' + it.side : ''}`}
                  style={{ backgroundColor: colors.bg, borderRadius: 14, padding: 12 }}>
                  <Row center={false}>
                    <View style={{ flex: 1 }}>
                      <Txt v="title" style={{ fontSize: 15.5 }}>{it.name}</Txt>
                      {it.side ? <Txt v="small" style={{ marginTop: 1 }}>with {it.side}</Txt> : null}
                    </View>
                    {canEdit ? <Ionicons name="create-outline" size={17} color={colors.muted} /> : extra ? <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={colors.muted} /> : null}
                  </Row>
                  {it.special ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {it.special.split(',').map((s) => s.trim()).filter(Boolean).map((s) => (
                        <View key={s} style={{ backgroundColor: colors.accentSoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: '#8A5A08' }}>{s}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {extra && (canEdit || expanded) ? (
                    <View style={{ marginTop: 8, gap: 2 }}>
                      {it.description ? <Txt v="caption" style={{ color: colors.inkSoft }}>{it.description}</Txt> : null}
                      {it.notes ? <Txt v="caption" style={{ color: colors.inkSoft }}>📝 {it.notes}</Txt> : null}
                    </View>
                  ) : null}
                </Tap>
              );
            })}
          </View>
        )}
      </View>
    </Card>
  );
}
