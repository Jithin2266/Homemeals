import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { Avatar, Button, Chip, Field, IconBtn, Row, Tap, Txt, haptic, useFeedback } from '../ui';
import { colors, fonts, radius, shadow } from '../theme';
import { FadeIn, useCelebrate } from '../motion';
import { DEMO } from '../config';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DEMO_OTP = '1234';

const strength = (pw) => {
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(3, s);
};

export default function RegisterScreen({ onBack, initialRole }) {
  const { t, findInvite, lookupCode, registerCreator, registerViewer, accountTaken, online } = useStore();
  const [remoteInvite, setRemoteInvite] = useState(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast } = useFeedback();
  const insets = useSafeAreaInsets();
  const scroll = useRef(null);
  const celebrate = useCelebrate();
  const [step, setStep] = useState(initialRole ? 'details' : 'role');
  const [role, setRole] = useState(initialRole || null);
  const [f, setF] = useState({ name: '', phone: '', email: '', password: '', confirm: '', householdName: '', code: '', relation: 'Family', agree: false });
  const [errs, setErrs] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpErr, setOtpErr] = useState('');
  const [timer, setTimer] = useState(30);
  const [householdTouched, setHouseholdTouched] = useState(false);

  const invite = role === 'viewer' ? (online ? remoteInvite : findInvite(f.code)) : null;
  // Live app: check the code online as soon as all 6 characters are typed
  useEffect(() => {
    if (!online || role !== 'viewer') return undefined;
    const c = (f.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    setRemoteInvite(null);
    if (c.length !== 6) { setChecking(false); return undefined; }
    let alive = true;
    setChecking(true);
    lookupCode(c).then((r) => {
      if (!alive) return;
      setChecking(false);
      if (r && r.error) setErrs((e) => ({ ...e, code: r.error }));
      else { setRemoteInvite(r); if (!r) setErrs((e) => ({ ...e, code: 'That code is not valid. Check it with the household Creator.' })); }
    });
    return () => { alive = false; };
  }, [f.code, role, online]);
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErrs((e) => ({ ...e, [k]: null, form: null })); };

  // Prefill from a valid invite
  useEffect(() => {
    if (invite?.user) setF((p) => ({ ...p, name: p.name || invite.user.name, phone: p.phone || invite.user.phone }));
  }, [invite?.user?.id]);
  // Suggest a household name from the surname
  useEffect(() => {
    if (role === 'creator' && !householdTouched) {
      const parts = f.name.trim().split(/\s+/);
      setF((p) => ({ ...p, householdName: parts.length > 1 ? `${parts[parts.length - 1]} Family` : parts[0] ? `${parts[0]}'s Home` : '' }));
    }
  }, [f.name, role]);
  useEffect(() => {
    if (step !== 'verify' || timer <= 0) return undefined;
    const id = setTimeout(() => setTimer((x) => x - 1), 1000);
    return () => clearTimeout(id);
  }, [step, timer]);

  const validate = () => {
    const e = {};
    if (role === 'viewer') {
      if (!f.code.trim()) e.code = 'Enter the code from your family';
      else if (checking) e.code = 'Checking the code, one moment…';
      else if (!invite) e.code = 'That code is not valid. Check it with the household Creator.';
    }
    if (f.name.trim().length < 2) e.name = 'Enter your full name';
    if (!/^\d{10}$/.test(f.phone)) e.phone = 'Enter a 10-digit mobile number';
    if (f.email && !EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email or leave it empty';
    if (f.password.length < 6) e.password = 'Use at least 6 characters';
    else if (!(/[A-Za-z]/.test(f.password) && /\d/.test(f.password))) e.password = 'Use both letters and numbers';
    if (f.confirm !== f.password) e.confirm = "Passwords don't match";
    if (role === 'creator' && !f.householdName.trim()) e.householdName = 'Name your household';
    if (!f.agree) e.agree = 'Please accept to continue';
    if (!online && !e.phone && !e.email) {
      const taken = accountTaken({ phone: f.phone, email: f.email }, invite?.user?.id);
      if (taken) e.form = taken;
    }
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validate()) { haptic('warn'); scroll.current?.scrollTo({ y: 0, animated: true }); return; }
    haptic('success');
    if (!DEMO) { finish((msg) => setErrs((e) => ({ ...e, form: msg }))); return; }
    setOtp(''); setOtpErr(''); setTimer(30);
    setStep('verify');
  };

  // Live app: no SMS service yet, so the account is created right after the details step.
  const finish = async (onError) => {
    if (busy) return;
    setBusy(true);
    const r = await (role === 'creator' ? registerCreator(f) : registerViewer(f));
    setBusy(false);
    if (!r.ok) { onError(r.error); haptic('warn'); scroll.current?.scrollTo({ y: 0, animated: true }); return; }
    haptic('success');
    celebrate();
    toast(role === 'creator' ? `Welcome! ${f.householdName.trim()} is ready` : `Welcome to ${invite?.household?.name || 'your household'}!`, { icon: 'sparkles' });
  };

  const verify = () => {
    if (otp !== DEMO_OTP) { setOtpErr(`Incorrect code. For this demo, use ${DEMO_OTP}.`); haptic('warn'); return; }
    finish(setOtpErr);
  };

  const back = () => {
    if (step === 'verify') setStep('details');
    else if (step === 'details' && !initialRole) setStep('role');
    else onBack();
  };

  const stepIdx = { role: 0, details: 1, verify: 2 }[step];
  const pw = strength(f.password);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8 }}>
        <Row>
          <IconBtn icon="chevron-back" label="Back" onPress={back} bg="transparent" />
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            {(DEMO ? ['Role', 'Details', 'Verify'] : ['Role', 'Details']).map((s, i) => (
              <View key={s} style={{ alignItems: 'center', gap: 4 }}>
                <View style={{ width: i === stepIdx ? 34 : 22, height: 6, borderRadius: 3, backgroundColor: i <= stepIdx ? colors.primary : colors.line }} />
              </View>
            ))}
          </View>
          <View style={{ width: 44 }} />
        </Row>
      </View>

      <ScrollView ref={scroll} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 + insets.bottom }} keyboardShouldPersistTaps="handled">
        {step === 'role' ? (
          <FadeIn key="role" dx={-20} from={0}>
            <Txt v="display" style={{ marginTop: 8 }}>Create your account</Txt>
            <Txt style={{ marginTop: 6, marginBottom: 22 }}>How will you use HomeMeal? Each household has one Creator who plans, and family members who view and shop.</Txt>
            <RoleCard
              selected={role === 'creator'} onPress={() => setRole('creator')}
              emoji="👩‍🍳" tint={colors.primary} soft={colors.primarySoft}
              title="I plan the family meals" badge="Creator"
              points={['Create your household', 'Plan breakfast, lunch & dinner', 'Manage the grocery list', 'Invite family members']} />
            <RoleCard
              selected={role === 'viewer'} onPress={() => setRole('viewer')}
              emoji="🛒" tint="#A86A07" soft={colors.accentSoft}
              title="I'm joining my family" badge="Viewer"
              points={['Needs the household code from your Creator', 'See the published weekly menu', 'Tick off groceries while shopping']} />
            <Button title="Continue" iconRight="arrow-forward" full disabled={!role} onPress={() => { haptic(); setStep('details'); }} style={{ marginTop: 10 }} />
          </FadeIn>
        ) : null}

        {step === 'details' ? (
          <FadeIn key="details" dx={30} from={0}>
            <Row gap={8} style={{ marginTop: 8 }}>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: role === 'creator' ? colors.primarySoft : colors.accentSoft }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: role === 'creator' ? colors.primary : '#8A5A08' }}>{role === 'creator' ? 'Creator' : 'Viewer'}</Text>
              </View>
              {!initialRole ? <Text onPress={() => setStep('role')} style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>Change</Text> : null}
            </Row>
            <Txt v="display" style={{ marginTop: 8 }}>{role === 'creator' ? 'Set up your household' : 'Join your household'}</Txt>
            <Txt style={{ marginTop: 6, marginBottom: 20 }}>{role === 'creator' ? "You'll be the household's Creator. You can invite family after signing up." : 'Enter the household code (or personal invite code) your family shared with you.'}</Txt>

            {errs.form ? (
              <View style={{ flexDirection: 'row', gap: 8, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 14, marginBottom: 14 }} accessibilityRole="alert">
                <Ionicons name="alert-circle" size={18} color={colors.danger} />
                <Txt v="small" style={{ color: colors.danger, flex: 1 }}>{errs.form}</Txt>
              </View>
            ) : null}

            {role === 'viewer' ? (
              <View style={{ marginBottom: 6 }}>
                <Field label="Invite code" value={f.code} onChangeText={(v) => set('code', v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))} placeholder="e.g. AMMA42" autoCapitalize="characters" error={errs.code}
                  hint={checking ? 'Checking the code…' : DEMO ? 'Demo codes: MENU24 (household code) · AMMA42 (personal invite)' : 'Ask your household Creator: it is shown in Household members.'} />
                {invite ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.purchasedSoft, borderRadius: 16, padding: 14, marginTop: -4, marginBottom: 16 }}>
                    <Avatar user={invite.creator} size={40} />
                    <View style={{ flex: 1 }}>
                      <Txt v="title" style={{ fontSize: 15 }}>🏠 {invite.household?.name}</Txt>
                      <Txt v="caption" style={{ color: colors.primaryDark }}>{invite.user ? `Invited by ${invite.creator?.name} as ${invite.user.relation}` : `Household code from ${invite.creator?.name || 'the Creator'}`}</Txt>
                    </View>
                    <Ionicons name="checkmark-circle" size={22} color={colors.purchased} />
                  </View>
                ) : null}
                {invite?.kind === 'household' ? (
                  <View style={{ marginBottom: 16 }}>
                    <Txt v="small" style={{ fontFamily: fonts.semibold, color: colors.ink, marginBottom: 8 }}>You are their…</Txt>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {['Husband', 'Wife', 'Son', 'Daughter', 'Parent', 'Grandparent', 'Helper', 'Other'].map((r) => (
                        <Chip key={r} label={r} selected={f.relation === r} onPress={() => set('relation', r)} />
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            <Field label="Full name" value={f.name} onChangeText={(v) => set('name', v)} placeholder="e.g. Lakshmi Nair" error={errs.name} autoCapitalize="words" />
            <Field label="Mobile number" value={f.phone} onChangeText={(v) => set('phone', v.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile" keyboardType="phone-pad" error={errs.phone}
              right={<Text style={{ fontFamily: fonts.semibold, color: colors.muted }}>🇮🇳</Text>} hint={DEMO ? "We'll send a one-time code to verify it." : 'You will use it to sign in.'} />
            <Field label="Email (optional)" value={f.email} onChangeText={(v) => set('email', v)} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" error={errs.email} hint="Use it to sign in or recover your password." />
            <Field label="Password" value={f.password} onChangeText={(v) => set('password', v)} placeholder="At least 6 characters" secureTextEntry={!showPw} error={errs.password}
              right={<Pressable onPress={() => setShowPw(!showPw)} hitSlop={10} accessibilityLabel={showPw ? 'Hide password' : 'Show password'}><Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} /></Pressable>} />
            {f.password && !errs.password ? (
              <Row gap={6} style={{ marginTop: -6, marginBottom: 14 }}>
                {[1, 2, 3].map((i) => <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: pw >= i ? [colors.danger, colors.accent, colors.purchased][pw - 1] : colors.line }} />)}
                <Txt v="caption" style={{ width: 54, textAlign: 'right' }}>{['Weak', 'Weak', 'Good', 'Strong'][pw]}</Txt>
              </Row>
            ) : null}
            <Field label="Confirm password" value={f.confirm} onChangeText={(v) => set('confirm', v)} placeholder="Re-enter password" secureTextEntry={!showPw} error={errs.confirm} />

            {role === 'creator' ? (
              <Field label="Household name" value={f.householdName} onChangeText={(v) => { setHouseholdTouched(true); set('householdName', v); }} placeholder="e.g. Nair Family" error={errs.householdName}
                right={<Text style={{ fontSize: 18 }}>🏠</Text>} hint="Family members will see this name when they join." />
            ) : null}

            <Pressable onPress={() => set('agree', !f.agree)} accessibilityRole="checkbox" accessibilityState={{ checked: f.agree }} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 4, marginBottom: 18 }}>
              <Ionicons name={f.agree ? 'checkbox' : 'square-outline'} size={22} color={errs.agree ? colors.danger : f.agree ? colors.primary : colors.muted} />
              <Txt v="small" style={{ flex: 1, color: errs.agree ? colors.danger : colors.inkSoft }}>I agree to the Terms of Use and Privacy Policy. My household's data is only visible to its members.</Txt>
            </Pressable>

            <Button disabled={busy} title={busy ? 'Please wait…' : DEMO ? 'Continue' : role === 'creator' ? 'Create household' : 'Join household'} icon={DEMO ? undefined : 'checkmark'} iconRight={DEMO ? 'arrow-forward' : undefined} full onPress={next} />
            <Row gap={4} style={{ justifyContent: 'center', marginTop: 18 }}>
              <Txt v="small">Already have an account?</Txt>
              <Text onPress={onBack} style={{ fontFamily: fonts.bold, color: colors.primary, fontSize: 13.5 }}>{t('signIn')}</Text>
            </Row>
          </FadeIn>
        ) : null}

        {step === 'verify' ? (
          <FadeIn key="verify" dx={30} from={0}>
            <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
              <Ionicons name="chatbubble-ellipses-outline" size={34} color={colors.primary} />
            </View>
            <Txt v="display" style={{ marginTop: 18 }}>Verify your mobile</Txt>
            <Txt style={{ marginTop: 6 }}>Enter the 4-digit code sent to <Text style={{ fontFamily: fonts.bold, color: colors.ink }}>+91 {f.phone.slice(0, 5)} {f.phone.slice(5)}</Text></Txt>
            <OtpInput value={otp} onChange={(v) => { setOtp(v); setOtpErr(''); }} error={!!otpErr} />
            {otpErr ? <Row gap={6} style={{ marginBottom: 10 }}><Ionicons name="alert-circle" size={15} color={colors.danger} /><Txt v="small" style={{ color: colors.danger, flex: 1 }}>{otpErr}</Txt></Row>
              : <Txt v="caption" style={{ marginBottom: 10 }}>Demo: the code is {DEMO_OTP}</Txt>}
            <Button title={role === 'creator' ? 'Create household' : 'Join household'} icon="checkmark" full disabled={otp.length < 4} onPress={verify} style={{ marginTop: 8 }} />
            <Row gap={4} style={{ justifyContent: 'center', marginTop: 18 }}>
              <Txt v="small">Didn't get it?</Txt>
              {timer > 0 ? <Txt v="small" style={{ fontFamily: fonts.bold }}>Resend in 0:{String(timer).padStart(2, '0')}</Txt>
                : <Text onPress={() => { setTimer(30); toast('Code resent', { icon: 'chatbubble' }); }} style={{ fontFamily: fonts.bold, color: colors.primary, fontSize: 13.5 }}>Resend code</Text>}
            </Row>
          </FadeIn>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RoleCard({ selected, onPress, emoji, tint, soft, title, badge, points }) {
  return (
    <Tap onPress={onPress} scaleTo={0.98} hapticKind="light" accessibilityRole="radio" accessibilityLabel={`${title}, ${badge}`}
      style={{ backgroundColor: colors.surface, borderRadius: 22, padding: 18, marginBottom: 14, borderWidth: selected ? 2 : 1, borderColor: selected ? tint : colors.line, ...(selected ? shadow.card : {}) }}>
      <Row center={false} gap={14}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: soft, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 28 }}>{emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: soft }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: tint }}>{badge}</Text>
            </View>
            <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? tint : colors.lineStrong} />
          </Row>
          <Txt v="h2" style={{ marginTop: 6 }}>{title}</Txt>
          <View style={{ marginTop: 8, gap: 5 }}>
            {points.map((p) => (
              <Row key={p} gap={8}><Ionicons name="checkmark" size={15} color={tint} /><Txt v="small" style={{ flex: 1 }}>{p}</Txt></Row>
            ))}
          </View>
        </View>
      </Row>
    </Tap>
  );
}

function OtpInput({ value, onChange, error }) {
  const ref = useRef(null);
  return (
    <Pressable onPress={() => ref.current?.focus()} style={{ flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 12 }} accessibilityLabel="One-time code">
      {[0, 1, 2, 3].map((i) => {
        const active = value.length === i;
        return (
          <View key={i} style={{ flex: 1, height: 64, borderRadius: 18, backgroundColor: colors.surface, borderWidth: active ? 2 : 1, borderColor: error ? colors.danger : active ? colors.primary : colors.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.display, fontSize: 28, color: colors.ink }}>{value[i] || ''}</Text>
          </View>
        );
      })}
      <TextInput ref={ref} value={value} onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" autoFocus maxLength={4}
        textContentType="oneTimeCode" autoComplete="sms-otp" accessibilityLabel="Enter code"
        style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%' }} />
    </Pressable>
  );
}
