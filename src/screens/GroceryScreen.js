import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { useNav, ScreenHeader } from '../nav';
import { Button, Chip, EmptyState, IconBtn, ProgressBar, Row, StatusPill, Tap, Txt, useFeedback, haptic } from '../ui';
import { GroceryEditorSheet, ItemDetailSheet } from '../sheets';
import { CheckCircle, FadeIn, useExit, useCelebrate } from '../motion';
import { Animated } from 'react-native';
import { CATEGORIES, colors, fonts, radius, shadow, statusMeta } from '../theme';
import { diffDays, fmtShort, relTime, todayISO } from '../dates';

export default function GroceryScreen() {
  const { t, data, isCreator, setGroceryStatus, userById, clearPurchased } = useStore();
  const nav = useNav();
  const { toast, confirm } = useFeedback();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('tobuy');
  const [cat, setCat] = useState(null);
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [detail, setDetail] = useState(null);
  const [editor, setEditor] = useState(null); // {item} | {} for new
  const today = todayISO();

  const g = data.groceries;
  const counts = {
    tobuy: g.filter((x) => x.status === 'pending' || x.status === 'partial').length,
    purchased: g.filter((x) => x.status === 'purchased').length,
    cancelled: g.filter((x) => x.status === 'cancelled').length,
    all: g.length,
  };

  const filtered = useMemo(() => g.filter((x) => {
    if (status === 'tobuy' && !(x.status === 'pending' || x.status === 'partial')) return false;
    if (status === 'purchased' && x.status !== 'purchased') return false;
    if (status === 'cancelled' && x.status !== 'cancelled') return false;
    if (cat && x.category !== cat) return false;
    if (urgentOnly && x.priority !== 'urgent') return false;
    if (q && !(x.name + ' ' + x.remarks).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [g, status, cat, urgentOnly, q]);

  const groups = useMemo(() => {
    const m = {};
    filtered.forEach((x) => { (m[x.category] = m[x.category] || []).push(x); });
    return CATEGORIES.filter((c) => m[c.key]).map((c) => ({
      ...c,
      items: m[c.key].sort((a, b) => (a.priority === 'urgent' ? -1 : 0) - (b.priority === 'urgent' ? -1 : 0) || (b.updatedAt - a.updatedAt)),
    }));
  }, [filtered]);

  const catCounts = useMemo(() => {
    const m = {};
    g.forEach((x) => { if (status === 'all' || (status === 'tobuy' ? ['pending', 'partial'].includes(x.status) : x.status === status)) m[x.category] = (m[x.category] || 0) + 1; });
    return m;
  }, [g, status]);

  const celebrate = useCelebrate();
  const toggle = async (it, afterAnim) => {
    if (it.status === 'cancelled') { setDetail(it.id); return; }
    if (it.status === 'purchased') {
      const ok = await confirm({ title: `Move ${it.name} back to pending?`, body: `Marked purchased by ${userById(it.purchasedBy)?.name || 'someone'}. This is recorded in history.`, ok: 'Revert', icon: 'arrow-undo-outline' });
      if (!ok) return;
      const r = setGroceryStatus(it.id, 'pending', { version: it.version });
      if (!r.ok) return toast(r.error, { tone: 'error' });
      toast(`${it.name} moved back to pending`, { undo: r.undo });
      return;
    }
    const r = setGroceryStatus(it.id, 'purchased', { version: it.version });
    if (!r.ok) return toast(r.error, { tone: 'error' });
    haptic('success');
    toast(`${it.name} marked purchased`, { undo: r.undo });
    if (counts.tobuy === 1) celebrate();
  };

  const share = async () => {
    const open = g.filter((x) => x.status === 'pending' || x.status === 'partial');
    const lines = CATEGORIES.map((c) => {
      const items = open.filter((x) => x.category === c.key);
      if (!items.length) return null;
      return `${c.icon} *${t('cat_' + c.key)}*\n` + items.map((x) => `• ${x.name} — ${x.qty - (x.purchasedQty || 0)} ${x.unit}${x.priority === 'urgent' ? ' ⚡' : ''}${x.remarks ? ` (${x.remarks})` : ''}`).join('\n');
    }).filter(Boolean);
    const msg = `🛒 ${data.household.name} – Grocery list\n\n${lines.join('\n\n')}\n\nSent from HomeMeal`;
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard?.writeText(msg);
        toast('List copied — paste it in WhatsApp', { icon: 'copy' });
      } else {
        await Share.share({ message: msg });
      }
    } catch (e) {}
  };

  const clear = async () => {
    const ok = await confirm({ title: 'Clear purchased & cancelled?', body: 'They will be removed from the list. Purchase history is kept.', ok: 'Clear', icon: 'sparkles-outline' });
    if (!ok) return;
    const r = clearPurchased();
    toast(`${r.count} items cleared`);
  };

  const done = counts.purchased;
  const total = counts.tobuy + counts.purchased;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={t('groceryList')} subtitle={total ? `${done} of ${total} bought this round` : undefined}
        right={[
          <IconBtn key="s" icon="share-social-outline" label="Share list" onPress={share} />,
          <IconBtn key="h" icon="time-outline" label={t('history')} onPress={() => nav.setTab('activity', { seg: 'history' })} />,
        ]} />
      {total ? <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}><ProgressBar value={done / total} height={6} /></View> : null}

      {/* Search */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 10 }}>
        <Row style={{ backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line, height: 46 }}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder={t('search')} placeholderTextColor={colors.muted} accessibilityLabel={t('search')}
            style={[{ flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink, height: 44 }, Platform.OS === 'web' ? { outlineStyle: 'none' } : null]} />
          {q ? <Pressable onPress={() => setQ('')} hitSlop={10} accessibilityLabel="Clear search"><Ionicons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
        </Row>
      </View>

      {/* Status filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 8 }}>
        <Chip label="To buy" count={counts.tobuy} selected={status === 'tobuy'} onPress={() => setStatus('tobuy')} />
        <Chip label={t('purchased')} count={counts.purchased} selected={status === 'purchased'} onPress={() => setStatus('purchased')} color={colors.purchased} />
        <Chip label={t('cancelled')} count={counts.cancelled} selected={status === 'cancelled'} onPress={() => setStatus('cancelled')} color={colors.cancelled} />
        <Chip label={t('all')} count={counts.all} selected={status === 'all'} onPress={() => setStatus('all')} color={colors.ink} />
      </ScrollView>
      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 12 }}>
        <Chip label={t('urgent')} icon="flash" selected={urgentOnly} onPress={() => setUrgentOnly(!urgentOnly)} color={colors.danger} />
        {CATEGORIES.filter((c) => catCounts[c.key]).map((c) => (
          <Chip key={c.key} icon={c.icon} label={t('cat_' + c.key)} selected={cat === c.key} onPress={() => setCat(cat === c.key ? null : c.key)} color={colors.ink} />
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 + insets.bottom }}>
        {groups.length === 0 ? (
          q || cat || urgentOnly ? (
            <EmptyState emoji="🔍" title="No matching items" body="Try a different search or clear the filters." action="Clear filters" icon="refresh" onAction={() => { setQ(''); setCat(null); setUrgentOnly(false); }} />
          ) : status === 'tobuy' ? (
            <EmptyState emoji="🎉" title="Nothing left to buy" body={isCreator ? 'Add what the kitchen needs and the family will be notified.' : "You're all caught up. New items will show here."} action={isCreator ? t('addItem') : null} onAction={() => setEditor({})} />
          ) : (
            <EmptyState emoji="🧺" title="Nothing here yet" />
          )
        ) : groups.map((grp, gi) => (
          <FadeIn key={grp.key} index={gi} style={{ marginBottom: 14 }}>
            <Row style={{ marginBottom: 8, marginLeft: 4 }} gap={6}>
              <Text style={{ fontSize: 15 }}>{grp.icon}</Text>
              <Txt v="label">{t('cat_' + grp.key)}</Txt>
              <Txt v="caption">· {grp.items.length}</Txt>
            </Row>
            <View style={{ backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
              {grp.items.map((it, i) => <ItemRow key={it.id} it={it} first={i === 0} t={t} today={today} userById={userById} leaves={status === 'tobuy'} onToggle={(done) => toggle(it, done)} onOpen={() => setDetail(it.id)} />)}
            </View>
          </FadeIn>
        ))}
        {isCreator && (counts.purchased || counts.cancelled) && (status === 'purchased' || status === 'all' || status === 'cancelled') ? (
          <Button title="Clear purchased & cancelled" kind="ghost" icon="sparkles-outline" onPress={clear} style={{ alignSelf: 'center' }} />
        ) : null}
      </ScrollView>

      {/* Bottom actions */}
      <View style={{ position: 'absolute', right: 16, bottom: 78 + Math.max(insets.bottom, 10), flexDirection: 'row', gap: 10 }}>
        {counts.tobuy ? (
          <Tap onPress={() => nav.push('shopping')} accessibilityLabel={t('shoppingMode')} style={{ height: 54, borderRadius: 27, paddingHorizontal: 18, backgroundColor: isCreator ? colors.surface : colors.primary, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: isCreator ? colors.line : colors.primary, ...shadow.float }}>
            <Ionicons name="cart" size={20} color={isCreator ? colors.primary : '#fff'} />
            <Text style={{ fontFamily: fonts.bold, color: isCreator ? colors.primary : '#fff', fontSize: 14.5 }}>{t('shoppingMode')}</Text>
          </Tap>
        ) : null}
        {isCreator ? (
          <Tap onPress={() => setEditor({})} hapticKind="light" accessibilityLabel={t('addItem')} style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadow.float }}>
            <Ionicons name="add" size={28} color="#fff" />
          </Tap>
        ) : null}
      </View>

      <ItemDetailSheet visible={!!detail} itemId={detail} onClose={() => setDetail(null)} onEdit={(it) => setEditor({ item: it })} />
      <GroceryEditorSheet visible={!!editor} item={editor?.item} onClose={() => setEditor(null)} />
    </View>
  );
}

function ItemRow({ it, first, t, today, userById, onToggle, onOpen, leaves }) {
  const m = statusMeta[it.status];
  const [ticking, setTicking] = useState(false);
  const [exitStyle, runExit] = useExit();
  const done = it.status === 'purchased' || ticking;
  const cancelled = it.status === 'cancelled';
  const rem = it.qty - (it.purchasedQty || 0);
  const due = it.requiredBy ? diffDays(it.requiredBy, today) : null;
  const dueLabel = due == null ? null : due < 0 ? 'Overdue' : due === 0 ? 'Today' : due === 1 ? 'Tomorrow' : fmtShort(it.requiredBy);
  const press = () => {
    const open = it.status === 'pending' || it.status === 'partial';
    if (open && leaves) { haptic('success'); setTicking(true); runExit(() => { onToggle(true); setTicking(false); }); }
    else onToggle(false);
  };
  return (
    <Animated.View style={exitStyle}>
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${it.name}, ${it.qty} ${it.unit}, ${t(it.status)}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderTopWidth: first ? 0 : 1, borderTopColor: colors.line, backgroundColor: pressed ? colors.bg : 'transparent' })}>
      <Tap onPress={press} scaleTo={0.85} hitSlop={8} accessibilityRole="checkbox" accessibilityLabel={it.status === 'purchased' ? `Revert ${it.name}` : `Mark ${it.name} purchased`}>
        <CheckCircle checked={done} partial={it.status === 'partial' && !ticking} cancelled={cancelled} />
      </Tap>
      <View style={{ flex: 1 }}>
        <Row gap={6}>
          <Txt v="title" style={{ fontSize: 15.5, textDecorationLine: done || cancelled ? 'line-through' : 'none', color: done || cancelled ? colors.muted : colors.ink, flexShrink: 1 }} numberOfLines={1}>{it.name}</Txt>
          {it.priority === 'urgent' && !done && !cancelled ? <Ionicons name="flash" size={14} color={colors.danger} accessibilityLabel="Urgent" /> : null}
        </Row>
        <Txt v="caption" numberOfLines={1} style={{ marginTop: 1 }}>
          {it.status === 'partial' ? `${rem} of ${it.qty} ${it.unit} left` : `${it.qty} ${it.unit}`}
          {it.remarks ? ` · ${it.remarks}` : ''}
        </Txt>
        {it.status === 'purchased' || it.status === 'partial' ? (
          <Txt v="caption" style={{ color: m.color, marginTop: 2 }} numberOfLines={1}>{t(it.status)} by {userById(it.purchasedBy)?.name.split(' ')[0] || '—'} · {relTime(it.purchasedAt)}</Txt>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        {dueLabel && !done && !cancelled ? (
          <View style={{ backgroundColor: due <= 0 ? colors.dangerSoft : colors.surfaceAlt, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: due <= 0 ? colors.danger : colors.inkSoft }}>{dueLabel}</Text>
          </View>
        ) : null}
        {cancelled ? <StatusPill status={it.status} t={t} small /> : null}
      </View>
    </Pressable>
    </Animated.View>
  );
}
