import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow, statusMeta, mealMeta } from './theme';
import { PopIn } from './motion';

export const haptic = (kind = 'light') => {
  if (Platform.OS === 'web') return;
  try {
    if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (kind === 'warn') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (e) {}
};

// ---------- Typography ----------
const variants = {
  display: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, color: colors.ink, letterSpacing: -0.4 },
  h1: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink, letterSpacing: -0.2 },
  h2: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, color: colors.ink },
  title: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
  small: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.muted },
  label: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, color: colors.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
};
export const Txt = ({ v = 'body', style, children, ...p }) => (
  <Text style={[variants[v], style]} {...p}>{children}</Text>
);

// ---------- Tap with spring feedback ----------
const OUTER_KEYS = ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'position', 'top', 'left', 'right', 'bottom', 'zIndex'];
export function Tap({ onPress, style, children, disabled, scaleTo = 0.97, hapticKind, accessibilityLabel, accessibilityRole = 'button', hitSlop, onLongPress }) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v) => Animated.spring(s, { toValue: v, useNativeDriver: Platform.OS !== 'web', speed: 40, bounciness: 6 }).start();
  const flat = StyleSheet.flatten(style) || {};
  const outer = {}; const inner = {};
  Object.keys(flat).forEach((k) => {
    if (OUTER_KEYS.includes(k) || k.startsWith('margin')) outer[k] = flat[k]; else inner[k] = flat[k];
  });
  if (outer.flex != null || outer.height != null) inner.flexGrow = 1;
  return (
    <Pressable
      style={outer}
      onPress={(e) => { if (hapticKind) haptic(hapticKind); onPress && onPress(e); }}
      onLongPress={onLongPress}
      onPressIn={() => to(scaleTo)}
      onPressOut={() => to(1)}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Animated.View style={[inner, { transform: [{ scale: s }] }, disabled && { opacity: 0.45 }]}>{children}</Animated.View>
    </Pressable>
  );
}

// ---------- Buttons ----------
export function Button({ title, onPress, kind = 'primary', icon, full, disabled, small, style, iconRight }) {
  const k = {
    primary: { bg: colors.primary, fg: colors.primaryInk, bd: colors.primary },
    accent: { bg: colors.accent, fg: '#2B1B00', bd: colors.accent },
    secondary: { bg: colors.surface, fg: colors.ink, bd: colors.lineStrong },
    soft: { bg: colors.primarySoft, fg: colors.primary, bd: colors.primarySoft },
    ghost: { bg: 'transparent', fg: colors.primary, bd: 'transparent' },
    danger: { bg: colors.dangerSoft, fg: colors.danger, bd: colors.dangerSoft },
  }[kind];
  return (
    <Tap onPress={onPress} disabled={disabled} hapticKind="light" accessibilityLabel={title}
      style={[{
        backgroundColor: k.bg, borderColor: k.bd, borderWidth: 1, borderRadius: radius.pill,
        paddingVertical: small ? 9 : 14, paddingHorizontal: small ? 14 : 20, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'center', gap: 8, alignSelf: full ? 'stretch' : 'flex-start', minHeight: small ? 38 : 50,
      }, style]}>
      {icon ? <Ionicons name={icon} size={small ? 16 : 19} color={k.fg} /> : null}
      <Text style={{ fontFamily: fonts.bold, fontSize: small ? 13.5 : 15, color: k.fg }}>{title}</Text>
      {iconRight ? <Ionicons name={iconRight} size={small ? 16 : 18} color={k.fg} /> : null}
    </Tap>
  );
}

export function IconBtn({ icon, onPress, label, color = colors.ink, bg = colors.surface, size = 22, badge, style }) {
  return (
    <Tap onPress={onPress} accessibilityLabel={label} hapticKind="light" hitSlop={6}
      style={[{ width: 44, height: 44, borderRadius: 22, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Ionicons name={icon} size={size} color={color} />
      {badge ? (
        <View style={st.badge}><Text style={st.badgeTxt}>{badge > 9 ? '9+' : badge}</Text></View>
      ) : null}
    </Tap>
  );
}

// ---------- Surfaces ----------
export const Card = ({ style, children, onPress, pad = 16 }) => {
  const inner = [{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: pad, borderWidth: 1, borderColor: colors.line }, shadow.card, style];
  if (onPress) return <Tap onPress={onPress} style={inner} scaleTo={0.985}>{children}</Tap>;
  return <View style={inner}>{children}</View>;
};

export const Row = ({ style, children, gap = 8, center = true }) => (
  <View style={[{ flexDirection: 'row', alignItems: center ? 'center' : 'flex-start', gap }, style]}>{children}</View>
);

export const Divider = ({ style }) => <View style={[{ height: 1, backgroundColor: colors.line }, style]} />;

export function Chip({ label, selected, onPress, icon, count, color = colors.primary, style }) {
  return (
    <Tap onPress={onPress} hapticKind="light" accessibilityLabel={label} accessibilityRole="tab"
      style={[{
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
        backgroundColor: selected ? color : colors.surface, borderWidth: 1, borderColor: selected ? color : colors.line,
      }, style]}>
      {icon ? (!/^[a-z-]+$/.test(icon) ? <Text style={{ fontSize: 14 }}>{icon}</Text> : <Ionicons name={icon} size={15} color={selected ? '#fff' : colors.inkSoft} />) : null}
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: selected ? '#fff' : colors.ink }}>{label}</Text>
      {count != null ? (
        <View style={{ backgroundColor: selected ? 'rgba(255,255,255,0.25)' : colors.surfaceAlt, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: selected ? '#fff' : colors.inkSoft }}>{count}</Text>
        </View>
      ) : null}
    </Tap>
  );
}

export function StatusPill({ status, t, small }) {
  const m = statusMeta[status];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: m.soft, borderRadius: radius.pill, paddingHorizontal: small ? 7 : 9, paddingVertical: small ? 2 : 4, alignSelf: 'flex-start' }}
      accessibilityLabel={`Status: ${t(status)}`}>
      <Ionicons name={m.icon} size={small ? 11 : 13} color={m.color} />
      <Text style={{ fontFamily: fonts.bold, fontSize: small ? 11 : 12, color: m.color }}>{t(status)}</Text>
    </View>
  );
}

export function SchedulePill({ status, t, edited }) {
  const map = {
    draft: { c: colors.accent, bg: colors.accentSoft, i: 'create-outline', fg: '#8A5A08' },
    published: { c: colors.purchased, bg: colors.purchasedSoft, i: 'checkmark-done', fg: colors.purchased },
    archived: { c: colors.cancelled, bg: colors.cancelledSoft, i: 'archive-outline', fg: colors.cancelled },
  }[status];
  if (!map) return null;
  return (
    <Row gap={6}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: map.bg, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4 }}>
        <Ionicons name={map.i} size={13} color={map.fg} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: map.fg }}>{t(status)}</Text>
      </View>
      {edited && status === 'published' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.infoSoft, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4 }}>
          <Ionicons name="refresh" size={12} color={colors.info} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.info }}>{t('updated')}</Text>
        </View>
      ) : null}
    </Row>
  );
}

export function MealIcon({ meal, size = 36 }) {
  const m = mealMeta[meal];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2.6, backgroundColor: m.soft, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={m.icon} size={size * 0.52} color={m.color} />
    </View>
  );
}

export function Avatar({ user, size = 36 }) {
  const initials = (user?.name || '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: user?.color || colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}

export function ProgressBar({ value, color = colors.primary, track = colors.surfaceAlt, height = 8 }) {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: Math.max(0, Math.min(1, value || 0)), duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value]);
  return (
    <View style={{ height, backgroundColor: track, borderRadius: height, overflow: 'hidden' }}
      accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round((value || 0) * 100) }}>
      <Animated.View style={{ height, backgroundColor: color, borderRadius: height, width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
    </View>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, padding: 4 }} accessibilityRole="tablist">
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => { haptic(); onChange(o.value); }} accessibilityRole="tab" accessibilityState={{ selected: sel }}
            style={{ flex: 1, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: sel ? colors.surface : 'transparent', alignItems: 'center', ...(sel ? shadow.card : {}) }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: sel ? colors.ink : colors.muted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function EmptyState({ emoji, title, body, action, onAction, icon }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 }}>
      <PopIn style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Text style={{ fontSize: 38 }}>{emoji}</Text>
      </PopIn>
      <Txt v="h2" style={{ textAlign: 'center' }}>{title}</Txt>
      {body ? <Txt style={{ textAlign: 'center', marginTop: 6 }}>{body}</Txt> : null}
      {action ? <Button title={action} icon={icon || 'add'} onPress={onAction} style={{ marginTop: 18, alignSelf: 'center' }} /> : null}
    </View>
  );
}

// ---------- Form ----------
export function Field({ label, value, onChangeText, placeholder, error, multiline, keyboardType, secureTextEntry, autoFocus, right, style, hint, autoCapitalize, onSubmitEditing, returnKeyType }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label ? <Txt v="small" style={{ fontFamily: fonts.semibold, color: colors.ink, marginBottom: 6 }}>{label}</Txt> : null}
      <View style={{
        flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', backgroundColor: colors.surface, borderRadius: radius.md,
        borderWidth: focus ? 2 : 1, borderColor: error ? colors.danger : focus ? colors.primary : colors.lineStrong, paddingHorizontal: focus ? 13 : 14,
      }}>
        <TextInput
          value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.muted}
          multiline={multiline} keyboardType={keyboardType} secureTextEntry={secureTextEntry} autoFocus={autoFocus}
          autoCapitalize={autoCapitalize} onSubmitEditing={onSubmitEditing} returnKeyType={returnKeyType}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} accessibilityLabel={label || placeholder}
          style={[{ flex: 1, fontFamily: fonts.medium, fontSize: 15.5, color: colors.ink, paddingVertical: focus ? 12 : 13, minHeight: multiline ? 76 : 48, textAlignVertical: multiline ? 'top' : 'center' }, Platform.OS === 'web' ? { outlineStyle: 'none' } : null]}
        />
        {right}
      </View>
      {error ? (
        <Row gap={4} style={{ marginTop: 6 }}><Ionicons name="alert-circle" size={14} color={colors.danger} /><Txt v="small" style={{ color: colors.danger }}>{error}</Txt></Row>
      ) : hint ? <Txt v="caption" style={{ marginTop: 6 }}>{hint}</Txt> : null}
    </View>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0 }) {
  const n = Number(value) || 0;
  const set = (v) => { haptic(); onChange(String(Math.max(min, Math.round(v * 100) / 100))); };
  return (
    <Row gap={0} style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.md, overflow: 'hidden', height: 50 }}>
      <Pressable onPress={() => set(n - step)} style={st.stepBtn} accessibilityLabel="Decrease quantity"><Ionicons name="remove" size={20} color={colors.ink} /></Pressable>
      <TextInput value={String(value)} onChangeText={onChange} keyboardType="decimal-pad" accessibilityLabel="Quantity"
        style={[{ flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 17, color: colors.ink, minWidth: 40 }, Platform.OS === 'web' ? { outlineStyle: 'none' } : null]} />
      <Pressable onPress={() => set(n + step)} style={st.stepBtn} accessibilityLabel="Increase quantity"><Ionicons name="add" size={20} color={colors.ink} /></Pressable>
    </Row>
  );
}

// ---------- Portal (web: keep sheets inside the phone frame) ----------
const PortalCtx = createContext(null);
export function PortalProvider({ children }) {
  const [items, setItems] = useState({});
  const api = useRef({
    mount: (k, el) => setItems((p) => ({ ...p, [k]: el })),
    unmount: (k) => setItems((p) => { const n = { ...p }; delete n[k]; return n; }),
  }).current;
  return (
    <PortalCtx.Provider value={api}>
      {children}
      {Object.entries(items).map(([k, el]) => <React.Fragment key={k}>{el}</React.Fragment>)}
    </PortalCtx.Provider>
  );
}
function Portal({ children }) {
  const api = useContext(PortalCtx);
  const key = useRef('p' + Math.random().toString(36).slice(2)).current;
  useEffect(() => { api.mount(key, children); });
  useEffect(() => () => api.unmount(key), []);
  return null;
}
const Layer = ({ children, onClose, direct }) => (Platform.OS === 'web'
  ? direct ? <View style={[StyleSheet.absoluteFill, { zIndex: 60 }]}>{children}</View> : <Portal><View style={[StyleSheet.absoluteFill, { zIndex: 50 }]}>{children}</View></Portal>
  : <Modal transparent visible onRequestClose={onClose} animationType="none" statusBarTranslucent>{children}</Modal>);

// ---------- Bottom sheet ----------
export function Sheet({ visible, onClose, title, subtitle, children, footer, scroll = true, maxHeight = '88%' }) {
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(600)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(y, { toValue: 0, useNativeDriver: Platform.OS !== 'web', damping: 22, stiffness: 220, mass: 0.9 }),
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(y, { toValue: 700, duration: 220, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);
  if (!mounted) return null;
  const Body = scroll ? ScrollView : View;
  return (
    <Layer onClose={onClose}>
      <View style={st.sheetRoot}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,28,24,0.45)', opacity: fade }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" />
        </Animated.View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.sheetKav} pointerEvents="box-none">
          <Animated.View style={[st.sheet, { maxHeight, paddingBottom: Math.max(insets.bottom, 12), transform: [{ translateY: y }] }]}>
            <View style={st.handle} />
            {title ? (
              <Row style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Txt v="h1" style={{ fontSize: 22 }}>{title}</Txt>
                  {subtitle ? <Txt v="small" style={{ marginTop: 2 }}>{subtitle}</Txt> : null}
                </View>
                <IconBtn icon="close" onPress={onClose} label="Close" bg={colors.surfaceAlt} size={20} />
              </Row>
            ) : null}
            <Body style={scroll ? { flexGrow: 0 } : null} contentContainerStyle={scroll ? { paddingHorizontal: 20, paddingBottom: 12 } : null} keyboardShouldPersistTaps="handled">
              {children}
            </Body>
            {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line }}>{footer}</View> : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Layer>
  );
}

// ---------- Toast (snackbar with Undo) + Confirm dialog ----------
const FeedbackCtx = createContext(null);
export const useFeedback = () => useContext(FeedbackCtx);

export function FeedbackProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);
  const insets = useSafeAreaInsets();

  const hide = useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start(() => setToast(null));
  }, []);

  const show = useCallback((msg, opts = {}) => {
    clearTimeout(timer.current);
    setToast({ msg, ...opts, key: Date.now() });
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, useNativeDriver: Platform.OS !== 'web', damping: 18, stiffness: 200 }).start();
    timer.current = setTimeout(hide, opts.undo ? 5000 : 2800);
  }, []);

  const ask = useCallback((cfg) => new Promise((resolve) => setConfirm({ ...cfg, resolve })), []);
  const close = (v) => { confirm?.resolve(v); setConfirm(null); };

  const tone = toast?.tone === 'error' ? colors.danger : colors.ink;

  return (
    <FeedbackCtx.Provider value={{ toast: show, confirm: ask }}>
      <PortalProvider>{children}</PortalProvider>
      {toast ? (
        <Animated.View pointerEvents="box-none" style={[st.toastWrap, { bottom: 92 + insets.bottom, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>
          <View style={[st.toast, { backgroundColor: tone }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
            <Ionicons name={toast.tone === 'error' ? 'alert-circle' : toast.icon || 'checkmark-circle'} size={20} color={toast.tone === 'error' ? '#fff' : '#8FD3B0'} />
            <Text style={{ flex: 1, color: '#fff', fontFamily: fonts.semibold, fontSize: 14 }}>{toast.msg}</Text>
            {toast.undo ? (
              <Pressable onPress={() => { toast.undo(); hide(); haptic(); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Undo">
                <Text style={{ color: colors.accent, fontFamily: fonts.extrabold, fontSize: 14 }}>UNDO</Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
      {confirm ? (
      <Layer direct onClose={() => close(false)}>
        <View style={st.dialogRoot}>
          <View style={st.dialog} accessibilityRole="alert">
            {confirm?.icon ? (
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: confirm.danger ? colors.dangerSoft : colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <Ionicons name={confirm.icon} size={26} color={confirm.danger ? colors.danger : colors.primary} />
              </View>
            ) : null}
            <Txt v="h2">{confirm?.title}</Txt>
            {confirm?.body ? <Txt style={{ marginTop: 6 }}>{confirm.body}</Txt> : null}
            <Row gap={10} style={{ marginTop: 22, justifyContent: 'flex-end' }}>
              <Button title={confirm?.cancel || 'Cancel'} kind="secondary" small onPress={() => close(false)} />
              <Button title={confirm?.ok || 'Confirm'} kind={confirm?.danger ? 'danger' : 'primary'} small onPress={() => close(true)} />
            </Row>
          </View>
        </View>
      </Layer>
      ) : null}
    </FeedbackCtx.Provider>
  );
}

const st = StyleSheet.create({
  badge: { position: 'absolute', top: 6, right: 6, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.bg },
  badgeTxt: { color: '#fff', fontFamily: fonts.bold, fontSize: 9.5 },
  stepBtn: { width: 48, height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  sheetRoot: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheetKav: { width: '100%', maxWidth: 520, justifyContent: 'flex-end', flex: 1 },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, width: '100%', ...shadow.float },
  handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, alignSelf: 'center', marginTop: 10, marginBottom: 10 },
  toastWrap: { position: 'absolute', left: 0, right: 0, zIndex: 70, alignItems: 'center', paddingHorizontal: 16 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, width: '100%', maxWidth: 460, ...shadow.float },
  dialogRoot: { flex: 1, backgroundColor: 'rgba(20,28,24,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: colors.surface, borderRadius: 24, padding: 22, width: '100%', maxWidth: 380 },
});
