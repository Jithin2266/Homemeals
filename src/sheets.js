import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore, countPlanned } from './store';
import { Button, Chip, Field, MealIcon, Row, Segmented, Sheet, StatusPill, Stepper, Tap, Txt, Avatar, haptic, useFeedback, Divider } from './ui';
import { CATEGORIES, MEALS, UNITS, colors, fonts, mealMeta, radius } from './theme';
import { addDays, dow, dowLong, dayNum, fmtRange, fmtShort, fmtStamp, mondayOf, relTime, todayISO, weekDates } from './dates';

const SPECIALS = ['Less spicy', 'No onion', 'Less oil', 'Low salt', 'Extra for guests', 'Pack for lunchbox'];

// ---------------- Meal editor ----------------
export function MealEditorSheet({ visible, onClose, schedule, date, meal: initialMeal, item }) {
  const { t, saveMealItem, removeMealItem, addIngredients, dishLibrary } = useStore();
  const { toast, confirm } = useFeedback();
  const [meal, setMeal] = useState(initialMeal);
  const [f, setF] = useState({});
  const [err, setErr] = useState('');
  const [picked, setPicked] = useState(null);
  const [addIng, setAddIng] = useState(true);
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (visible) {
      setMeal(initialMeal);
      setF(item ? { ...item } : { name: '', side: '', description: '', notes: '', special: '' });
      setErr(''); setPicked(null); setAddIng(true); setMore(!!(item && (item.description || item.notes)));
    }
  }, [visible]);

  const q = (f.name || '').trim().toLowerCase();
  const suggestions = useMemo(() => {
    const seen = new Set();
    return dishLibrary
      .filter((d) => (q ? (d.name + ' ' + d.side).toLowerCase().includes(q) : d.meal === meal))
      .filter((d) => { const k = d.name + '|' + d.side; if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 8);
  }, [q, meal, dishLibrary]);

  const pick = (d) => { haptic(); setF((p) => ({ ...p, name: d.name, side: d.side || '' })); setPicked(d); setErr(''); };
  const toggleSpecial = (s) => {
    const parts = (f.special || '').split(',').map((x) => x.trim()).filter(Boolean);
    const next = parts.includes(s) ? parts.filter((x) => x !== s) : [...parts, s];
    setF({ ...f, special: next.join(', ') });
  };

  const save = () => {
    if (!f.name?.trim()) { setErr('Give the dish a name'); haptic('warn'); return; }
    const r = saveMealItem(schedule.id, date, meal, f);
    if (!r.ok) { toast(r.error, { tone: 'error' }); return; }
    let msg = item ? 'Dish updated' : `${f.name.trim()} added to ${t(meal).toLowerCase()}`;
    if (picked?.ingredients?.length && addIng && !item) {
      const g = addIngredients(picked.ingredients);
      if (g.ok) msg += ` · ${g.added} to grocery${g.merged ? `, ${g.merged} merged` : ''}`;
    }
    haptic('success');
    toast(msg);
    onClose();
  };

  const del = async () => {
    const ok = await confirm({ title: `Remove ${item.name}?`, body: `It will be removed from ${dowLong(date)} ${t(meal).toLowerCase()}.`, ok: 'Remove', danger: true, icon: 'trash-outline' });
    if (!ok) return;
    const r = removeMealItem(schedule.id, date, meal, item.id);
    onClose();
    toast('Dish removed', { undo: r.undo, icon: 'trash' });
  };

  const specials = (f.special || '').split(',').map((x) => x.trim()).filter(Boolean);

  return (
    <Sheet visible={visible} onClose={onClose} title={item ? t('editDish') : t('addDish')} subtitle={date ? `${dowLong(date)}, ${fmtShort(date)}` : ''}
      footer={
        <Row gap={10}>
          {item ? <Button title="Remove" kind="danger" icon="trash-outline" onPress={del} /> : null}
          <Button title={item ? 'Save changes' : t('addDish')} icon="checkmark" onPress={save} style={{ flex: 1 }} full />
        </Row>
      }>
      {!item ? (
        <View style={{ marginBottom: 16 }}>
          <Segmented value={meal} onChange={setMeal} options={MEALS.map((m) => ({ value: m, label: t(m) }))} />
        </View>
      ) : null}
      <Field label={t('dishName')} value={f.name} onChangeText={(v) => { setF({ ...f, name: v }); setPicked(null); setErr(''); }} placeholder="e.g. Puttu, Meen curry" error={err} autoFocus={!item && Platform.OS !== 'web'} />
      {suggestions.length && !item ? (
        <View style={{ marginTop: -4, marginBottom: 14 }}>
          <Txt v="label" style={{ marginBottom: 8 }}>{q ? 'Matching dishes' : 'Quick pick'}</Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {suggestions.map((d, i) => {
              const on = picked && picked.name === d.name && picked.side === d.side;
              return (
                <Tap key={i} onPress={() => pick(d)} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, backgroundColor: on ? colors.primary : colors.surface, borderWidth: 1, borderColor: on ? colors.primary : colors.line, maxWidth: 200 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: on ? '#fff' : colors.ink }} numberOfLines={1}>{d.name}</Text>
                  {d.side ? <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: on ? 'rgba(255,255,255,0.8)' : colors.muted }} numberOfLines={1}>{d.side}</Text> : null}
                </Tap>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
      <Field label={t('sideDish')} value={f.side} onChangeText={(v) => setF({ ...f, side: v })} placeholder="e.g. Kadala curry, Pappadam" hint="Separate multiple sides with commas" />

      {picked?.ingredients?.length && !item ? (
        <Tap onPress={() => setAddIng(!addIng)} scaleTo={0.99} accessibilityRole="checkbox"
          style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: addIng ? colors.accentSoft : colors.surface, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: addIng ? '#F0D29B' : colors.line }}>
          <Ionicons name={addIng ? 'checkbox' : 'square-outline'} size={22} color={addIng ? '#A86A07' : colors.muted} />
          <View style={{ flex: 1 }}>
            <Txt v="title" style={{ fontSize: 14.5 }}>Add {picked.ingredients.length} ingredients to grocery list</Txt>
            <Txt v="caption" numberOfLines={2}>{picked.ingredients.map((i) => i.name).join(', ')}</Txt>
          </View>
        </Tap>
      ) : null}

      <Txt v="small" style={{ fontFamily: fonts.semibold, color: colors.ink, marginBottom: 8 }}>{t('specialInstr')}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {SPECIALS.map((s) => <Chip key={s} label={s} selected={specials.includes(s)} onPress={() => toggleSpecial(s)} color={colors.accent} />)}
      </View>

      {more ? (
        <>
          <Field label={t('description')} value={f.description} onChangeText={(v) => setF({ ...f, description: v })} placeholder="e.g. Sunday special" />
          <Field label={t('prepNotes')} value={f.notes} onChangeText={(v) => setF({ ...f, notes: v })} placeholder="e.g. Soak kadala overnight" multiline />
        </>
      ) : (
        <Pressable onPress={() => setMore(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, marginBottom: 8 }} accessibilityRole="button">
          <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          <Text style={{ fontFamily: fonts.bold, color: colors.primary, fontSize: 14 }}>Add description & preparation notes</Text>
        </Pressable>
      )}
    </Sheet>
  );
}

// ---------------- Copy a meal to other days ----------------
export function CopyMealSheet({ visible, onClose, schedule, date, meal }) {
  const { t, copyMeal } = useStore();
  const { toast } = useFeedback();
  const [sel, setSel] = useState([]);
  useEffect(() => { if (visible) setSel([]); }, [visible]);
  if (!schedule) return null;
  const dates = weekDates(schedule.startDate).filter((d) => d !== date);
  const src = schedule.days[date]?.[meal] || [];
  return (
    <Sheet visible={visible} onClose={onClose} title={`Copy ${t(meal).toLowerCase()}`} subtitle={src.map((x) => x.name).join(', ')}
      footer={<Button title={sel.length ? `Copy to ${sel.length} day${sel.length > 1 ? 's' : ''}` : 'Select days'} full icon="copy-outline" disabled={!sel.length}
        onPress={() => { copyMeal(schedule.id, date, meal, sel); toast(`Copied to ${sel.length} day(s)`); onClose(); }} />}>
      <Txt v="small" style={{ marginBottom: 12 }}>Existing {t(meal).toLowerCase()} on the selected days will be replaced.</Txt>
      {dates.map((d) => {
        const on = sel.includes(d);
        const cur = schedule.days[d]?.[meal] || [];
        return (
          <Tap key={d} onPress={() => setSel(on ? sel.filter((x) => x !== d) : [...sel, d])} accessibilityRole="checkbox"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: on ? colors.primarySoft : colors.surface, marginBottom: 8, borderWidth: 1, borderColor: on ? colors.primary : colors.line }}>
            <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.primary : colors.muted} />
            <View style={{ flex: 1 }}>
              <Txt v="title" style={{ fontSize: 14.5 }}>{dowLong(d)}, {fmtShort(d)}</Txt>
              <Txt v="caption" numberOfLines={1}>{cur.length ? cur.map((x) => x.name).join(', ') : t('notPlanned')}</Txt>
            </View>
          </Tap>
        );
      })}
    </Sheet>
  );
}

// ---------------- Create week ----------------
export function CreateWeekSheet({ visible, onClose, onCreated, defaultCopy, sourceId }) {
  const { t, data, createWeek, findOverlap, thisMonday } = useStore();
  const { toast } = useFeedback();
  const [start, setStart] = useState(null);
  const [mode, setMode] = useState('copy');
  const [src, setSrc] = useState(null);
  const [custom, setCustom] = useState(false);

  const mondays = [0, 7, 14, 21].map((n) => addDays(thisMonday, n));
  const pastWeeks = [...data.schedules].filter((s) => countPlanned(s) > 0).sort((a, b) => b.startDate.localeCompare(a.startDate));

  useEffect(() => {
    if (visible) {
      const firstFree = mondays.find((m) => !findOverlap(m));
      setStart(firstFree || null);
      setMode(defaultCopy === false ? 'empty' : 'copy');
      setSrc(sourceId || pastWeeks.find((s) => s.status !== 'draft')?.id || pastWeeks[0]?.id || null);
      setCustom(false);
    }
  }, [visible]);

  const create = () => {
    const r = createWeek(start, mode === 'copy' ? src : null);
    if (!r.ok) { toast(r.error, { tone: 'error' }); return; }
    haptic('success');
    toast(mode === 'copy' ? 'Week created from a previous plan — review & publish' : 'New week created');
    onClose();
    onCreated && onCreated(r.id, start);
  };

  const days14 = Array.from({ length: 21 }, (_, i) => addDays(todayISO(), i));

  return (
    <Sheet visible={visible} onClose={onClose} title={t('newWeek')} subtitle="A plan covers 7 days with breakfast, lunch and dinner."
      footer={<Button title={start ? `Create ${fmtRange(start)}` : 'Pick a start date'} full icon="sparkles-outline" disabled={!start || (mode === 'copy' && !src)} onPress={create} />}>
      <Txt v="label" style={{ marginBottom: 8 }}>1 · Start date</Txt>
      {!custom ? (
        <>
          {mondays.map((m, i) => {
            const clash = findOverlap(m);
            const on = start === m;
            return (
              <Tap key={m} disabled={!!clash} onPress={() => setStart(m)} accessibilityRole="radio"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 14, backgroundColor: on ? colors.primarySoft : colors.surface, marginBottom: 8, borderWidth: on ? 2 : 1, borderColor: on ? colors.primary : colors.line }}>
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? colors.primary : colors.muted} />
                <View style={{ flex: 1 }}>
                  <Txt v="title" style={{ fontSize: 14.5 }}>{fmtRange(m)}</Txt>
                  <Txt v="caption">{i === 0 ? t('thisWeek') : i === 1 ? t('nextWeek') : `In ${i} weeks`} · Mon–Sun</Txt>
                </View>
                {clash ? <Txt v="caption" style={{ color: colors.muted }}>Already planned</Txt> : null}
              </Tap>
            );
          })}
          <Pressable onPress={() => { setCustom(true); setStart(null); }} style={{ paddingVertical: 6 }} accessibilityRole="button">
            <Text style={{ fontFamily: fonts.bold, color: colors.primary, fontSize: 14 }}>Start on a different day…</Text>
          </Pressable>
        </>
      ) : (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 6 }}>
            {days14.map((d) => {
              const clash = findOverlap(d);
              const on = start === d;
              return (
                <Tap key={d} disabled={!!clash} onPress={() => setStart(d)} style={{ width: 56, paddingVertical: 10, borderRadius: 16, alignItems: 'center', backgroundColor: on ? colors.primary : colors.surface, borderWidth: 1, borderColor: on ? colors.primary : colors.line }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: on ? '#fff' : colors.muted }}>{dow(d)}</Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: on ? '#fff' : colors.ink }}>{dayNum(d)}</Text>
                </Tap>
              );
            })}
          </ScrollView>
          <Txt v="caption" style={{ marginTop: 4 }}>{start ? `Ends ${dowLong(addDays(start, 6))}, ${fmtShort(addDays(start, 6))}` : 'Greyed days overlap an existing plan.'}</Txt>
          <Pressable onPress={() => setCustom(false)} style={{ paddingVertical: 8 }}><Text style={{ fontFamily: fonts.bold, color: colors.primary }}>Back to weeks</Text></Pressable>
        </View>
      )}

      <Txt v="label" style={{ marginTop: 16, marginBottom: 8 }}>2 · How to start</Txt>
      <Segmented value={mode} onChange={setMode} options={[{ value: 'copy', label: 'Copy a week' }, { value: 'empty', label: 'Empty week' }]} />
      {mode === 'copy' ? (
        <View style={{ marginTop: 12 }}>
          {pastWeeks.length ? pastWeeks.map((s) => {
            const on = src === s.id;
            const sample = Object.values(s.days).flatMap((d) => d.lunch.map((x) => x.name)).slice(0, 3).join(', ');
            return (
              <Tap key={s.id} onPress={() => setSrc(s.id)} accessibilityRole="radio"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 14, backgroundColor: on ? colors.primarySoft : colors.surface, marginBottom: 8, borderWidth: on ? 2 : 1, borderColor: on ? colors.primary : colors.line }}>
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? colors.primary : colors.muted} />
                <View style={{ flex: 1 }}>
                  <Txt v="title" style={{ fontSize: 14.5 }}>{fmtRange(s.startDate)}</Txt>
                  <Txt v="caption" numberOfLines={1}>{countPlanned(s)}/21 meals · {sample}</Txt>
                </View>
              </Tap>
            );
          }) : <Txt v="small">No previous weeks yet.</Txt>}
          <Txt v="caption" style={{ marginTop: 2 }}>The original week stays unchanged. You can edit everything before publishing.</Txt>
        </View>
      ) : null}
    </Sheet>
  );
}

// ---------------- Grocery editor ----------------
const QUICK_ITEMS = [
  ['Milk', 'dairy', 1, 'litre'], ['Eggs', 'dairy', 1, 'dozen'], ['Coconut', 'vegetables', 2, 'nos'], ['Onion', 'vegetables', 1, 'kg'],
  ['Tomato', 'vegetables', 500, 'g'], ['Matta rice', 'grains', 5, 'kg'], ['Coconut oil', 'household', 1, 'litre'], ['Curd', 'dairy', 500, 'g'],
];

export function GroceryEditorSheet({ visible, onClose, item }) {
  const { t, saveGroceryItem, findSimilarItem } = useStore();
  const { toast } = useFeedback();
  const [f, setF] = useState({});
  const [errs, setErrs] = useState({});
  const [keepOpen, setKeepOpen] = useState(false);

  const blank = { name: '', category: 'vegetables', qty: '1', unit: 'kg', priority: 'normal', requiredBy: null, remarks: '' };
  useEffect(() => { if (visible) { setF(item ? { ...item, qty: String(item.qty) } : blank); setErrs({}); } }, [visible]);

  const dup = f.name && f.name.trim().length > 2 ? findSimilarItem(f.name, item?.id) : null;
  const stepFor = (u) => (u === 'g' || u === 'ml' ? 50 : u === 'kg' || u === 'litre' ? 0.5 : 1);

  const save = () => {
    const e = {};
    if (!f.name?.trim()) e.name = 'Item name is required';
    if (!(Number(f.qty) > 0)) e.qty = 'Enter a quantity';
    setErrs(e);
    if (Object.keys(e).length) { haptic('warn'); return; }
    const r = saveGroceryItem({ ...f, qty: Number(f.qty) });
    if (!r.ok) { toast(r.error, { tone: 'error' }); return; }
    haptic('success');
    toast(item ? 'Item updated' : `${f.name.trim()} added · family notified`);
    if (keepOpen && !item) { setF({ ...blank, category: f.category }); } else onClose();
  };

  const today = todayISO();
  const dateOpts = [
    { label: 'Anytime', v: null }, { label: t('today'), v: today }, { label: 'Tomorrow', v: addDays(today, 1) },
    { label: dow(addDays(today, 3)), v: addDays(today, 3) }, { label: 'This weekend', v: addDays(mondayOf(today), 5) },
  ];

  return (
    <Sheet visible={visible} onClose={onClose} title={item ? 'Edit item' : t('addItem')}
      footer={
        <View>
          {!item ? (
            <Pressable onPress={() => setKeepOpen(!keepOpen)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }} accessibilityRole="checkbox" accessibilityState={{ checked: keepOpen }}>
              <Ionicons name={keepOpen ? 'checkbox' : 'square-outline'} size={20} color={keepOpen ? colors.primary : colors.muted} />
              <Txt v="small">Add another after saving</Txt>
            </Pressable>
          ) : null}
          <Button title={item ? 'Save changes' : t('addItem')} icon="checkmark" full onPress={save} />
        </View>
      }>
      {!item ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
          {QUICK_ITEMS.map(([n, c, q, u]) => (
            <Chip key={n} label={n} icon="add" onPress={() => setF({ ...f, name: n, category: c, qty: String(q), unit: u })} selected={f.name === n} />
          ))}
        </ScrollView>
      ) : null}
      <Field label={t('itemName')} value={f.name} onChangeText={(v) => { setF({ ...f, name: v }); setErrs({ ...errs, name: null }); }} placeholder="e.g. Shallots" error={errs.name} />
      {dup ? (
        <View style={{ flexDirection: 'row', gap: 10, backgroundColor: colors.accentSoft, padding: 12, borderRadius: 14, marginTop: -6, marginBottom: 14 }} accessibilityRole="alert">
          <Ionicons name="warning-outline" size={20} color="#A86A07" />
          <View style={{ flex: 1 }}>
            <Txt v="small" style={{ fontFamily: fonts.bold, color: '#7A4E05' }}>Similar item already on the list</Txt>
            <Txt v="caption" style={{ color: '#7A4E05' }}>{dup.name} · {dup.qty} {dup.unit} · {t(dup.status)}. You can still add it.</Txt>
          </View>
        </View>
      ) : null}

      <Txt v="small" style={{ fontFamily: fonts.semibold, color: colors.ink, marginBottom: 8 }}>{t('category')}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {CATEGORIES.map((c) => <Chip key={c.key} icon={c.icon} label={t('cat_' + c.key)} selected={f.category === c.key} onPress={() => setF({ ...f, category: c.key })} />)}
      </View>

      <Row gap={12} center={false} style={{ marginBottom: 6 }}>
        <View style={{ flex: 1 }}>
          <Txt v="small" style={{ fontFamily: fonts.semibold, color: colors.ink, marginBottom: 6 }}>{t('quantity')}</Txt>
          <Stepper value={f.qty ?? ''} onChange={(v) => { setF({ ...f, qty: v }); setErrs({ ...errs, qty: null }); }} step={stepFor(f.unit)} />
          {errs.qty ? <Txt v="small" style={{ color: colors.danger, marginTop: 4 }}>{errs.qty}</Txt> : null}
        </View>
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>
        {UNITS.map((u) => <Chip key={u} label={u} selected={f.unit === u} onPress={() => setF({ ...f, unit: u })} />)}
      </ScrollView>

      <Txt v="small" style={{ fontFamily: fonts.semibold, color: colors.ink, marginTop: 6, marginBottom: 8 }}>{t('priority')}</Txt>
      <Row gap={8} style={{ marginBottom: 16 }}>
        <Chip label={t('normal')} selected={f.priority === 'normal'} onPress={() => setF({ ...f, priority: 'normal' })} />
        <Chip label={t('urgent')} icon="flash" selected={f.priority === 'urgent'} color={colors.danger} onPress={() => setF({ ...f, priority: 'urgent' })} />
      </Row>

      <Txt v="small" style={{ fontFamily: fonts.semibold, color: colors.ink, marginBottom: 8 }}>{t('requiredBy')}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {dateOpts.map((o) => <Chip key={o.label} label={o.v ? `${o.label} · ${fmtShort(o.v)}` : o.label} selected={f.requiredBy === o.v} onPress={() => setF({ ...f, requiredBy: o.v })} />)}
      </View>
      <Field label={t('remarks')} value={f.remarks} onChangeText={(v) => setF({ ...f, remarks: v })} placeholder="e.g. Nirapara brand, small size" />
    </Sheet>
  );
}

// ---------------- Item detail & status actions ----------------
export function ItemDetailSheet({ visible, onClose, itemId, onEdit }) {
  const { t, data, isCreator, setGroceryStatus, deleteGroceryItem, userById } = useStore();
  const { toast, confirm } = useFeedback();
  const [partial, setPartial] = useState(false);
  const [pq, setPq] = useState('');
  const item = data.groceries.find((g) => g.id === itemId);
  useEffect(() => { if (visible) { setPartial(false); setPq(item ? String(Math.max(0, item.qty / 2)) : ''); } }, [visible, itemId]);
  if (!item) return <Sheet visible={visible} onClose={onClose} title="Item"><Txt>This item was removed.</Txt></Sheet>;

  const cat = CATEGORIES.find((c) => c.key === item.category);
  const hist = data.history.filter((h) => h.itemId === item.id);
  const remaining = item.qty - (item.purchasedQty || 0);

  const act = (to, opts) => {
    const r = setGroceryStatus(item.id, to, { ...opts, version: item.version });
    if (!r.ok) { toast(r.error, { tone: 'error' }); return; }
    haptic('success');
    const msg = { purchased: `${item.name} marked purchased`, partial: `Recorded partial purchase`, pending: `${item.name} moved back to pending`, cancelled: `${item.name} cancelled` }[to];
    toast(msg, { undo: r.undo });
    onClose();
  };
  const revert = async () => {
    const ok = await confirm({ title: 'Move back to pending?', body: `${item.name} was marked purchased${item.purchasedBy ? ` by ${userById(item.purchasedBy)?.name.split(' ')[0]}` : ''}. This change is recorded in purchase history.`, ok: 'Revert', icon: 'arrow-undo-outline' });
    if (ok) act('pending');
  };
  const cancelItem = async () => {
    const ok = await confirm({ title: `Cancel ${item.name}?`, body: 'The family will no longer see it as needed. History is kept.', ok: 'Cancel item', cancel: 'Keep', danger: true, icon: 'close-circle-outline' });
    if (ok) act('cancelled');
  };
  const del = async () => {
    const ok = await confirm({ title: `Delete ${item.name}?`, body: 'It will be removed from the list. An audit record is kept.', ok: 'Delete', danger: true, icon: 'trash-outline' });
    if (!ok) return;
    const r = deleteGroceryItem(item.id);
    onClose();
    toast('Item deleted', { undo: r.undo, icon: 'trash' });
  };

  const open = item.status === 'pending' || item.status === 'partial';

  return (
    <Sheet visible={visible} onClose={onClose} title={item.name} subtitle={`${cat?.icon} ${t('cat_' + item.category)}`}
      footer={
        open ? (
          partial ? (
            <Row gap={10}>
              <Button title="Back" kind="secondary" onPress={() => setPartial(false)} />
              <Button title="Save" icon="checkmark" style={{ flex: 1 }} full disabled={!(Number(pq) > 0)} onPress={() => act('partial', { qty: Number(pq) + (item.purchasedQty || 0) })} />
            </Row>
          ) : (
            <Row gap={10}>
              <Button title={data.lang === 'en' ? 'Bought some' : t('boughtSome')} kind="secondary" onPress={() => setPartial(true)} />
              <Button title={t('markPurchased')} icon="checkmark-circle" style={{ flex: 1 }} full onPress={() => act('purchased')} />
            </Row>
          )
        ) : item.status === 'purchased' ? (
          <Button title="Move back to pending" kind="secondary" icon="arrow-undo-outline" full onPress={revert} />
        ) : isCreator ? <Button title="Restore to list" kind="secondary" icon="refresh" full onPress={() => act('pending')} /> : null
      }>
      {partial ? (
        <View>
          <Txt style={{ marginBottom: 12 }}>How much did you buy? {remaining} {item.unit} still needed.</Txt>
          <Stepper value={pq} onChange={setPq} step={item.unit === 'g' || item.unit === 'ml' ? 50 : item.unit === 'kg' || item.unit === 'litre' ? 0.5 : 1} />
          <Txt v="caption" style={{ marginTop: 8 }}>{Number(pq) >= remaining ? 'This completes the item — it will be marked Purchased.' : `${Math.max(0, remaining - Number(pq || 0))} ${item.unit} will remain on the list.`}</Txt>
        </View>
      ) : (
        <View>
          <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <View>
              <Txt v="label">{t('quantity')}</Txt>
              <Text style={{ fontFamily: fonts.display, fontSize: 30, color: colors.ink }}>{item.qty} <Text style={{ fontSize: 18, color: colors.muted }}>{item.unit}</Text></Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <StatusPill status={item.status} t={t} />
              {item.priority === 'urgent' ? <Row gap={4}><Ionicons name="flash" size={13} color={colors.danger} /><Txt v="caption" style={{ color: colors.danger, fontFamily: fonts.bold }}>{t('urgent')}</Txt></Row> : null}
            </View>
          </Row>
          {item.status === 'partial' ? (
            <View style={{ backgroundColor: colors.partialSoft, borderRadius: 14, padding: 12, marginBottom: 12 }}>
              <Txt v="small" style={{ color: colors.partial, fontFamily: fonts.bold }}>{item.purchasedQty} {item.unit} bought · {remaining} {item.unit} remaining</Txt>
            </View>
          ) : null}
          {item.requiredBy ? <InfoRow icon="calendar-outline" text={`Needed by ${dowLong(item.requiredBy)}, ${fmtShort(item.requiredBy)}`} /> : null}
          {item.remarks ? <InfoRow icon="chatbubble-ellipses-outline" text={item.remarks} /> : null}
          {item.purchasedBy ? <InfoRow icon="person-outline" text={`${item.status === 'partial' ? 'Partly bought' : 'Bought'} by ${userById(item.purchasedBy)?.name} · ${fmtStamp(item.purchasedAt)}`} /> : null}
          <InfoRow icon="add-circle-outline" text={`Added by ${userById(item.createdBy)?.name || '—'} · ${relTime(item.createdAt)}`} />

          {isCreator ? (
            <Row gap={8} style={{ marginTop: 10, flexWrap: 'wrap' }}>
              <Button small kind="soft" icon="create-outline" title="Edit" onPress={() => { onClose(); setTimeout(() => onEdit(item), 250); }} />
              {open ? <Button small kind="secondary" icon="close-circle-outline" title="Cancel item" onPress={cancelItem} /> : null}
              <Button small kind="danger" icon="trash-outline" title="Delete" onPress={del} />
            </Row>
          ) : null}

          <Divider style={{ marginVertical: 16 }} />
          <Txt v="label" style={{ marginBottom: 10 }}>Activity</Txt>
          {hist.map((h, i) => <HistoryRow key={h.id} h={h} last={i === hist.length - 1} compact />)}
        </View>
      )}
    </Sheet>
  );
}

const InfoRow = ({ icon, text }) => (
  <Row gap={10} style={{ paddingVertical: 7 }} center={false}>
    <Ionicons name={icon} size={18} color={colors.muted} style={{ marginTop: 1 }} />
    <Txt v="small" style={{ flex: 1, color: colors.ink }}>{text}</Txt>
  </Row>
);

export function HistoryRow({ h, last, compact }) {
  const { t, userById } = useStore();
  const u = userById(h.by);
  let text; let icon; let color;
  if (h.action === 'created') { text = compact ? 'Added to list' : `added ${h.itemName}`; icon = 'add'; color = colors.info; }
  else if (h.action === 'edited') { text = compact ? 'Details edited' : `edited ${h.itemName}`; icon = 'create'; color = colors.muted; }
  else if (h.action === 'deleted') { text = compact ? 'Deleted' : `deleted ${h.itemName}`; icon = 'trash'; color = colors.danger; }
  else if (h.action === 'reverted') { text = compact ? 'Reverted to pending' : `reverted ${h.itemName} to pending`; icon = 'arrow-undo'; color = colors.pending; }
  else {
    const verb = { purchased: 'marked purchased', partial: `bought ${h.qty} ${h.unit}`, cancelled: 'cancelled', pending: 'moved to pending' }[h.to] || h.to;
    text = compact ? verb[0].toUpperCase() + verb.slice(1) : `${verb} · ${h.itemName}`;
    icon = { purchased: 'checkmark', partial: 'contrast', cancelled: 'close', pending: 'ellipse-outline' }[h.to] || 'ellipse';
    color = { purchased: colors.purchased, partial: colors.partial, cancelled: colors.cancelled }[h.to] || colors.pending;
  }
  return (
    <Row gap={12} center={false}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={15} color={color} />
        </View>
        {!last ? <View style={{ width: 2, flex: 1, backgroundColor: colors.line, marginVertical: 2, minHeight: 14 }} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: 14 }}>
        <Txt v="small" style={{ color: colors.ink }}>
          <Text style={{ fontFamily: fonts.bold }}>{compact ? '' : (u?.name.split(' ')[0] || 'Someone') + ' '}</Text>{text}
        </Txt>
        <Txt v="caption">{compact ? `${u?.name || '—'} · ` : ''}{fmtStamp(h.at)}</Txt>
      </View>
    </Row>
  );
}
