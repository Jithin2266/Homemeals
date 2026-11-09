import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Platform, StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from './theme';
import { haptic, IconBtn, Txt, Row } from './ui';

// Lightweight tab + stack navigator (no native deps, identical on iOS/Android/web).
const NavCtx = createContext(null);

function TabFade({ children }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start(); }, []);
  return <Animated.View style={{ flex: 1, opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>{children}</Animated.View>;
}
export const useNav = () => useContext(NavCtx);

export function NavProvider({ tabs, screens, tabBarLabels, badgeFor, children }) {
  const [tab, setTabState] = useState('home');
  const [tabParams, setTabParams] = useState({});
  const [stack, setStack] = useState([]);
  const slide = useRef(new Animated.Value(0)).current;

  const push = (name, params = {}) => {
    setStack((s) => [...s, { name, params, key: `${name}-${Date.now()}` }]);
    slide.setValue(0);
    Animated.timing(slide, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
  };
  const pop = () => {
    if (!stack.length) return false;
    Animated.timing(slide, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start(() => {
      setStack((s) => s.slice(0, -1));
      slide.setValue(1);
    });
    return true;
  };
  const setTab = (t, params) => { haptic(); setStack([]); setTabState(t); setTabParams((p) => ({ ...p, [t]: { ...(params || {}), _k: Date.now() } })); };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length) { pop(); return true; }
      if (tab !== 'home') { setTab('home'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [stack, tab]);

  const TabScreen = screens[tab];
  const top = stack[stack.length - 1];
  const under = stack[stack.length - 2];
  const TopScreen = top ? screens[top.name] : null;
  const UnderScreen = under ? screens[under.name] : null;

  return (
    <NavCtx.Provider value={{ tab, setTab, push, pop, params: tabParams[tab] || {} }}>
      <View style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, transform: [{ translateX: TopScreen ? slide.interpolate({ inputRange: [0, 1], outputRange: [0, -80] }) : 0 }] }}>
          {UnderScreen ? <UnderScreen params={under.params} /> : <TabFade key={tab}><TabScreen params={tabParams[tab] || {}} /></TabFade>}
          {!top ? <TabBar tabs={tabs} labels={tabBarLabels} current={tab} onPress={setTab} badgeFor={badgeFor} /> : null}
        </Animated.View>
        {TopScreen ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: slide.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }) }]} /> : null}
        {TopScreen ? (
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }] }]}>
            <TopScreen params={top.params} key={top.key} />
          </Animated.View>
        ) : null}
        {children}
      </View>
    </NavCtx.Provider>
  );
}

function TabBar({ tabs, labels, current, onPress, badgeFor }) {
  const insets = useSafeAreaInsets();
  const [w, setW] = useState(0);
  const idx = Math.max(0, tabs.findIndex((t) => t.key === current));
  const pos = useRef(new Animated.Value(idx)).current;
  useEffect(() => { Animated.spring(pos, { toValue: idx, useNativeDriver: Platform.OS !== 'web', damping: 18, stiffness: 220, mass: 0.8 }).start(); }, [idx]);
  const itemW = w / tabs.length;
  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 10) }]} accessibilityRole="tablist" onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w ? (
        <Animated.View pointerEvents="none" style={[s.indicator, { left: (itemW - 56) / 2, transform: [{ translateX: pos.interpolate({ inputRange: [0, tabs.length - 1], outputRange: [0, itemW * (tabs.length - 1)] }) }] }]} />
      ) : null}
      {tabs.map((t, i) => {
        const on = t.key === current;
        const badge = badgeFor ? badgeFor(t.key) : 0;
        return (
          <Pressable key={t.key} onPress={() => onPress(t.key)} style={s.item} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={labels(t.key)}>
            <TabIcon on={on} icon={on ? t.iconOn : t.icon} badge={badge} />
            <Text style={[s.lbl, on && { color: colors.primary, fontFamily: fonts.bold }]} numberOfLines={1}>{labels(t.key)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TabIcon({ on, icon, badge }) {
  const v = useRef(new Animated.Value(on ? 1 : 0)).current;
  const prevBadge = useRef(badge);
  const bump = useRef(new Animated.Value(1)).current;
  useEffect(() => { Animated.spring(v, { toValue: on ? 1 : 0, useNativeDriver: Platform.OS !== 'web', damping: 10, stiffness: 260 }).start(); }, [on]);
  useEffect(() => {
    if (badge > prevBadge.current) {
      bump.setValue(1.6);
      Animated.spring(bump, { toValue: 1, useNativeDriver: Platform.OS !== 'web', damping: 6, stiffness: 200 }).start();
    }
    prevBadge.current = badge;
  }, [badge]);
  return (
    <View style={s.pill}>
      <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) }] }}>
        <Ionicons name={icon} size={22} color={on ? colors.primary : colors.muted} />
      </Animated.View>
      {badge ? <Animated.View style={[s.dot, { transform: [{ scale: bump }] }]}><Text style={s.dotTxt}>{badge > 9 ? '9+' : badge}</Text></Animated.View> : null}
    </View>
  );
}

export function ScreenHeader({ title, subtitle, back, right, large = true }) {
  const insets = useSafeAreaInsets();
  const nav = useNav();
  return (
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 8, backgroundColor: colors.bg }}>
      <Row style={{ minHeight: 44 }}>
        {back ? <IconBtn icon="chevron-back" onPress={nav.pop} label="Back" style={{ marginLeft: -8, marginRight: 4 }} bg="transparent" /> : null}
        <View style={{ flex: 1 }}>
          {!large ? <Txt v="h2" numberOfLines={1}>{title}</Txt> : null}
        </View>
        <Row gap={6}>{right}</Row>
      </Row>
      {large ? (
        <View style={{ marginTop: 2 }}>
          <Txt v="display" accessibilityRole="header">{title}</Txt>
          {subtitle ? <Txt v="small" style={{ marginTop: 2 }}>{subtitle}</Txt> : null}
        </View>
      ) : subtitle ? <Txt v="small">{subtitle}</Txt> : null}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.97)', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 },
  item: { flex: 1, alignItems: 'center', gap: 3 },
  pill: { width: 56, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  indicator: { position: 'absolute', top: 8, width: 56, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft },
  lbl: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.muted },
  dot: { position: 'absolute', top: -2, right: 8, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: '#fff' },
  dotTxt: { color: '#fff', fontFamily: fonts.bold, fontSize: 9.5 },
});
