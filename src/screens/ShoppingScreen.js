import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { useNav } from '../nav';
import { Button, IconBtn, ProgressBar, Row, Tap, Txt, useFeedback, haptic } from '../ui';
import { ItemDetailSheet } from '../sheets';
import { CheckCircle, CountUp, FadeIn, PopIn, useCelebrate } from '../motion';
import { CATEGORIES, colors, fonts, radius } from '../theme';

// Distraction-free, one-handed list for use inside the shop.
export default function ShoppingScreen() {
  const { t, data, setGroceryStatus } = useStore();
  const nav = useNav();
  const { toast } = useFeedback();
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState(null);
  // Keep items that were open when the trip started, so ticked ones stay visible (struck through)
  const session = useRef(new Set(data.groceries.filter((x) => x.status === 'pending' || x.status === 'partial').map((x) => x.id))).current;
  data.groceries.forEach((x) => { if (x.status === 'pending' || x.status === 'partial') session.add(x.id); });

  const items = data.groceries.filter((x) => session.has(x.id) && x.status !== 'cancelled');
  const got = items.filter((x) => x.status === 'purchased').length;
  const groups = useMemo(() => CATEGORIES.map((c) => ({ ...c, items: items.filter((x) => x.category === c.key) })).filter((c) => c.items.length), [items]);
  const allDone = items.length > 0 && got === items.length;
  const celebrate = useCelebrate();
  const wasDone = useRef(allDone);
  useEffect(() => { if (allDone && !wasDone.current) celebrate(); wasDone.current = allDone; }, [allDone]);

  const tick = (it) => {
    if (it.status === 'purchased') {
      const r = setGroceryStatus(it.id, 'pending', { version: it.version });
      if (!r.ok) return toast(r.error, { tone: 'error' });
      haptic();
      return;
    }
    const r = setGroceryStatus(it.id, 'purchased', { version: it.version });
    if (!r.ok) return toast(r.error, { tone: 'error' });
    haptic('success');
    toast(`${it.name} ✓`, { undo: r.undo });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 18 }}>
        <Row>
          <IconBtn icon="close" label="Exit shopping mode" onPress={nav.pop} bg="rgba(255,255,255,0.14)" color="#fff" />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 16 }}>{t('shoppingMode')}</Text>
          </View>
          <View style={{ width: 44 }} />
        </Row>
        <Row style={{ marginTop: 16, justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: fonts.display, color: '#fff', fontSize: 34 }}><CountUp value={got} style={{ fontFamily: fonts.display, color: '#fff', fontSize: 34 }} /><Text style={{ fontSize: 20, color: 'rgba(255,255,255,0.6)' }}> / {items.length}</Text></Text>
          <Text style={{ fontFamily: fonts.semibold, color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Tap an item to tick it off{'\n'}Long-press for partial</Text>
        </Row>
        <View style={{ marginTop: 10 }}><ProgressBar value={items.length ? got / items.length : 0} color={colors.accent} track="rgba(255,255,255,0.18)" height={8} /></View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 + insets.bottom }}>
        {allDone ? (
          <PopIn style={{ alignItems: 'center', padding: 24, backgroundColor: colors.purchasedSoft, borderRadius: 24, marginBottom: 16 }}>
            <Text style={{ fontSize: 44 }}>🎉</Text>
            <Txt v="h1" style={{ marginTop: 6 }}>All done!</Txt>
            <Txt style={{ textAlign: 'center', marginTop: 4 }}>Everything is bought. The household has been updated.</Txt>
            <Button title="Finish" icon="checkmark" onPress={nav.pop} style={{ marginTop: 14, alignSelf: 'center' }} />
          </PopIn>
        ) : null}
        {groups.map((g, gi) => (
          <FadeIn key={g.key} index={gi} style={{ marginBottom: 16 }}>
            <Row gap={6} style={{ marginBottom: 8, marginLeft: 4 }}><Text style={{ fontSize: 16 }}>{g.icon}</Text><Txt v="label">{t('cat_' + g.key)}</Txt></Row>
            {g.items.map((it) => {
              const done = it.status === 'purchased';
              const rem = it.qty - (it.purchasedQty || 0);
              return (
                <Tap key={it.id} onPress={() => tick(it)} onLongPress={() => setDetail(it.id)} scaleTo={0.98} accessibilityRole="checkbox" accessibilityState={{ checked: done }}
                  accessibilityLabel={`${it.name}, ${rem} ${it.unit}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: done ? colors.surfaceAlt : colors.surface, borderRadius: 20, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: done ? colors.surfaceAlt : it.priority === 'urgent' ? '#F0C2B6' : colors.line }}>
                  <CheckCircle checked={done} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: done ? colors.muted : colors.ink, textDecorationLine: done ? 'line-through' : 'none' }}>{it.name}</Text>
                    {it.remarks && !done ? <Txt v="small" numberOfLines={1}>{it.remarks}</Txt> : null}
                    {it.status === 'partial' ? <Txt v="small" style={{ color: colors.partial }}>{it.purchasedQty} bought earlier</Txt> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontFamily: fonts.display, fontSize: 20, color: done ? colors.muted : colors.ink }}>{done ? it.qty : rem}</Text>
                    <Txt v="caption">{it.unit}</Txt>
                  </View>
                  {it.priority === 'urgent' && !done ? <View style={{ position: 'absolute', top: 10, right: 10 }}><Ionicons name="flash" size={13} color={colors.danger} /></View> : null}
                </Tap>
              );
            })}
          </FadeIn>
        ))}
      </ScrollView>
      <ItemDetailSheet visible={!!detail} itemId={detail} onClose={() => setDetail(null)} onEdit={() => {}} />
    </View>
  );
}
