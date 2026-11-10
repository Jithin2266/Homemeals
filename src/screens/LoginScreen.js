import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { Button, Field, Row, Sheet, Tap, Txt, haptic, useFeedback, Avatar } from '../ui';
import { colors, fonts, radius, shadow } from '../theme';
import { FadeIn, PopIn } from '../motion';
import { DEMO } from '../config';

export default function LoginScreen({ onRegister }) {
  const { login, t, data, setLang } = useStore();
  const { toast } = useFeedback();
  const insets = useSafeAreaInsets();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [forgot, setForgot] = useState(false);
  const [resetId, setResetId] = useState('');

  const [busy, setBusy] = useState(false);
  const submit = async (a = id, b = pw) => {
    if (!a.trim() || !b) { setErr('Enter your mobile number and password.'); return; }
    if (busy) return;
    setBusy(true);
    const r = await login(a, b);
    setBusy(false);
    if (!r.ok) { setErr(r.error === 'invalidLogin' ? t('invalidLogin') : r.error); haptic('warn'); }
    else { haptic('success'); if (r.migrated) toast('Your household is now online — family can join from their own phones', { icon: 'cloud-done' }); }
  };

  const demo = (u) => { setId(u.email); setPw('demo123'); setErr(''); submit(u.email, 'demo123'); };
  const creator = data.users.find((u) => u.id === 'u1') || data.users.find((u) => u.role === 'creator');
  const viewers = data.users.filter((u) => u.role === 'viewer' && u.status === 'active' && u.householdId === creator?.householdId).slice(0, 2);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 + insets.bottom }} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={[colors.primaryDark, colors.primary, '#2D7A5C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ paddingTop: insets.top + 24, paddingHorizontal: 24, paddingBottom: 64, borderBottomLeftRadius: 36, borderBottomRightRadius: 36 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={10}>
              <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="leaf" size={22} color={colors.primaryDark} />
              </View>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: 24, color: '#fff' }}>HomeMeal</Text>
            </Row>
            <Pressable onPress={() => setLang(data.lang === 'en' ? 'ml' : 'en')} accessibilityRole="button" accessibilityLabel="Change language"
              style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.14)', flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Ionicons name="language" size={15} color="#fff" />
              <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 13 }}>{data.lang === 'en' ? 'മലയാളം' : 'English'}</Text>
            </Pressable>
          </Row>
          <View style={{ marginTop: 36, flexDirection: 'row', gap: 10 }}>
            {['🥥', '🍛', '🐟', '🍌', '🌶️'].map((e, i) => (
              <PopIn key={e} delay={200 + i * 90}><View style={{ width: 50, height: 50, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: `${(i - 2) * 5}deg` }, { translateY: Math.abs(i - 2) * 4 }] }}>
                <Text style={{ fontSize: 24 }}>{e}</Text>
              </View></PopIn>
            ))}
          </View>
          <Text style={{ fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: '#fff', marginTop: 24 }}>{t('tagline')}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: 'rgba(255,255,255,0.78)', marginTop: 8, lineHeight: 22 }}>
            One shared menu and grocery list for the whole family.
          </Text>
        </LinearGradient>

        <FadeIn delay={250} from={30} style={{ marginHorizontal: 18, marginTop: -40, backgroundColor: colors.surface, borderRadius: 26, padding: 20, ...shadow.float }}>
          <Txt v="h2" style={{ marginBottom: 14 }}>{t('signIn')}</Txt>
          <Field label={t('emailOrMobile')} value={id} onChangeText={(v) => { setId(v); setErr(''); }} placeholder="you@email.com or 98xxxxxxxx" autoCapitalize="none" keyboardType="email-address" returnKeyType="next" />
          <Field label={t('password')} value={pw} onChangeText={(v) => { setPw(v); setErr(''); }} placeholder="••••••••" secureTextEntry={!show} error={err} onSubmitEditing={() => submit()} returnKeyType="go"
            right={<Pressable onPress={() => setShow(!show)} hitSlop={10} accessibilityLabel={show ? 'Hide password' : 'Show password'}><Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} /></Pressable>} />
          <Button title={busy ? 'Signing in…' : t('signIn')} disabled={busy} onPress={() => submit()} full iconRight="arrow-forward" />
          <Pressable onPress={() => { setResetId(id); setForgot(true); }} style={{ alignSelf: 'center', marginTop: 14, padding: 4 }} accessibilityRole="button">
            <Text style={{ fontFamily: fonts.bold, color: colors.primary, fontSize: 14 }}>{t('forgotPassword')}</Text>
          </Pressable>
        </FadeIn>

        <View style={{ paddingHorizontal: 18, marginTop: 18, flexDirection: 'row', gap: 10 }}>
          <Tap onPress={() => onRegister(null)} accessibilityLabel="Create an account" style={{ flex: 1, backgroundColor: colors.primarySoft, borderRadius: 18, padding: 14, gap: 6 }}>
            <Ionicons name="person-add-outline" size={22} color={colors.primary} />
            <Txt v="title" style={{ fontSize: 14.5 }}>Create account</Txt>
            <Txt v="caption">Start a new household as Creator</Txt>
          </Tap>
          <Tap onPress={() => onRegister('viewer')} accessibilityLabel="Join with an invite code" style={{ flex: 1, backgroundColor: colors.accentSoft, borderRadius: 18, padding: 14, gap: 6 }}>
            <Ionicons name="key-outline" size={22} color="#A86A07" />
            <Txt v="title" style={{ fontSize: 14.5 }}>Have a code?</Txt>
            <Txt v="caption">Join your family as Viewer</Txt>
          </Tap>
        </View>

        <View style={{ paddingHorizontal: 18, marginTop: 26 }}>
          {DEMO ? <Txt v="label" style={{ marginBottom: 10, marginLeft: 4 }}>{t('demoAccounts')}</Txt> : null}
          {(DEMO && creator ? [creator, ...viewers] : []).map((u) => (
            <Tap key={u.id} onPress={() => demo(u)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.line }}
              accessibilityLabel={`Sign in as ${u.name}`}>
              <Avatar user={u} size={42} />
              <View style={{ flex: 1 }}>
                <Txt v="title">{u.name}</Txt>
                <Txt v="caption">{u.role === 'creator' ? t('creatorDemo') : `${t('viewerDemo')} · ${u.relation}`}</Txt>
              </View>
              <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: u.role === 'creator' ? colors.primarySoft : colors.accentSoft }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: u.role === 'creator' ? colors.primary : '#8A5A08' }}>{u.role === 'creator' ? 'Creator' : 'Viewer'}</Text>
              </View>
            </Tap>
          ))}
          {DEMO ? <Txt v="caption" style={{ textAlign: 'center', marginTop: 6 }}>Demo password for all accounts: demo123</Txt> : null}
        </View>
      </ScrollView>

      <Sheet visible={forgot} onClose={() => setForgot(false)} title="Reset password" subtitle={DEMO ? "We'll send a reset link or OTP to your registered email or mobile." : 'Your account is stored on this phone.'}>
        {DEMO ? (
          <>
            <Field label={t('emailOrMobile')} value={resetId} onChangeText={setResetId} autoCapitalize="none" placeholder="you@email.com" />
            <Button title="Send reset link" full icon="paper-plane-outline" onPress={() => { setForgot(false); toast(t('resetSent'), { icon: 'mail' }); }} disabled={!resetId.trim()} />
          </>
        ) : (
          <>
            <Txt style={{ marginBottom: 14 }}>Reset links by SMS or email need the online account service, which isn't connected yet. If you're a family member, ask your household Creator to remove you and share the household code again, then register once more.</Txt>
            <Button title="OK" full onPress={() => setForgot(false)} />
          </>
        )}
      </Sheet>
    </KeyboardAvoidingView>
  );
}
