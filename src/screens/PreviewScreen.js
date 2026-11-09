import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, Share, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore, scheduleStatus, countPlanned, isSimilar } from '../store';
import { useNav, ScreenHeader } from '../nav';
import { Button, Card, IconBtn, MealIcon, ProgressBar, Row, SchedulePill, Sheet, Tap, Txt, useFeedback, haptic } from '../ui';
import { CATEGORIES, MEALS, colors, fonts, mealMeta } from '../theme';
import { FadeIn, useCelebrate } from '../motion';
import { dayNum, dow, dowLong, fmtRange, fmtShort, fmtStamp, todayISO, weekDates } from '../dates';

export default function PreviewScreen({ params }) {
  const { t, isCreator, data, publishSchedule, deleteSchedule, dishLibrary, addIngredients } = useStore();
  const nav = useNav();
  const { toast, confirm } = useFeedback();
  const insets = useSafeAreaInsets();
  const s = data.schedules.find((x) => x.id === params.id);
  const [ingOpen, setIngOpen] = useState(false);
  const celebrate = useCelebrate();
  const [picked, setPicked] = useState({});

  // Value-add: derive a grocery list from every dish in the week
  const ingredients = useMemo(() => {
    if (!s) return [];
    const out = [];
    Object.values(s.days).forEach((d) => MEALS.forEach((m) => d[m].forEach((it) => {
      const lib = dishLibrary.find((x) => x.name === it.name && (x.side || '') === (it.side || '')) || dishLibrary.find((x) => x.name === it.name);
      (lib?.ingredients || []).forEach((ing) => {
        const ex = out.find((o) => o.name === ing.name && o.unit === ing.unit);
        if (ex) { ex.qty += ing.qty; ex.uses += 1; } else out.push({ ...ing, uses: 1 });
      });
    })));
    return out.map((o) => ({ ...o, onList: data.groceries.some((g) => ['pending', 'partial'].includes(g.status) && isSimilar(g.name, o.name)) }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [s, dishLibrary, data.groceries]);

  if (!s) return <View style={{ flex: 1, backgroundColor: colors.bg }}><ScreenHeader back title="Week not found" /></View>;
  const st = scheduleStatus(s);
  const n = countPlanned(s);
  const today = todayISO();

  const publish = async () => {
    const ok = await confirm({ title: `Publish ${fmtRange(s.startDate)}?`, body: n < 21 ? `${21 - n} empty slot(s) can be filled later. The family will be notified.` : 'The family will be notified and can view this menu.', ok: 'Publish', icon: 'paper-plane-outline' });
    if (!ok) return;
    const r = publishSchedule(s.id);
    if (!r.ok) return toast(r.error, { tone: 'error' });
    haptic('success');
    celebrate();
    toast('Published · family notified', { icon: 'paper-plane' });
  };

  const del = async () => {
    const ok = await confirm({ title: 'Delete this draft?', body: 'This cannot be undone.', ok: 'Delete', danger: true, icon: 'trash-outline' });
    if (!ok) return;
    deleteSchedule(s.id);
    nav.pop();
    toast('Draft deleted');
  };

  const share = async () => {
    const lines = weekDates(s.startDate).map((d) => {
      const dd = s.days[d];
      const meals = MEALS.map((m) => dd[m].length ? `  ${m === 'breakfast' ? '☀️' : m === 'lunch' ? '🍛' : '🌙'} ${dd[m].map((x) => x.name + (x.side ? ` + ${x.side}` : '')).join(', ')}` : null).filter(Boolean);
      return meals.length ? `*${dowLong(d)} ${fmtShort(d)}*\n${meals.join('\n')}` : null;
    }).filter(Boolean);
    const msg = `🍽️ ${data.household.name} – Menu for ${fmtRange(s.startDate)}\n\n${lines.join('\n\n')}`;
    try {
      if (Platform.OS === 'web') { await navigator.clipboard?.writeText(msg); toast('Menu copied to clipboard', { icon: 'copy' }); }
      else await Share.share({ message: msg });
    } catch (e) {}
  };

  const openIng = () => {
    const p = {}; ingredients.forEach((x, i) => { p[i] = !x.onList; });
    setPicked(p); setIngOpen(true);
  };
  const addPicked = () => {
    const list = ingredients.filter((_, i) => picked[i]).map(({ name, qty, unit, category }) => ({ name, qty, unit, category }));
    const r = addIngredients(list);
    if (!r.ok) return toast(r.error, { tone: 'error' });
    setIngOpen(false);
    haptic('success');
    toast(`${r.added} added${r.merged ? `, ${r.merged} merged` : ''} · family notified`, { icon: 'basket' });
  };
  const pickedCount = Object.values(picked).filter(Boolean).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader back title={fmtRange(s.startDate)} subtitle={st === 'draft' ? 'Draft — review before publishing' : s.publishedAt ? `Published ${fmtStamp(s.publishedAt)}` : ''}
        right={[<IconBtn key="sh" icon="share-social-outline" label="Share menu" onPress={share} />]} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: (isCreator ? 110 : 40) + insets.bottom }}>
        <Card style={{ marginBottom: 14 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <SchedulePill status={st} t={t} edited={s.editedAfterPublish} />
            <Txt v="caption">{n}/21 meals</Txt>
          </Row>
          <View style={{ marginTop: 10 }}><ProgressBar value={n / 21} color={st === 'draft' ? colors.accent : colors.primary} height={6} /></View>
          {isCreator && ingredients.length ? (
            <Tap onPress={openIng} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, backgroundColor: colors.accentSoft, borderRadius: 14, padding: 12 }}>
              <Ionicons name="sparkles" size={20} color="#A86A07" />
              <View style={{ flex: 1 }}>
                <Txt v="title" style={{ fontSize: 14.5 }}>Build grocery list from this menu</Txt>
                <Txt v="caption">{ingredients.length} ingredients found · {ingredients.filter((x) => !x.onList).length} not on your list</Txt>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#A86A07" />
            </Tap>
          ) : null}
        </Card>

        {weekDates(s.startDate).map((d, di) => {
          const dd = s.days[d];
          const isToday = d === today;
          return (
            <FadeIn key={d} index={di}>
            <Card style={{ marginBottom: 10, borderColor: isToday ? colors.accent : colors.line, borderWidth: isToday ? 1.5 : 1 }}
              onPress={isCreator && st !== 'archived' ? () => { nav.setTab('plan', { start: s.startDate, date: d }); } : undefined}>
              <Row center={false} gap={14}>
                <View style={{ alignItems: 'center', width: 40 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: isToday ? '#A86A07' : colors.muted }}>{dow(d)}</Text>
                  <Text style={{ fontFamily: fonts.display, fontSize: 24, color: colors.ink }}>{dayNum(d)}</Text>
                  {isToday ? <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#A86A07' }}>TODAY</Text> : null}
                </View>
                <View style={{ flex: 1, gap: 8 }}>
                  {MEALS.map((m) => (
                    <Row key={m} gap={8} center={false}>
                      <Ionicons name={mealMeta[m].icon} size={15} color={mealMeta[m].color} style={{ marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        {dd[m].length ? (
                          <Txt v="small" style={{ color: colors.ink }} numberOfLines={2}>
                            <Text style={{ fontFamily: fonts.bold }}>{dd[m].map((x) => x.name).join(', ')}</Text>
                            {dd[m].some((x) => x.side) ? <Text style={{ color: colors.muted }}>{'  '}{dd[m].map((x) => x.side).filter(Boolean).join(', ')}</Text> : null}
                          </Txt>
                        ) : <Txt v="small" style={{ color: st === 'draft' ? colors.danger : colors.muted, fontStyle: 'italic' }}>{st === 'draft' ? `${t(m)} — empty` : '—'}</Txt>}
                      </View>
                    </Row>
                  ))}
                </View>
              </Row>
            </Card>
            </FadeIn>
          );
        })}
      </ScrollView>

      {isCreator ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 + insets.bottom, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.line }}>
          {st === 'draft' ? (
            <Row gap={10}>
              <IconBtn icon="trash-outline" label="Delete draft" onPress={del} color={colors.danger} bg={colors.dangerSoft} />
              <Button title="Edit" kind="secondary" icon="create-outline" onPress={() => nav.setTab('plan', { start: s.startDate })} />
              <Button title={t('publish')} icon="paper-plane-outline" onPress={publish} style={{ flex: 1 }} full />
            </Row>
          ) : st === 'published' ? (
            <Button title="Edit this week" kind="soft" icon="create-outline" full onPress={() => nav.setTab('plan', { start: s.startDate })} />
          ) : (
            <Txt v="small" style={{ textAlign: 'center' }}>Past weeks are kept for reference. Use “Reuse” in All weeks to copy it.</Txt>
          )}
        </View>
      ) : null}

      <Sheet visible={ingOpen} onClose={() => setIngOpen(false)} title="Ingredients for this week" subtitle="Items already on your list are unticked; matching items get merged."
        footer={<Button title={pickedCount ? `Add ${pickedCount} to grocery list` : 'Select items'} icon="basket-outline" full disabled={!pickedCount} onPress={addPicked} />}>
        {ingredients.map((x, i) => (
          <Tap key={i} onPress={() => setPicked({ ...picked, [i]: !picked[i] })} scaleTo={0.99} accessibilityRole="checkbox" accessibilityState={{ checked: !!picked[i] }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <Ionicons name={picked[i] ? 'checkbox' : 'square-outline'} size={22} color={picked[i] ? colors.primary : colors.muted} />
            <Text style={{ fontSize: 17 }}>{CATEGORIES.find((c) => c.key === x.category)?.icon}</Text>
            <View style={{ flex: 1 }}>
              <Txt v="title" style={{ fontSize: 14.5 }}>{x.name}</Txt>
              <Txt v="caption">{x.uses > 1 ? `Used in ${x.uses} meals` : 'Used in 1 meal'}{x.onList ? ' · already on list' : ''}</Txt>
            </View>
            <Txt v="title" style={{ fontSize: 14 }}>{x.qty} {x.unit}</Txt>
          </Tap>
        ))}
      </Sheet>
    </View>
  );
}
