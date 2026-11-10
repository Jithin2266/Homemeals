import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildDb, emptyDb, emptyHousehold, SEED_VERSION, newEmptyDays, uid, DISH_LIBRARY } from './seed';
import { DEMO, DEMO_HOUSEHOLD_ID, DEMO_USER_IDS } from './config';
import { openStore } from './db/adapter';
import { toTables, fromTables, diffTables, householdTables, mergeHousehold } from './db/mapper';
import * as cloud from './cloud';
import { hashPassword, newSalt } from './db/crypto';
import { addDays, diffDays, fmtRange, mondayOf, todayISO, weekDates, dowLong } from './dates';
import { makeT } from './i18n';

/*
 * HomeMeal data layer.
 * In production every action below maps to an authorised REST call
 * (SRS §10); the backend is the source of truth for permissions.
 * Here the same rules run locally so the app works end-to-end on one
 * device, and in a browser the data syncs live across tabs (open one
 * tab as Creator and one as Viewer to see shared updates).
 */

const SESSION_KEY = 'homemeal:session';

const clone = (o) => JSON.parse(JSON.stringify(o));

// Session is per-device; on web keep it per-tab so two tabs can be two family members.
const webSession = (() => { try { return Platform.OS === 'web' && typeof window !== 'undefined' && !!window.sessionStorage && (window.sessionStorage.getItem('hm'), true); } catch (e) { return false; } })();
const session = {
  get: async () => (webSession ? window.sessionStorage.getItem(SESSION_KEY) : AsyncStorage.getItem(SESSION_KEY)),
  set: async (v) => (webSession ? window.sessionStorage.setItem(SESSION_KEY, v) : AsyncStorage.setItem(SESSION_KEY, v)),
  clear: async () => (webSession ? window.sessionStorage.removeItem(SESSION_KEY) : AsyncStorage.removeItem(SESSION_KEY)),
};
const Ctx = createContext(null);

// Household / invite codes: 6 characters without look-alikes (no O/0, I/1/L).
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const normCode = (c) => (c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const randomCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
function newJoinCode(d) {
  const used = new Set([...Object.values(d.households).map((h) => normCode(h.household.joinCode)), ...d.users.map((u) => normCode(u.inviteCode))]);
  let c = randomCode();
  while (used.has(c)) c = randomCode();
  return c;
}
export const formatCode = (c) => (c ? `${c.slice(0, 3)} ${c.slice(3)}` : '');

// Upgrades data saved by older app versions without losing anything.
function upgradeDb(d) {
  d.seedVersion = SEED_VERSION;
  if (!DEMO) {
    // Live app: remove the sample "Menon Family" and its demo accounts left by
    // earlier versions. Households people registered themselves are kept.
    const demoHh = d.households[DEMO_HOUSEHOLD_ID];
    const isSample = demoHh && demoHh.household.name === 'Menon Family' && d.users.some((u) => u.id === 'u1' && u.email === 'anitha@homemeal.app');
    if (isSample) {
      delete d.households[DEMO_HOUSEHOLD_ID];
      d.users = d.users.filter((u) => u.householdId !== DEMO_HOUSEHOLD_ID && !DEMO_USER_IDS.includes(u.id));
    }
  }
  Object.values(d.households).forEach((h) => {
    if (!h.household.joinCode) h.household.joinCode = h.household.id === 'hh1' ? 'MENU24' : newJoinCode(d);
    h.audit = h.audit || [];
    h.customDishes = h.customDishes || [];
  });
  return d;
}

export const scheduleStatus = (s) => {
  if (!s) return null;
  const end = addDays(s.startDate, 6);
  if (s.status === 'published' && diffDays(end, todayISO()) < 0) return 'archived';
  return s.status;
};

export const countPlanned = (s) => {
  if (!s) return 0;
  let c = 0;
  Object.values(s.days).forEach((d) => ['breakfast', 'lunch', 'dinner'].forEach((m) => { if (d[m] && d[m].length) c++; }));
  return c;
};

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export const isSimilar = (a, b) => {
  const x = norm(a); const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [sh, lo] = x.length <= y.length ? [x, y] : [y, x];
  return sh.length > 3 && lo.includes(sh) && sh.length / lo.length >= 0.7;
};

const CLOUD = !DEMO; // live app syncs through Firebase
const clone2 = (o) => JSON.parse(JSON.stringify(o));
const COLORS = ['#C4513A', '#5B4B9A', '#3F5BA9', '#E19A2B', '#2E7D5B'];

export function StoreProvider({ children }) {
  // db = { users: [all users], households: { [id]: household data }, lang }
  const [db, setDb] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [ready, setReady] = useState(false);

  // ---- Database: normalized tables, row-level writes ----
  const storeRef = useRef(null);      // storage adapter (SQLite on device, row store on web)
  const savedRef = useRef(null);      // last tables written, for diffing
  const queueRef = useRef(Promise.resolve());
  const [dbInfo, setDbInfo] = useState({ label: '', lastWrite: null, writes: 0 });

  // Load
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const store = await openStore();
      storeRef.current = store;
      let T = null;
      try { T = await store.loadAll(); } catch (e) { console.warn('DB load failed', e); }
      let d;
      if (!T) {
        // First launch: live app starts empty; the demo preview gets the sample family.
        d = DEMO ? buildDb() : emptyDb();
        T = toTables(d);
        await store.replaceAll(T);
        savedRef.current = T;
      } else {
        // Existing data is always kept. Older versions are upgraded in place.
        d = upgradeDb(fromTables(T));
        savedRef.current = T;   // the persist step writes only what the upgrade changed
      }
      let s = null;
      try { s = await session.get(); } catch (e) {}
      setDbInfo((x) => ({ ...x, label: store.label, kind: store.kind }));
      setDb(d);
      setSessionId(s || null);
      setReady(true);
      // Rows changed elsewhere (another tab / device) → reload
      unsub = store.subscribe(async () => {
        const fresh = await store.loadAll();
        if (!fresh) return;
        savedRef.current = fresh;
        setDb(fromTables(fresh));
      });
    })();
    return () => unsub();
  }, []);

  // Persist only the rows that changed
  useEffect(() => {
    if (!ready || !db || !storeRef.current) return;
    const next = toTables(db);
    const changes = diffTables(savedRef.current, next);
    if (!changes.length) return;
    savedRef.current = next;
    const rows = changes.reduce((a, c) => a + c.upserts.length + c.deletes.length, 0);
    queueRef.current = queueRef.current
      .then(() => storeRef.current.apply(changes))
      .then(() => setDbInfo((x) => ({ ...x, writes: x.writes + rows, lastWrite: { at: Date.now(), rows, tables: changes.map((c) => c.table) } })))
      .catch((e) => console.warn('DB write failed', e));
  }, [db, ready]);

  const me = db && sessionId ? db.users.find((u) => u.id === sessionId && u.status === 'active') : null;
  const meRef = useRef(null);
  meRef.current = me;
  const hid = me?.householdId;

  // Household-scoped view (BR-011: a user only ever sees their own household's data)
  const data = useMemo(() => {
    if (!db) return null;
    if (!hid || !db.households[hid]) return { users: db.users, lang: db.lang };
    return { ...db.households[hid], users: db.users.filter((u) => u.householdId === hid), lang: db.lang };
  }, [db, hid]);
  const dataRef = useRef(null);
  dataRef.current = data;

  const mutateDb = useCallback((fn) => setDb((prev) => { const next = clone(prev); fn(next); return next; }), []);
  // Mutate the signed-in user's household
  const mutate = useCallback((fn) => {
    setDb((prev) => {
      const h = meRef.current?.householdId;
      if (!h) return prev;
      const next = clone(prev);
      const view = { ...next.households[h], users: next.users.filter((u) => u.householdId === h) };
      fn(view);
      const { users, lang, ...rest } = view;
      next.households[h] = rest;
      next.users = [...next.users.filter((u) => u.householdId !== h), ...users.map((u) => ({ ...u, householdId: h }))];
      return next;
    });
  }, []);

  const isCreator = me?.role === 'creator';
  const t = useMemo(() => makeT(db?.lang || 'en'), [db?.lang]);

  // ---- helpers ----
  const audit = (d, action, entity, entityId, details) => {
    d.audit = d.audit || [];
    d.audit.unshift({ id: uid('a'), actor: meRef.current?.id || null, action, entity, entityId, details: details || '', at: Date.now() });
    d.audit = d.audit.slice(0, 300);
  };
  const notify = (d, n) => {
    d.notifications.unshift({ id: uid('n'), at: Date.now(), readBy: [], ...n });
    d.notifications = d.notifications.slice(0, 80);
  };
  const userName = (id) => dataRef.current?.users.find((u) => u.id === id)?.name.split(' ')[0] || 'Someone';
  const guardCreator = () => {
    if (!isCreator) return { ok: false, error: 'Only the Creator can do this.' };
    return null;
  };

  // ---- auth ----
  const signIn = (u) => { setSessionId(u.id); session.set(u.id).catch(() => {}); };
  const loginLocal = (idOrPhone, password) => {
    const key = idOrPhone.trim().toLowerCase();
    const u = db.users.find((x) => ((x.email && x.email.toLowerCase() === key) || x.phone === key) && x.passwordHash && x.passwordHash === hashPassword(password, x.passwordSalt));
    if (!u) return { ok: false, error: 'invalidLogin' };
    if (u.status === 'deactivated') return { ok: false, error: 'This account has been deactivated by the household Creator.' };
    if (u.status !== 'active') return { ok: false, error: 'Please finish registration with your invite code.' };
    signIn(u);
    return { ok: true, user: u };
  };
  const logoutLocal = () => {
    setSessionId(null);
    session.clear().catch(() => {});
  };
  const setLang = (lang) => mutateDb((d) => { d.lang = lang; });
  const resetDemo = () => { if (DEMO) setDb(buildDb()); };

  // ---- registration ----
  const accountTaken = ({ email, phone }, ignoreId) => {
    const e = (email || '').trim().toLowerCase();
    if (phone && db.users.some((u) => u.id !== ignoreId && u.phone === phone.trim() && u.status !== 'invited')) return 'This mobile number is already registered. Try signing in.';
    if (e && db.users.some((u) => u.id !== ignoreId && (u.email || '').toLowerCase() === e)) return 'This email is already registered. Try signing in.';
    return null;
  };
  const findInvite = (code) => {
    const c = normCode(code);
    if (c.length < 4) return null;
    // 1) personal invite for one person
    const u = db.users.find((x) => x.status === 'invited' && normCode(x.inviteCode) === c);
    if (u) {
      const hh = db.households[u.householdId];
      const creator = db.users.find((x) => x.householdId === u.householdId && x.role === 'creator');
      return { kind: 'personal', user: u, household: hh?.household, creator };
    }
    // 2) household code that anyone in the family can use
    const hid = Object.keys(db.households).find((k) => normCode(db.households[k].household.joinCode) === c);
    if (hid) {
      const creator = db.users.find((x) => x.householdId === hid && x.role === 'creator');
      return { kind: 'household', user: null, household: db.households[hid].household, creator, householdId: hid };
    }
    return null;
  };
  const registerCreatorLocal = (f) => {
    const taken = accountTaken(f);
    if (taken) return { ok: false, error: taken };
    const id = uid('u'); const h = uid('hh');
    const salt = newSalt();
    const user = { id, householdId: h, name: f.name.trim(), email: (f.email || '').trim().toLowerCase(), phone: f.phone.trim(), passwordSalt: salt, passwordHash: hashPassword(f.password, salt), role: 'creator', status: 'active', color: '#1F5C46', relation: 'Homemaker', createdAt: Date.now(), joinedAt: Date.now() };
    mutateDb((d) => {
      d.users.push(user);
      d.households[h] = emptyHousehold(h, f.householdName.trim());
      d.households[h].household.joinCode = newJoinCode(d);
      d.households[h].prefs[id] = { schedule: true, grocery: true, purchase: true, reminders: true };
      d.households[h].audit.unshift({ id: uid('a'), actor: id, action: 'household.created', entity: 'household', entityId: h, details: f.householdName.trim(), at: Date.now() });
    });
    signIn(user);
    return { ok: true, user };
  };
  const registerViewerLocal = (f) => {
    const inv = findInvite(f.code);
    if (!inv) return { ok: false, error: 'That code is not valid. Check it with the household Creator.' };
    const taken = accountTaken(f, inv.user?.id);
    if (taken) return { ok: false, error: taken };
    const salt = newSalt();
    const base = inv.user || {
      id: uid('u'), householdId: inv.householdId, role: 'viewer', relation: f.relation || 'Family', createdAt: Date.now(),
      color: ['#C4513A', '#5B4B9A', '#3F5BA9', '#E19A2B', '#2E7D5B'][Math.floor(Math.random() * 5)],
    };
    const user = { ...base, name: f.name.trim(), email: (f.email || '').trim().toLowerCase(), phone: f.phone.trim(), passwordSalt: salt, passwordHash: hashPassword(f.password, salt), status: 'active', inviteCode: null, joinedAt: Date.now() };
    mutateDb((d) => {
      const i = d.users.findIndex((x) => x.id === user.id);
      if (i >= 0) d.users[i] = user; else d.users.push(user);
      const hh = d.households[user.householdId];
      hh.prefs[user.id] = { schedule: true, grocery: true, purchase: true, reminders: true };
      (hh.audit = hh.audit || []).unshift({ id: uid('a'), actor: user.id, action: 'member.joined', entity: 'household_member', entityId: `m_${user.id}`, details: user.name, at: Date.now() });
      hh.notifications.unshift({ id: uid('n'), at: Date.now(), readBy: [], to: 'creator', type: 'member', from: user.id, title: `${user.name.split(' ')[0]} joined ${hh.household.name}`, body: `Joined as a Viewer (${user.relation})${inv.kind === 'household' ? ' using the household code' : ''}` });
    });
    signIn(user);
    return { ok: true, user };
  };


  // =====================================================================
  // ONLINE (live app): Firebase accounts, household codes and live sync
  // =====================================================================
  const cloudRef = useRef({ hid: null, role: null, userId: null, saved: null, unsub: null, queue: Promise.resolve() });
  const [cloudState, setCloudState] = useState(CLOUD ? 'starting' : 'off'); // starting | signed-out | connecting | live | offline | error
  const dbRef = useRef(null);
  dbRef.current = db;

  const stopSync = () => {
    const c = cloudRef.current;
    if (c.unsub) c.unsub();
    cloudRef.current = { hid: null, role: null, userId: null, saved: null, unsub: null, queue: Promise.resolve() };
  };

  const startSync = (link) => {
    stopSync();
    const c = cloudRef.current;
    Object.assign(c, { hid: link.householdId, role: link.role, userId: link.userId });
    setCloudState('connecting');
    c.unsub = cloud.subscribeHousehold(link.householdId, (remote) => {
      if (cloudRef.current.hid !== link.householdId) return;
      if (!remote.households.length && link.role === 'creator' && dbRef.current?.households[link.householdId]) {
        // Household exists only on this phone (an upload was interrupted): finish it.
        bootstrapHousehold(dbRef.current, link.householdId, link.userId).catch((e) => console.warn('bootstrap', e));
        return;
      }
      cloudRef.current.saved = remote;
      setDb((prev) => mergeHousehold(prev, link.householdId, remote));
      setCloudState('live');
    }, (err) => {
      console.warn('sync error', err?.code, err?.message);
      if ((err?.code || '').includes('permission-denied')) {
        // Removed or deactivated by the Creator
        stopSync();
        cloud.signOutCloud().catch(() => {});
        setSessionId(null); session.clear().catch(() => {});
        setCloudState('signed-out');
      } else setCloudState('offline');
    });
  };

  // Push local edits of the signed-in household, row by row
  useEffect(() => {
    const c = cloudRef.current;
    if (!CLOUD || !ready || !db || !c.hid || !c.saved) return;
    const next = householdTables(db, c.hid);
    if (!next) return;
    const changes = diffTables(c.saved, next);
    if (!changes.length) return;
    c.saved = next;
    const { hid, role, userId } = c;
    c.queue = c.queue
      .then(() => cloud.pushChanges(hid, changes, { role, userId }))
      .then(() => setCloudState('live'))
      .catch((e) => { console.warn('push failed', e?.code, e?.message); setCloudState('offline'); });
  }, [db, ready]);

  // Restore the signed-in account when the app opens
  useEffect(() => {
    if (!CLOUD || !ready) return undefined;
    const off = cloud.onAuth(async (user) => {
      if (!user) {
        stopSync();
        // A session from the older offline version: sign in again once to move it online.
        setSessionId((cur) => { if (cur) session.clear().catch(() => {}); return null; });
        setCloudState('signed-out');
        return;
      }
      if (cloudRef.current.hid) return; // already started by login/registration
      try {
        const link = await cloud.getLink(user.uid);
        if (!link) { setCloudState('signed-out'); return; }
        setSessionId(link.userId); session.set(link.userId).catch(() => {});
        startSync({ householdId: link.householdId, role: link.role, userId: link.userId });
      } catch (e) { setCloudState('offline'); }
    });
    return off;
  }, [ready]);

  /** Upload a household that so far exists only on this phone (new or from the offline version). */
  async function bootstrapHousehold(d, hid, userId) {
    const h = d.households[hid].household;
    const creator = d.users.find((u) => u.id === userId);
    const T = householdTables(d, hid);
    await cloud.setHouseholdDoc(hid, T.households[0]);
    await cloud.setRow(hid, 'household_members', T.household_members.find((m) => m.user_id === userId));
    await cloud.setJoinCode(normCode(h.joinCode), { householdId: hid, type: 'household', householdName: h.name, creatorName: creator?.name || '' });
    for (const u of d.users.filter((x) => x.householdId === hid && x.status === 'invited' && x.inviteCode)) {
      await cloud.setJoinCode(normCode(u.inviteCode), { householdId: hid, type: 'personal', memberUserId: u.id, memberName: u.name, relation: u.relation || 'Family', householdName: h.name, creatorName: creator?.name || '' });
    }
    await cloud.pushChanges(hid, diffTables({}, T), { role: 'creator', userId });
    return T;
  }

  async function uniqueCode(d) {
    for (let i = 0; i < 8; i++) {
      const c = newJoinCode(d);
      if (!(await cloud.getJoinCode(c))) return c;
    }
    throw new Error('Could not create a code. Please try again.');
  }

  const loginCloud = async (idOrPhone, password) => {
    const key = idOrPhone.trim().toLowerCase();
    const phone = /^\d{10}$/.test(key) ? key : db.users.find((u) => (u.email || '').toLowerCase() === key)?.phone;
    if (!phone) return { ok: false, error: 'Please sign in with your 10-digit mobile number.' };
    try {
      const user = await cloud.signInPhone(phone, password);
      const link = await cloud.getLink(user.uid);
      if (!link) { await cloud.signOutCloud(); return { ok: false, error: 'This account is not part of a household yet. Register again with your household code.' }; }
      setSessionId(link.userId); session.set(link.userId).catch(() => {});
      startSync({ householdId: link.householdId, role: link.role, userId: link.userId });
      return { ok: true };
    } catch (e) {
      const code = e?.code || '';
      if (code.includes('invalid-credential') || code.includes('user-not-found') || code.includes('wrong-password')) {
        // Account made with the offline version (v1.0–v1.2): move it online now.
        const local = db.users.find((u) => u.phone === phone && u.passwordHash && u.passwordHash === hashPassword(password, u.passwordSalt));
        if (local) return migrateLocal(local, password);
      }
      return { ok: false, error: cloud.friendlyError(e) };
    }
  };

  async function migrateLocal(local, password) {
    const hid = local.householdId;
    if (!db.households[hid]) return { ok: false, error: 'Your household data was not found on this phone.' };
    if (local.status !== 'active') return { ok: false, error: 'This account has been deactivated by the household Creator.' };
    try {
      const cu = await cloud.signUpPhone(local.phone, password);
      if (local.role === 'creator') {
        let d = clone2(db);
        let code = normCode(d.households[hid].household.joinCode);
        if (!code || (await cloud.getJoinCode(code))) { code = await uniqueCode(d); d.households[hid].household.joinCode = code; }
        for (const u of d.users.filter((x) => x.householdId === hid && x.status === 'invited' && x.inviteCode)) {
          if (await cloud.getJoinCode(normCode(u.inviteCode))) u.inviteCode = await uniqueCode(d);
        }
        setDb(d);
        await cloud.createLink(cu.uid, { householdId: hid, userId: local.id, role: 'creator' });
        await bootstrapHousehold(d, hid, local.id);
      } else {
        await cloud.createLink(cu.uid, { householdId: hid, userId: local.id, role: local.role, joinedWith: normCode(db.households[hid].household.joinCode) });
      }
      setSessionId(local.id); session.set(local.id).catch(() => {});
      startSync({ householdId: hid, role: local.role, userId: local.id });
      return { ok: true, migrated: true };
    } catch (e) {
      if ((e?.code || '').includes('permission-denied') && local.role !== 'creator') {
        await cloud.signOutCloud().catch(() => {});
        return { ok: false, error: 'Ask your household Creator to install the new version and sign in first, then try again.' };
      }
      return { ok: false, error: cloud.friendlyError(e) };
    }
  }

  const registerCreatorCloud = async (f) => {
    try {
      const cu = await cloud.signUpPhone(f.phone.trim(), f.password);
      const userId = cu.uid; const hid = uid('hh'); const now = Date.now();
      const d = clone2(db);
      const code = await uniqueCode(d);
      const user = { id: userId, householdId: hid, name: f.name.trim(), email: (f.email || '').trim().toLowerCase(), phone: f.phone.trim(), passwordSalt: null, passwordHash: null, role: 'creator', status: 'active', color: '#1F5C46', relation: 'Homemaker', createdAt: now, joinedAt: now };
      d.users.push(user);
      d.households[hid] = emptyHousehold(hid, f.householdName.trim());
      d.households[hid].household.joinCode = code;
      d.households[hid].prefs[userId] = { schedule: true, grocery: true, purchase: true, reminders: true, sound: true, reminderHour: 18 };
      d.households[hid].audit.unshift({ id: uid('a'), actor: userId, action: 'household.created', entity: 'household', entityId: hid, details: f.householdName.trim(), at: now });
      setDb(d);
      await cloud.createLink(cu.uid, { householdId: hid, userId, role: 'creator' });
      await bootstrapHousehold(d, hid, userId);
      setSessionId(userId); session.set(userId).catch(() => {});
      startSync({ householdId: hid, role: 'creator', userId });
      return { ok: true, user };
    } catch (e) { return { ok: false, error: cloud.friendlyError(e) }; }
  };

  /** Look up a household / invite code online (for the registration screen). */
  const lookupCode = async (raw) => {
    const code = normCode(raw);
    if (code.length < 6) return null;
    if (!CLOUD) return findInvite(code);
    try {
      const jc = await cloud.getJoinCode(code);
      if (!jc) return null;
      return {
        kind: jc.type, householdId: jc.householdId,
        household: { name: jc.householdName }, creator: { name: jc.creatorName, color: '#1F5C46' },
        user: jc.type === 'personal' ? { id: jc.memberUserId, name: jc.memberName, relation: jc.relation, phone: '' } : null,
      };
    } catch (e) { return { error: cloud.friendlyError(e) }; }
  };

  const registerViewerCloud = async (f) => {
    const code = normCode(f.code);
    try {
      const jc = await cloud.getJoinCode(code);
      if (!jc) return { ok: false, error: 'That code is not valid. Check it with the household Creator.' };
      const cu = await cloud.signUpPhone(f.phone.trim(), f.password);
      const userId = jc.type === 'personal' ? jc.memberUserId : cu.uid;
      const hid = jc.householdId; const now = Date.now();
      const name = f.name.trim(); const relation = jc.type === 'personal' ? (jc.relation || 'Family') : (f.relation || 'Family');
      await cloud.createLink(cu.uid, { householdId: hid, userId, role: 'viewer', joinedWith: code });
      await cloud.setRow(hid, 'household_members', { id: `m_${userId}`, household_id: hid, user_id: userId, role: 'viewer', relation, membership_status: 'active', invite_code: null, joined_at: now });
      await cloud.setRow(hid, 'users', { id: userId, name, email: (f.email || '').trim().toLowerCase() || null, phone: f.phone.trim(), password_hash: null, password_salt: null, avatar_color: COLORS[Math.floor(Math.random() * COLORS.length)], account_status: 'active', created_at: now });
      await cloud.setRow(hid, 'user_preferences', { id: userId, user_id: userId, household_id: hid, schedule_alerts: true, grocery_alerts: true, purchase_alerts: true, reminders: true, sound_enabled: true, reminder_hour: 18 });
      await cloud.setRow(hid, 'notifications', { id: uid('n'), household_id: hid, target_role: 'creator', type: 'member', title: `${name.split(' ')[0]} joined ${jc.householdName || 'the household'}`, message: `Joined as a Viewer (${relation})${jc.type === 'household' ? ' using the household code' : ''}`, schedule_id: null, from_user_id: userId, meta: null, created_at: now });
      await cloud.setRow(hid, 'audit_log', { id: uid('a'), household_id: hid, actor_id: userId, action: 'member.joined', entity: 'household_member', entity_id: `m_${userId}`, details: name, created_at: now });
      if (jc.type === 'personal') await cloud.deleteJoinCode(code);
      setSessionId(userId); session.set(userId).catch(() => {});
      startSync({ householdId: hid, role: 'viewer', userId });
      return { ok: true };
    } catch (e) { return { ok: false, error: cloud.friendlyError(e) }; }
  };

  const logoutCloud = async () => {
    stopSync();
    await cloud.signOutCloud().catch(() => {});
    setSessionId(null); session.clear().catch(() => {});
    setCloudState('signed-out');
  };

  const login = CLOUD ? loginCloud : loginLocal;
  const logout = CLOUD ? logoutCloud : logoutLocal;
  const registerCreator = CLOUD ? registerCreatorCloud : registerCreatorLocal;
  const registerViewer = CLOUD ? registerViewerCloud : registerViewerLocal;

  // ---- schedules ----
  const findOverlap = (startDate, ignoreId) =>
    data.schedules.find((s) => s.id !== ignoreId && Math.abs(diffDays(s.startDate, startDate)) < 7);

  const createWeek = (startDate, copyFromId) => {
    const g = guardCreator(); if (g) return g;
    const clash = findOverlap(startDate);
    if (clash) return { ok: false, error: `Overlaps with the week of ${fmtRange(clash.startDate)} (BR-012).` };
    const id = uid('s');
    mutate((d) => {
      const days = newEmptyDays(startDate);
      if (copyFromId) {
        const src = d.schedules.find((s) => s.id === copyFromId);
        const srcDates = weekDates(src.startDate);
        weekDates(startDate).forEach((date, i) => {
          const sd = src.days[srcDates[i]];
          ['breakfast', 'lunch', 'dinner'].forEach((m) => {
            days[date][m] = (sd?.[m] || []).map((it) => ({ ...it, id: uid('mi') }));
          });
        });
      }
      audit(d, copyFromId ? 'schedule.copied' : 'schedule.created', 'weekly_schedule', id, fmtRange(startDate));
      d.schedules.push({ id, startDate, status: 'draft', createdBy: me.id, publishedAt: null, updatedAt: Date.now(), editedAfterPublish: false, days });
      d.schedules.sort((a, b) => a.startDate.localeCompare(b.startDate));
    });
    return { ok: true, id };
  };

  const touchSchedule = (d, s, what) => {
    s.updatedAt = Date.now();
    if (s.status === 'published') {
      s.editedAfterPublish = true;
      const recent = d.notifications.find((n) => n.scheduleId === s.id && n.type === 'schedule-update' && Date.now() - n.at < 10 * 60000);
      if (recent) { recent.at = Date.now(); recent.body = what; recent.readBy = []; }
      else notify(d, { to: 'viewer', type: 'schedule-update', scheduleId: s.id, from: me.id, title: `Menu for ${fmtRange(s.startDate)} was updated`, body: what });
    }
  };

  const saveMealItem = (scheduleId, date, meal, item) => {
    const g = guardCreator(); if (g) return g;
    if (!item.name?.trim()) return { ok: false, error: 'Dish name is required.' };
    mutate((d) => {
      const s = d.schedules.find((x) => x.id === scheduleId);
      const list = s.days[date][meal];
      const i = list.findIndex((x) => x.id === item.id);
      const clean = { ...item, name: item.name.trim(), side: (item.side || '').trim() };
      if (i >= 0) list[i] = clean; else list.push({ ...clean, id: uid('mi') });
      audit(d, i >= 0 ? 'meal_item.updated' : 'meal_item.added', 'meal_item', clean.id || null, `${dowLong(date)} ${meal}: ${clean.name}`);
      touchSchedule(d, s, `${dowLong(date)} ${meal}: ${clean.name}`);
      // remember custom dishes for quick-pick
      const known = [...DISH_LIBRARY, ...d.customDishes].some((x) => norm(x.name) === norm(clean.name) && norm(x.side || '') === norm(clean.side || ''));
      if (!known) d.customDishes.unshift({ id: uid('dish'), createdAt: Date.now(), name: clean.name, side: clean.side, meal, ingredients: [] });
    });
    return { ok: true };
  };

  const removeMealItem = (scheduleId, date, meal, itemId) => {
    const g = guardCreator(); if (g) return g;
    let removed = null;
    mutate((d) => {
      const s = d.schedules.find((x) => x.id === scheduleId);
      const list = s.days[date][meal];
      const i = list.findIndex((x) => x.id === itemId);
      if (i >= 0) { removed = { item: list[i], index: i }; list.splice(i, 1); audit(d, 'meal_item.removed', 'meal_item', itemId, `${dowLong(date)} ${meal}: ${removed.item.name}`); }
      touchSchedule(d, s, `${dowLong(date)} ${meal}: dish removed`);
    });
    return {
      ok: true,
      undo: () => mutate((d) => {
        const s = d.schedules.find((x) => x.id === scheduleId);
        if (removed) s.days[date][meal].splice(removed.index, 0, removed.item);
      }),
    };
  };

  const copyMeal = (scheduleId, fromDate, meal, toDates) => {
    const g = guardCreator(); if (g) return g;
    mutate((d) => {
      const s = d.schedules.find((x) => x.id === scheduleId);
      const src = s.days[fromDate][meal];
      toDates.forEach((td) => { s.days[td][meal] = src.map((it) => ({ ...it, id: uid('mi') })); });
      touchSchedule(d, s, `${meal} copied to ${toDates.length} day(s)`);
    });
    return { ok: true };
  };

  const publishSchedule = (scheduleId) => {
    const g = guardCreator(); if (g) return g;
    const s = data.schedules.find((x) => x.id === scheduleId);
    if (countPlanned(s) === 0) return { ok: false, error: 'Add at least one meal before publishing.' };
    mutate((d) => {
      const x = d.schedules.find((y) => y.id === scheduleId);
      x.status = 'published';
      x.publishedAt = Date.now();
      x.updatedAt = Date.now();
      x.editedAfterPublish = false;
      audit(d, 'schedule.published', 'weekly_schedule', x.id, fmtRange(x.startDate));
      notify(d, { to: 'viewer', type: 'schedule', scheduleId, from: me.id, title: 'New weekly menu published', body: `Meals for ${fmtRange(x.startDate)} are ready to view` });
    });
    return { ok: true };
  };

  const unpublishSchedule = (scheduleId) => {
    const g = guardCreator(); if (g) return g;
    mutate((d) => { const x = d.schedules.find((y) => y.id === scheduleId); x.status = 'draft'; });
    return { ok: true };
  };

  const deleteSchedule = (scheduleId) => {
    const g = guardCreator(); if (g) return g;
    mutate((d) => { audit(d, 'schedule.deleted', 'weekly_schedule', scheduleId, ''); d.schedules = d.schedules.filter((x) => x.id !== scheduleId); });
    return { ok: true };
  };

  // ---- grocery ----
  const logHistory = (d, entry) => d.history.unshift({ id: uid('h'), at: Date.now(), by: me.id, ...entry });

  const findSimilarItem = (name, ignoreId) =>
    data.groceries.find((x) => x.id !== ignoreId && ['pending', 'partial'].includes(x.status) && isSimilar(x.name, name));

  const saveGroceryItem = (item) => {
    const g = guardCreator(); if (g) return g;
    if (!item.name?.trim()) return { ok: false, error: 'Item name is required.' };
    const q = Number(item.qty);
    if (!q || q <= 0) return { ok: false, error: 'Enter a quantity greater than 0.' };
    mutate((d) => {
      if (item.id) {
        const x = d.groceries.find((y) => y.id === item.id);
        Object.assign(x, { ...item, qty: q, name: item.name.trim(), updatedAt: Date.now(), updatedBy: me.id, version: x.version + 1 });
        logHistory(d, { itemId: x.id, itemName: x.name, action: 'edited' });
        audit(d, 'grocery_item.updated', 'grocery_item', x.id, x.name);
      } else {
        const id = uid('g');
        d.groceries.unshift({
          id, name: item.name.trim(), category: item.category || 'other', qty: q, unit: item.unit || 'nos',
          priority: item.priority || 'normal', requiredBy: item.requiredBy || null, remarks: item.remarks || '',
          status: 'pending', purchasedQty: 0, createdBy: me.id, createdAt: Date.now(), updatedAt: Date.now(),
          updatedBy: me.id, purchasedBy: null, purchasedAt: null, version: 1,
        });
        logHistory(d, { itemId: id, itemName: item.name.trim(), action: 'created' });
        audit(d, 'grocery_item.created', 'grocery_item', id, `${item.name.trim()} · ${q} ${item.unit}`);
        const recent = d.notifications.find((n) => n.type === 'grocery' && n.batch && Date.now() - n.at < 5 * 60000);
        if (recent) {
          recent.count += 1; recent.names = [...recent.names, item.name.trim()].slice(-4);
          recent.title = `${recent.count} items added to the list`; recent.body = recent.names.join(', '); recent.at = Date.now(); recent.readBy = [];
        } else {
          notify(d, { to: 'viewer', type: 'grocery', batch: true, count: 1, names: [item.name.trim()], from: me.id,
            title: item.priority === 'urgent' ? `Urgent: ${item.name.trim()} needed` : `${item.name.trim()} added to the list`,
            body: `${q} ${item.unit}${item.remarks ? ' · ' + item.remarks : ''}` });
        }
      }
    });
    return { ok: true };
  };

  // Value-add: push a dish's ingredients into the list, merging with
  // pending items of the same name/unit instead of duplicating.
  const addIngredients = (ingredients) => {
    const g = guardCreator(); if (g) return g;
    let added = 0; let merged = 0;
    mutate((d) => {
      ingredients.forEach((ing) => {
        const ex = d.groceries.find((x) => ['pending', 'partial'].includes(x.status) && isSimilar(x.name, ing.name));
        if (ex) {
          if (ex.unit === ing.unit) { ex.qty = Number(ex.qty) + Number(ing.qty); ex.version += 1; ex.updatedAt = Date.now(); }
          merged++;
          return;
        }
        const id = uid('g');
        d.groceries.unshift({ id, name: ing.name, category: ing.category || 'other', qty: ing.qty, unit: ing.unit, priority: 'normal', requiredBy: null,
          remarks: '', status: 'pending', purchasedQty: 0, createdBy: me.id, createdAt: Date.now(), updatedAt: Date.now(), updatedBy: me.id,
          purchasedBy: null, purchasedAt: null, version: 1 });
        logHistory(d, { itemId: id, itemName: ing.name, action: 'created' });
        added++;
      });
      if (added) notify(d, { to: 'viewer', type: 'grocery', from: me.id, title: `${added} items added from the menu`, body: ingredients.slice(0, 4).map((i) => i.name).join(', ') });
    });
    return { ok: true, added, merged };
  };

  const setGroceryStatus = (itemId, to, { qty, version } = {}) => {
    const cur = data.groceries.find((x) => x.id === itemId);
    if (!cur) return { ok: false, error: 'Item no longer exists.' };
    if (version != null && cur.version !== version) {
      return { ok: false, conflict: true, error: `${userName(cur.updatedBy)} updated this item a moment ago. Showing the latest status.` };
    }
    if (to === 'cancelled' && !isCreator) return { ok: false, error: 'Only the Creator can cancel items.' };
    const before = clone(cur);
    let histId = null; let notifId = null;
    mutate((d) => {
      const x = d.groceries.find((y) => y.id === itemId);
      const from = x.status;
      x.status = to;
      if (to === 'purchased') { x.purchasedQty = x.qty; x.purchasedBy = me.id; x.purchasedAt = Date.now(); }
      if (to === 'partial') { x.purchasedQty = Math.min(Number(qty) || 0, x.qty); x.purchasedBy = me.id; x.purchasedAt = Date.now(); if (x.purchasedQty >= x.qty) x.status = 'purchased'; }
      if (to === 'pending') { x.purchasedQty = 0; x.purchasedBy = null; x.purchasedAt = null; }
      x.updatedAt = Date.now(); x.updatedBy = me.id; x.version += 1;
      audit(d, `grocery_item.${x.status}`, 'grocery_item', itemId, x.name);
      histId = uid('h');
      d.history.unshift({ id: histId, at: Date.now(), by: me.id, itemId, itemName: x.name, action: from === 'purchased' && to === 'pending' ? 'reverted' : 'status', from, to: x.status, qty: x.purchasedQty, unit: x.unit });
      if (!isCreator && (x.status === 'purchased' || x.status === 'partial')) {
        notifId = uid('n');
        d.notifications.unshift({ id: notifId, at: Date.now(), readBy: [], to: 'creator', type: 'purchase', from: me.id,
          title: `${me.name.split(' ')[0]} ${x.status === 'partial' ? 'partly bought' : 'bought'} ${x.name}`,
          body: x.status === 'partial' ? `${x.purchasedQty} of ${x.qty} ${x.unit} bought · ${x.qty - x.purchasedQty} ${x.unit} remaining` : `${x.qty} ${x.unit} · marked purchased` });
      }
    });
    return {
      ok: true,
      undo: () => mutate((d) => {
        const i = d.groceries.findIndex((y) => y.id === itemId);
        if (i >= 0) d.groceries[i] = { ...before, version: d.groceries[i].version + 1 };
        d.history = d.history.filter((h) => h.id !== histId);
        if (notifId) d.notifications = d.notifications.filter((n) => n.id !== notifId);
      }),
    };
  };

  const deleteGroceryItem = (itemId) => {
    const g = guardCreator(); if (g) return g;
    let removed = null; let idx = -1;
    mutate((d) => {
      idx = d.groceries.findIndex((x) => x.id === itemId);
      if (idx >= 0) { removed = d.groceries[idx]; d.groceries.splice(idx, 1); logHistory(d, { itemId, itemName: removed.name, action: 'deleted' }); audit(d, 'grocery_item.deleted', 'grocery_item', itemId, removed.name); }
    });
    return { ok: true, undo: () => mutate((d) => { if (removed) d.groceries.splice(Math.max(0, idx), 0, removed); }) };
  };

  const clearPurchased = () => {
    const g = guardCreator(); if (g) return g;
    let n = 0;
    mutate((d) => {
      const keep = [];
      d.groceries.forEach((x) => { if (x.status === 'purchased' || x.status === 'cancelled') n++; else keep.push(x); });
      d.groceries = keep;
    });
    return { ok: true, count: n };
  };

  // ---- members ----
  const inviteMember = ({ name, phone, relation }) => {
    const g = guardCreator(); if (g) return g;
    if (!name?.trim() || !/^\d{10}$/.test((phone || '').trim())) return { ok: false, error: 'Enter a name and a 10-digit mobile number.' };
    if (data.users.some((u) => u.phone === phone.trim())) return { ok: false, error: 'This number is already in your household.' };
    const taken = accountTaken({ phone }); if (taken) return { ok: false, error: 'This mobile number already belongs to another HomeMeal account.' };
    const code = newJoinCode(db);
    const nu = uid('u');
    mutate((d) => {
      audit(d, 'member.invited', 'household_member', `m_${nu}`, name.trim());
      d.users.push({ id: nu, createdAt: Date.now(), name: name.trim(), phone: phone.trim(), email: '', passwordHash: null, passwordSalt: null, role: 'viewer', status: 'invited', relation: relation || 'Family', color: ['#2E7D5B', '#3F5BA9', '#C4513A', '#E19A2B', '#5B4B9A'][d.users.length % 5], inviteCode: code });
    });
    if (CLOUD) {
      const h = data.household;
      cloud.setJoinCode(normCode(code), { householdId: me.householdId, type: 'personal', memberUserId: nu, memberName: name.trim(), relation: relation || 'Family', householdName: h.name, creatorName: me.name })
        .catch((e) => console.warn('invite code', e));
    }
    return { ok: true, code };
  };
  const regenerateJoinCode = () => {
    const g = guardCreator(); if (g) return g;
    let code = null;
    mutateDb((d) => {
      const h = d.households[me.householdId];
      const old = h.household.joinCode;
      code = newJoinCode(d);
      h.household.joinCode = code;
      if (CLOUD) {
        cloud.deleteJoinCode(normCode(old))
          .then(() => cloud.setJoinCode(code, { householdId: me.householdId, type: 'household', householdName: h.household.name, creatorName: me.name }))
          .catch((e) => console.warn('household code', e));
      }
      h.audit.unshift({ id: uid('a'), actor: me.id, action: 'household.code_changed', entity: 'household', entityId: me.householdId, details: 'New household code', at: Date.now() });
    });
    return { ok: true };
  };
  const setMemberStatus = (userId, status) => {
    const g = guardCreator(); if (g) return g;
    mutate((d) => { const u = d.users.find((x) => x.id === userId); if (u && u.role !== 'creator') { u.status = status; audit(d, status === 'active' ? 'member.reactivated' : 'member.deactivated', 'household_member', `m_${u.id}`, u.name); } });
    return { ok: true };
  };
  const activateInvite = (userId) => {
    mutate((d) => { const u = d.users.find((x) => x.id === userId); if (u) { u.status = 'active'; u.passwordSalt = newSalt(); u.passwordHash = hashPassword('demo123', u.passwordSalt); u.inviteCode = null; u.joinedAt = Date.now(); audit(d, 'member.joined', 'household_member', `m_${u.id}`, u.name); } });
    return { ok: true };
  };

  // ---- notifications ----
  const myNotifications = useMemo(() => {
    if (!data || !me) return [];
    const p = data.prefs[me.id] || { schedule: true, grocery: true, purchase: true };
    return data.notifications.filter((n) => {
      if (n.from === me.id) return false;
      if (n.to !== 'all' && n.to !== me.role) return false;
      if ((n.type === 'schedule' || n.type === 'schedule-update') && p.schedule === false) return false;
      if (n.type === 'grocery' && p.grocery === false) return false;
      if (n.type === 'purchase' && p.purchase === false) return false;
      return true;
    });
  }, [data, me]);
  const unreadCount = myNotifications.filter((n) => !n.readBy.includes(me?.id)).length;
  const markAllRead = () => mutate((d) => { d.notifications.forEach((n) => { if (!n.readBy.includes(me.id)) n.readBy.push(me.id); }); });
  const setPref = (key, val) => mutate((d) => { d.prefs[me.id] = { ...(d.prefs[me.id] || {}), [key]: val }; });

  // ---- derived ----
  const visibleSchedules = useMemo(() => {
    if (!data || !data.schedules) return [];
    const list = isCreator ? data.schedules : data.schedules.filter((s) => s.status === 'published');
    return [...list].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [data, isCreator]);

  const scheduleFor = (dateISO) => visibleSchedules.find((s) => { const dd = diffDays(dateISO, s.startDate); return dd >= 0 && dd < 7; });

  const value = {
    ready, data, me, isCreator, t, db, dbInfo,
    login, logout, setLang, resetDemo, findInvite, lookupCode, registerCreator, registerViewer, accountTaken, cloudState, sessionId, online: CLOUD,
    visibleSchedules, scheduleFor, findOverlap, createWeek, saveMealItem, removeMealItem, copyMeal, publishSchedule, unpublishSchedule, deleteSchedule,
    findSimilarItem, saveGroceryItem, addIngredients, setGroceryStatus, deleteGroceryItem, clearPurchased,
    inviteMember, setMemberStatus, activateInvite, regenerateJoinCode,
    myNotifications, unreadCount, markAllRead, setPref,
    userById: (id) => data?.users.find((u) => u.id === id),
    dishLibrary: data?.customDishes ? [...data.customDishes, ...DISH_LIBRARY] : DISH_LIBRARY,
    thisMonday: mondayOf(todayISO()),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
