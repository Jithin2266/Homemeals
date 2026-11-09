import React, { useState } from 'react';
import { Platform, ScrollView, Share, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore, formatCode } from '../store';
import { PopIn } from '../motion';
import { DEMO } from '../config';
import { ScreenHeader } from '../nav';
import { Avatar, Button, Card, Chip, Field, Row, Sheet, Txt, useFeedback, haptic } from '../ui';
import { colors, fonts, shadow } from '../theme';

const RELATIONS = ['Husband', 'Wife', 'Son', 'Daughter', 'Parent', 'Grandparent', 'Helper', 'Other'];

export default function MembersScreen() {
  const { t, data, isCreator, me, inviteMember, setMemberStatus, activateInvite, regenerateJoinCode } = useStore();
  const joinCode = data.household.joinCode;
  const { toast, confirm } = useFeedback();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', phone: '', relation: 'Son' });
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(null);

  const send = () => {
    const r = inviteMember(f);
    if (!r.ok) { setErr(r.error); haptic('warn'); return; }
    haptic('success');
    setSent({ ...f, code: r.code });
  };
  const shareInvite = async () => {
    const msg = `Hi ${sent.name.split(' ')[0]}! Join our family on HomeMeal to see the weekly menu and grocery list.\nInvite code: ${sent.code}\nhttps://homemeal.app/join`;
    try {
      if (Platform.OS === 'web') { await navigator.clipboard?.writeText(msg); toast('Invite copied to clipboard', { icon: 'copy' }); }
      else await Share.share({ message: msg });
    } catch (e) {}
  };
  const closeSheet = () => { setOpen(false); setTimeout(() => { setSent(null); setF({ name: '', phone: '', relation: 'Son' }); setErr(''); }, 300); };

  const toggle = async (u) => {
    if (u.status === 'active') {
      const ok = await confirm({ title: `Deactivate ${u.name}?`, body: 'They will immediately lose access to the menu and grocery list. You can reactivate later.', ok: 'Deactivate', danger: true, icon: 'person-remove-outline' });
      if (!ok) return;
      setMemberStatus(u.id, 'deactivated');
      toast(`${u.name.split(' ')[0]} deactivated`);
    } else {
      setMemberStatus(u.id, 'active');
      toast(`${u.name.split(' ')[0]} reactivated`);
    }
  };

  const groups = [
    { k: 'Active', items: data.users.filter((u) => u.status === 'active') },
    { k: 'Invited', items: data.users.filter((u) => u.status === 'invited') },
    { k: 'Deactivated', items: data.users.filter((u) => u.status === 'deactivated') },
  ].filter((g) => g.items.length);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader back title={t('members')} subtitle={`🏠 ${data.household.name}`} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 + insets.bottom }}>
        {isCreator && joinCode ? (
          <PopIn style={{ marginBottom: 14 }}>
            <View style={{ backgroundColor: colors.primary, borderRadius: 22, padding: 18 }}>
              <Row gap={8}>
                <Ionicons name="key" size={16} color={colors.accent} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1, color: 'rgba(255,255,255,0.8)' }}>HOUSEHOLD CODE</Text>
              </Row>
              <Text selectable accessibilityLabel={`Household code ${joinCode.split('').join(' ')}`} style={{ fontFamily: fonts.display, fontSize: 38, letterSpacing: 6, color: '#fff', marginTop: 6 }}>{formatCode(joinCode)}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>Family members choose "Have a code?" when they sign up and enter this code to join {data.household.name} as a Viewer.</Text>
              <Row gap={10} style={{ marginTop: 14 }}>
                <Button small kind="accent" icon="share-social-outline" title="Share code" onPress={async () => {
                  const msg = `Join ${data.household.name} on HomeMeal to see our weekly menu and grocery list.\nOpen the app → Create account → "Have a code?"\nHousehold code: ${joinCode}`;
                  try {
                    if (Platform.OS === 'web') { await navigator.clipboard?.writeText(msg); toast('Code copied — paste it in WhatsApp', { icon: 'copy' }); }
                    else await Share.share({ message: msg });
                  } catch (e) {}
                }} />
                <Button small kind="secondary" icon="refresh" title="New code" onPress={async () => {
                  const ok = await confirm({ title: 'Create a new household code?', body: 'The current code will stop working. Members who already joined are not affected.', ok: 'New code', icon: 'refresh' });
                  if (ok) { regenerateJoinCode(); haptic('success'); toast('New household code created'); }
                }} />
              </Row>
            </View>
          </PopIn>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 10, backgroundColor: colors.primarySoft, borderRadius: 16, padding: 14, marginBottom: 14 }}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
          <Txt v="small" style={{ flex: 1, color: colors.primaryDark }}>Viewers can see published menus and tick off groceries. Only the Creator can plan meals and edit the list.</Txt>
        </View>
        {groups.map((g) => (
          <View key={g.k} style={{ marginBottom: 12 }}>
            <Txt v="label" style={{ marginLeft: 4, marginBottom: 8 }}>{g.k} · {g.items.length}</Txt>
            <Card pad={0}>
              {g.items.map((u, i) => (
                <Row key={u.id} style={{ padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line, opacity: u.status === 'deactivated' ? 0.6 : 1 }}>
                  <Avatar user={u} size={42} />
                  <View style={{ flex: 1 }}>
                    <Row gap={6}>
                      <Txt v="title" numberOfLines={1} style={{ flexShrink: 1 }}>{u.name}</Txt>
                      {u.id === me.id ? <Txt v="caption">(you)</Txt> : null}
                    </Row>
                    <Txt v="caption">{u.relation} · {u.role === 'creator' ? 'Creator' : 'Viewer'}{u.status === 'invited' ? ` · code ${u.inviteCode || 'sent'}` : ''}</Txt>
                  </View>
                  {isCreator && u.role !== 'creator' ? (
                    u.status === 'invited' ? (!DEMO ? <Txt v="caption">Waiting to join</Txt> : 
                      <Button small kind="soft" title="Mark joined" onPress={() => { activateInvite(u.id); toast(`${u.name.split(' ')[0]} joined · demo password demo123`); }} />
                    ) : (
                      <Button small kind={u.status === 'active' ? 'secondary' : 'soft'} title={u.status === 'active' ? 'Deactivate' : 'Reactivate'} onPress={() => toggle(u)} />
                    )
                  ) : null}
                </Row>
              ))}
            </Card>
          </View>
        ))}
      </ScrollView>
      {isCreator ? (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16 + insets.bottom }}>
          <Button title="Invite a family member" icon="person-add-outline" full onPress={() => setOpen(true)} style={shadow.float} />
        </View>
      ) : null}

      <Sheet visible={open} onClose={closeSheet} title={sent ? 'Invite ready' : 'Invite a family member'} subtitle={sent ? null : 'They join as a Viewer and can tick off groceries.'}
        footer={sent ? (
          <Row gap={10}><Button title="Done" kind="secondary" onPress={closeSheet} /><Button title="Share invite" icon="logo-whatsapp" style={{ flex: 1 }} full onPress={shareInvite} /></Row>
        ) : <Button title="Create invite" icon="paper-plane-outline" full onPress={send} />}>
        {sent ? (
          <View style={{ alignItems: 'center', paddingVertical: 10 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.purchasedSoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="mail-open-outline" size={34} color={colors.purchased} /></View>
            <Txt style={{ textAlign: 'center', marginTop: 12 }}>Send this code to {sent.name.split(' ')[0]} ({sent.phone}). They'll verify with an OTP and join {data.household.name}.</Txt>
            <View style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary }}>
              <Text style={{ fontFamily: fonts.display, fontSize: 30, letterSpacing: 6, color: colors.primary }}>{sent.code}</Text>
            </View>
          </View>
        ) : (
          <>
            <Field label="Name" value={f.name} onChangeText={(v) => { setF({ ...f, name: v }); setErr(''); }} placeholder="e.g. Arjun Menon" />
            <Field label="Mobile number" value={f.phone} onChangeText={(v) => { setF({ ...f, phone: v.replace(/\D/g, '').slice(0, 10) }); setErr(''); }} placeholder="10-digit mobile" keyboardType="phone-pad" error={err} />
            <Txt v="small" style={{ fontFamily: fonts.semibold, color: colors.ink, marginBottom: 8 }}>Relation</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {RELATIONS.map((r) => <Chip key={r} label={r} selected={f.relation === r} onPress={() => setF({ ...f, relation: r })} />)}
            </View>
          </>
        )}
      </Sheet>
    </View>
  );
}
