// HomeMeal online service (Firebase): accounts, household codes and live sync.
// Data layout (see firebase/firestore.rules):
//   userHouseholds/{authUid}           which household + app user an account belongs to
//   joinCodes/{CODE}                   household code or one-person invite code
//   households/{hid}                   household info
//   households/{hid}/{table}/{rowId}   every other row, one document per row
import { initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, initializeFirestore, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';
import { makeAuth } from './cloudAuth';
import { TABLES } from './db/schema';

let app = null; let auth = null; let fs = null;
function ensure() {
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = makeAuth(app);
    fs = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  }
}

// Rows that live in households/{hid}/{table}
export const CLOUD_TABLES = TABLES.map((t) => t.name).filter((n) => !['app_settings', 'grocery_categories', 'households'].includes(n));
const VIEWER_TABLES = new Set(['grocery_items', 'purchase_history', 'notifications', 'notification_reads', 'audit_log', 'user_preferences']);

// Accounts are identified by mobile number (Firebase needs an email-style ID).
export const phoneEmail = (phone) => `${String(phone).replace(/\D/g, '')}@phone.homemeal.app`;

export function friendlyError(e) {
  const c = e?.code || '';
  if (c.includes('network') || c.includes('unavailable')) return 'No internet connection. Check your connection and try again.';
  if (c.includes('email-already-in-use')) return 'This mobile number is already registered. Please sign in instead.';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') || c.includes('invalid-login')) return 'Mobile number and password don’t match.';
  if (c.includes('too-many-requests')) return 'Too many attempts. Please wait a few minutes and try again.';
  if (c.includes('weak-password')) return 'Use a password with at least 6 characters.';
  if (c.includes('permission-denied')) return 'You don’t have permission to do that.';
  return e?.message || 'Something went wrong. Please try again.';
}

export function onAuth(cb) { ensure(); return onAuthStateChanged(auth, cb); }
export async function signInPhone(phone, password) { ensure(); return (await signInWithEmailAndPassword(auth, phoneEmail(phone), password)).user; }
export async function signUpPhone(phone, password) { ensure(); return (await createUserWithEmailAndPassword(auth, phoneEmail(phone), password)).user; }
export async function signOutCloud() { ensure(); await signOut(auth); }
export function currentAuthUid() { ensure(); return auth.currentUser?.uid || null; }

export async function getLink(authUid) { ensure(); const s = await getDoc(doc(fs, 'userHouseholds', authUid)); return s.exists() ? s.data() : null; }
export async function createLink(authUid, data) { ensure(); await setDoc(doc(fs, 'userHouseholds', authUid), { ...data, createdAt: Date.now() }); }
export async function getJoinCode(code) { ensure(); const s = await getDoc(doc(fs, 'joinCodes', code)); return s.exists() ? s.data() : null; }
export async function setJoinCode(code, data) { ensure(); await setDoc(doc(fs, 'joinCodes', code), { ...data, createdAt: Date.now() }); }
export async function deleteJoinCode(code) { ensure(); try { await deleteDoc(doc(fs, 'joinCodes', code)); } catch (e) {} }

const clean = (row) => JSON.parse(JSON.stringify(row, (k, v) => (v === undefined ? null : v)));
export async function setHouseholdDoc(hid, row) { ensure(); await setDoc(doc(fs, 'households', hid), clean(row)); }
export async function setRow(hid, table, row, merge = false) { ensure(); await setDoc(doc(fs, 'households', hid, table, row.id), clean(row), merge ? { merge: true } : undefined); }

/** Write row-level changes (from diffTables) for one household. */
export async function pushChanges(hid, changes, { role, userId }) {
  ensure();
  const ops = [];
  changes.forEach((ch) => {
    if (ch.table === 'app_settings' || ch.table === 'grocery_categories') return;
    const viewerOk = (row) => VIEWER_TABLES.has(ch.table)
      || (ch.table === 'users' && row?.id === userId)
      || (ch.table === 'household_members' && row?.id === `m_${userId}`);
    if (ch.table === 'households') {
      if (role === 'creator') ch.upserts.forEach((r) => ops.push(['set', doc(fs, 'households', hid), r]));
      return;
    }
    ch.upserts.forEach((r) => { if (role === 'creator' || viewerOk(r)) ops.push(['set', doc(fs, 'households', hid, ch.table, r.id), r]); });
    ch.deletes.forEach((id) => { if (role === 'creator' || VIEWER_TABLES.has(ch.table)) ops.push(['del', doc(fs, 'households', hid, ch.table, id)]); });
  });
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(fs);
    ops.slice(i, i + 400).forEach(([kind, ref, row]) => (kind === 'set' ? b.set(ref, clean(row)) : b.delete(ref)));
    await b.commit();
  }
  return ops.length;
}

/** Live listener for a whole household. Calls onData(tables) once everything has loaded, then on every change. */
export function subscribeHousehold(hid, onData, onError) {
  ensure();
  const state = {}; const loaded = new Set(); let hhRow = null; let timer = null;
  const total = CLOUD_TABLES.length + 1;
  const emit = () => {
    if (loaded.size < total) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const T = { households: hhRow ? [hhRow] : [] };
      CLOUD_TABLES.forEach((t) => { T[t] = Object.values(state[t] || {}); });
      onData(T);
    }, 40);
  };
  const unsubs = [
    onSnapshot(doc(fs, 'households', hid), (s) => { hhRow = s.exists() ? { ...s.data(), id: hid } : null; loaded.add('households'); emit(); }, onError),
    ...CLOUD_TABLES.map((t) => onSnapshot(collection(fs, 'households', hid, t), (qs) => {
      const m = {}; qs.forEach((d) => { m[d.id] = { ...d.data(), id: d.id }; });
      state[t] = m; loaded.add(t); emit();
    }, onError)),
  ];
  return () => { clearTimeout(timer); unsubs.forEach((u) => u()); };
}
