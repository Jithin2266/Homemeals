// Motion toolkit: entrances, count-ups, check pops, celebration bursts.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, AccessibilityInfo } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from './theme';

export const ND = Platform.OS !== 'web'; // native driver where supported

// Respect "reduce motion"
let reduceMotion = false;
try { AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { reduceMotion = !!v; }); } catch (e) {}

/** Fade + rise on mount. `index` staggers siblings. */
export function FadeIn({ children, index = 0, delay = 0, from = 14, dx = 0, style, duration = 420 }) {
  const v = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(v, { toValue: 1, duration, delay: delay + Math.min(index, 10) * 55, easing: Easing.out(Easing.cubic), useNativeDriver: ND }).start();
  }, []);
  return (
    <Animated.View style={[style, {
      opacity: v,
      transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }, { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [dx, 0] }) }],
    }]}>
      {children}
    </Animated.View>
  );
}

/** Pops in with a spring (badges, check marks, empty-state art). */
export function PopIn({ children, delay = 0, style }) {
  const v = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.spring(v, { toValue: 1, delay, useNativeDriver: ND, damping: 9, stiffness: 160, mass: 0.7 }).start();
  }, []);
  return <Animated.View style={[style, { opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }), transform: [{ scale: v }] }]}>{children}</Animated.View>;
}

/** Number that counts up/down to its value. */
export function CountUp({ value, style, duration = 650, format = (n) => String(Math.round(n)) }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current; const end = value;
    if (start === end || reduceMotion) { setShown(end); from.current = end; return undefined; }
    const v = new Animated.Value(0);
    const id = v.addListener(({ value: p }) => setShown(start + (end - start) * p));
    Animated.timing(v, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => { from.current = end; });
    return () => v.removeListener(id);
  }, [value]);
  return <Text style={style}>{format(shown)}</Text>;
}

/** Gentle repeated wiggle when `trigger` increases (e.g. unread count). */
export function Wiggle({ trigger, children }) {
  const v = useRef(new Animated.Value(0)).current;
  const prev = useRef(trigger);
  useEffect(() => {
    if (trigger > prev.current && !reduceMotion) {
      v.setValue(0);
      Animated.sequence([0.6, -0.6, 0.4, -0.3, 0].map((x) => Animated.timing(v, { toValue: x, duration: 90, useNativeDriver: ND }))).start();
    }
    prev.current = trigger;
  }, [trigger]);
  return <Animated.View style={{ transform: [{ rotate: v.interpolate({ inputRange: [-1, 1], outputRange: ['-25deg', '25deg'] }) }] }}>{children}</Animated.View>;
}

/** Breathing pulse for "live"/"next" indicators. */
export function Pulse({ children, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: ND }),
      Animated.timing(v, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: ND }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[style, { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }]}>{children}</Animated.View>;
}

/** Round check that fills with a springy pop. */
export function CheckCircle({ checked, partial, cancelled, size = 34 }) {
  const v = useRef(new Animated.Value(checked ? 1 : 0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (checked && !reduceMotion) {
      v.setValue(0); ring.setValue(0);
      Animated.parallel([
        Animated.spring(v, { toValue: 1, useNativeDriver: ND, damping: 8, stiffness: 220, mass: 0.6 }),
        Animated.timing(ring, { toValue: 1, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: ND }),
      ]).start();
    } else v.setValue(checked ? 1 : 0);
  }, [checked]);
  const bd = partial ? colors.partial : colors.lineStrong;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: colors.purchased,
        opacity: ring.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.7, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }] }} />
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: bd, backgroundColor: cancelled ? colors.cancelledSoft : partial ? colors.partialSoft : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {cancelled ? <Ionicons name="close" size={size * 0.53} color={colors.cancelled} /> : partial ? <Ionicons name="contrast" size={size * 0.47} color={colors.partial} /> : null}
      </View>
      <Animated.View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: colors.purchased, alignItems: 'center', justifyContent: 'center', opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] }), transform: [{ scale: v }] }}>
        <Ionicons name="checkmark" size={size * 0.6} color="#fff" />
      </Animated.View>
    </View>
  );
}

/** Collapses a row (fade + slide + height) before calling onDone. */
export function useExit() {
  const v = useRef(new Animated.Value(1)).current;
  const run = useCallback((onDone, delay = 380) => {
    if (reduceMotion) { onDone(); return; }
    Animated.timing(v, { toValue: 0, duration: 300, delay, easing: Easing.in(Easing.cubic), useNativeDriver: ND }).start(() => { onDone(); v.setValue(1); });
  }, []);
  const style = { opacity: v, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] };
  return [style, run];
}

// ---------- Celebration burst ----------
const BurstCtx = createContext(() => {});
export const useCelebrate = () => useContext(BurstCtx);
const PIECES = ['🎉', '✨', '🥥', '🍌', '🌶️', '🍛', '💚', '⭐'];

export function BurstProvider({ children }) {
  const [burst, setBurst] = useState(null);
  const celebrate = useCallback((emojis) => { if (!reduceMotion) setBurst({ key: Date.now(), emojis: emojis || PIECES }); }, []);
  return (
    <BurstCtx.Provider value={celebrate}>
      {children}
      {burst ? <Burst key={burst.key} emojis={burst.emojis} onDone={() => setBurst(null)} /> : null}
    </BurstCtx.Provider>
  );
}

function Burst({ emojis, onDone }) {
  const parts = useRef(Array.from({ length: 22 }, (_, i) => ({
    e: emojis[i % emojis.length], v: new Animated.Value(0),
    x: (Math.random() - 0.5) * 340, y: -(160 + Math.random() * 260), r: (Math.random() - 0.5) * 540, s: 0.8 + Math.random() * 0.8, d: Math.random() * 120,
  }))).current;
  useEffect(() => {
    Animated.parallel(parts.map((p) => Animated.timing(p.v, { toValue: 1, duration: 1300, delay: p.d, easing: Easing.out(Easing.quad), useNativeDriver: ND }))).start(onDone);
  }, []);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'flex-end', zIndex: 90 }]}>
      {parts.map((p, i) => (
        <Animated.Text key={i} style={{
          position: 'absolute', bottom: 140, fontSize: 24 * p.s,
          opacity: p.v.interpolate({ inputRange: [0, 0.1, 0.75, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateX: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, p.x] }) },
            { translateY: p.v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, p.y, p.y + 120] }) },
            { rotate: p.v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.r}deg`] }) },
          ],
        }}>{p.e}</Animated.Text>
      ))}
    </View>
  );
}

// ---------- Splash ----------
export function Splash({ onDone }) {
  const logo = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;
  const out = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.spring(logo, { toValue: 1, useNativeDriver: ND, damping: 10, stiffness: 140 }),
      Animated.timing(text, { toValue: 1, duration: 320, useNativeDriver: ND }),
      Animated.delay(380),
      Animated.timing(out, { toValue: 0, duration: 300, useNativeDriver: ND }),
    ]).start(onDone);
  }, []);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', zIndex: 100, opacity: out }]}>
      <Animated.View style={{ width: 86, height: 86, borderRadius: 28, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', transform: [{ scale: logo }, { rotate: logo.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '0deg'] }) }] }}>
        <Ionicons name="leaf" size={46} color={colors.primaryDark} />
      </Animated.View>
      <Animated.Text style={{ fontFamily: fonts.displayBold, fontSize: 34, color: '#fff', marginTop: 18, opacity: text, transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>HomeMeal</Animated.Text>
      <Animated.Text style={{ fontFamily: fonts.medium, fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 6, opacity: text }}>Plan the week. Shop together.</Animated.Text>
    </Animated.View>
  );
}
