// Converts the app's in-memory model <-> normalized table rows.
import { TABLES } from './schema';
import { CATEGORIES } from '../theme';
import { addDays, weekDates } from '../dates';

const MEALS = ['breakfast', 'lunch', 'dinner'];
const s = (v) => (v == null ? '' : v);
const n = (v) => (v === undefined ? null : v);
const CAT_NAMES = {
  vegetables: 'Vegetables', fruits: 'Fruits', grains: 'Rice & Grains', pulses: 'Pulses & Lentils', spices: 'Spices', dairy: 'Dairy',
  meat: 'Meat', fish: 'Fish & Seafood', bakery: 'Bakery', household: 'Household Essentials', other: 'Other',
};

export function toTables(db) {
  const T = Object.fromEntries(TABLES.map((tb) => [tb.name, []]));
  T.app_settings.push({ id: 'lang', value: db.lang || 'en' }, { id: 'schema_version', value: String(db.seedVersion) });
  CATEGORIES.forEach((c) => T.grocery_categories.push({ id: c.key, household_id: null, name: CAT_NAMES[c.key], icon: c.icon, is_system: true, active: true }));

  db.users.forEach((u) => {
    T.users.push({
      id: u.id, name: u.name, email: u.email || null, phone: u.phone || null, password_hash: n(u.passwordHash), password_salt: n(u.passwordSalt),
      avatar_color: u.color, account_status: u.status === 'invited' ? 'pending' : 'active', created_at: n(u.createdAt),
    });
    T.household_members.push({
      id: `m_${u.id}`, household_id: u.householdId, user_id: u.id, role: u.role, relation: n(u.relation),
      membership_status: u.status, invite_code: n(u.inviteCode), joined_at: n(u.joinedAt),
    });
  });

  Object.entries(db.households).forEach(([hid, h]) => {
    T.households.push({ id: hid, name: h.household.name, timezone: h.household.timezone || 'Asia/Kolkata', status: 'active', created_at: n(h.household.createdAt), join_code: n(h.household.joinCode) });

    Object.entries(h.prefs || {}).forEach(([uid, p]) => T.user_preferences.push({
      id: uid, user_id: uid, household_id: hid, schedule_alerts: p.schedule !== false, grocery_alerts: p.grocery !== false,
      purchase_alerts: p.purchase !== false, reminders: p.reminders !== false, sound_enabled: p.sound !== false, reminder_hour: p.reminderHour ?? 18,
    }));

    h.schedules.forEach((sc) => {
      T.weekly_schedules.push({
        id: sc.id, household_id: hid, start_date: sc.startDate, end_date: addDays(sc.startDate, 6), status: sc.status,
        created_by: n(sc.createdBy), published_at: n(sc.publishedAt), updated_at: n(sc.updatedAt), edited_after_publish: !!sc.editedAfterPublish,
      });
      weekDates(sc.startDate).forEach((date) => MEALS.forEach((meal) => {
        const dmId = `${sc.id}|${date}|${meal}`;
        T.daily_meals.push({ id: dmId, schedule_id: sc.id, meal_date: date, meal_type: meal });
        (sc.days[date]?.[meal] || []).forEach((it, i) => T.meal_items.push({
          id: it.id, daily_meal_id: dmId, dish_name: it.name, side_dish: s(it.side), description: s(it.description),
          prep_notes: s(it.notes), special_instructions: s(it.special), display_order: i,
        }));
      }));
    });

    h.groceries.forEach((g) => T.grocery_items.push({
      id: g.id, household_id: hid, item_name: g.name, category_id: g.category, quantity: Number(g.qty), unit: g.unit, priority: g.priority,
      required_by: n(g.requiredBy), remarks: s(g.remarks), status: g.status, purchased_qty: Number(g.purchasedQty || 0),
      created_by: n(g.createdBy), created_at: n(g.createdAt), updated_by: n(g.updatedBy), updated_at: n(g.updatedAt),
      purchased_by: n(g.purchasedBy), purchased_at: n(g.purchasedAt), version: g.version || 1,
    }));

    h.history.forEach((x) => T.purchase_history.push({
      id: x.id, household_id: hid, grocery_item_id: x.itemId, item_name: x.itemName, action: x.action, old_status: n(x.from),
      new_status: n(x.to), purchased_qty: n(x.qty), unit: n(x.unit), updated_by: x.by, created_at: x.at,
    }));

    h.notifications.forEach((x) => {
      T.notifications.push({
        id: x.id, household_id: hid, target_role: x.to, type: x.type, title: x.title, message: s(x.body), schedule_id: n(x.scheduleId),
        from_user_id: n(x.from), meta: x.batch ? { batch: true, count: x.count, names: x.names } : null, created_at: x.at,
      });
      (x.readBy || []).forEach((uid) => T.notification_reads.push({ id: `${x.id}|${uid}`, notification_id: x.id, user_id: uid }));
    });

    (h.customDishes || []).forEach((d) => {
      T.dishes.push({ id: d.id, household_id: hid, name: d.name, side_dish: s(d.side), meal_type: d.meal, created_at: n(d.createdAt) });
      (d.ingredients || []).forEach((ing, i) => T.dish_ingredients.push({
        id: `${d.id}|${i}`, dish_id: d.id, name: ing.name, quantity: ing.qty, unit: ing.unit, category_id: ing.category,
      }));
    });

    (h.audit || []).forEach((a) => T.audit_log.push({
      id: a.id, household_id: hid, actor_id: n(a.actor), action: a.action, entity: a.entity, entity_id: n(a.entityId), details: s(a.details), created_at: a.at,
    }));
  });
  return T;
}

const byDesc = (k) => (a, b) => (b[k] || 0) - (a[k] || 0);

export function fromTables(T) {
  const setting = (k) => T.app_settings.find((x) => x.id === k)?.value;
  const db = { seedVersion: Number(setting('schema_version')) || 0, lang: setting('lang') || 'en', users: [], households: {} };

  T.households.forEach((h) => {
    db.households[h.id] = {
      household: { id: h.id, name: h.name, timezone: h.timezone, createdAt: h.created_at, joinCode: h.join_code || null },
      schedules: [], groceries: [], history: [], notifications: [], customCategories: [], customDishes: [], prefs: {}, audit: [],
    };
  });

  const members = Object.fromEntries(T.household_members.map((m) => [m.user_id, m]));
  T.users.forEach((u) => {
    const m = members[u.id] || {};
    db.users.push({
      id: u.id, householdId: m.household_id, name: u.name, email: u.email || '', phone: u.phone || '', passwordHash: u.password_hash, passwordSalt: u.password_salt,
      role: m.role, status: m.membership_status, color: u.avatar_color, relation: m.relation, inviteCode: m.invite_code, joinedAt: m.joined_at, createdAt: u.created_at,
    });
  });

  T.user_preferences.forEach((p) => {
    const h = db.households[p.household_id]; if (!h) return;
    h.prefs[p.user_id] = { schedule: !!p.schedule_alerts, grocery: !!p.grocery_alerts, purchase: !!p.purchase_alerts, reminders: !!p.reminders,
      sound: p.sound_enabled !== false, reminderHour: p.reminder_hour == null ? 18 : Number(p.reminder_hour) };
  });

  const itemsByMeal = {};
  T.meal_items.forEach((it) => { (itemsByMeal[it.daily_meal_id] = itemsByMeal[it.daily_meal_id] || []).push(it); });
  const mealsBySchedule = {};
  T.daily_meals.forEach((dm) => { (mealsBySchedule[dm.schedule_id] = mealsBySchedule[dm.schedule_id] || []).push(dm); });

  T.weekly_schedules.forEach((sc) => {
    const h = db.households[sc.household_id]; if (!h) return;
    const days = {};
    weekDates(sc.start_date).forEach((d) => { days[d] = { breakfast: [], lunch: [], dinner: [] }; });
    (mealsBySchedule[sc.id] || []).forEach((dm) => {
      if (!days[dm.meal_date]) return;
      days[dm.meal_date][dm.meal_type] = (itemsByMeal[dm.id] || []).sort((a, b) => a.display_order - b.display_order).map((it) => ({
        id: it.id, name: it.dish_name, side: s(it.side_dish), description: s(it.description), notes: s(it.prep_notes), special: s(it.special_instructions),
      }));
    });
    h.schedules.push({
      id: sc.id, startDate: sc.start_date, status: sc.status, createdBy: sc.created_by, publishedAt: sc.published_at,
      updatedAt: sc.updated_at, editedAfterPublish: !!sc.edited_after_publish, days,
    });
  });

  T.grocery_items.forEach((g) => {
    const h = db.households[g.household_id]; if (!h) return;
    h.groceries.push({
      id: g.id, name: g.item_name, category: g.category_id, qty: Number(g.quantity), unit: g.unit, priority: g.priority, requiredBy: g.required_by,
      remarks: s(g.remarks), status: g.status, purchasedQty: Number(g.purchased_qty || 0), createdBy: g.created_by, createdAt: g.created_at,
      updatedAt: g.updated_at, updatedBy: g.updated_by, purchasedBy: g.purchased_by, purchasedAt: g.purchased_at, version: g.version,
    });
  });

  T.purchase_history.forEach((x) => {
    const h = db.households[x.household_id]; if (!h) return;
    const e = { id: x.id, itemId: x.grocery_item_id, itemName: x.item_name, action: x.action, by: x.updated_by, at: x.created_at };
    if (x.old_status != null) e.from = x.old_status;
    if (x.new_status != null) e.to = x.new_status;
    if (x.purchased_qty != null) e.qty = Number(x.purchased_qty);
    if (x.unit != null) e.unit = x.unit;
    h.history.push(e);
  });

  const reads = {};
  T.notification_reads.forEach((r) => { (reads[r.notification_id] = reads[r.notification_id] || []).push(r.user_id); });
  T.notifications.forEach((x) => {
    const h = db.households[x.household_id]; if (!h) return;
    const meta = typeof x.meta === 'string' ? JSON.parse(x.meta) : x.meta;
    const e = { id: x.id, to: x.target_role, type: x.type, title: x.title, body: s(x.message), at: x.created_at, readBy: reads[x.id] || [] };
    if (x.schedule_id) e.scheduleId = x.schedule_id;
    if (x.from_user_id) e.from = x.from_user_id;
    if (meta) Object.assign(e, meta);
    h.notifications.push(e);
  });

  const ingByDish = {};
  T.dish_ingredients.forEach((i) => { (ingByDish[i.dish_id] = ingByDish[i.dish_id] || []).push(i); });
  T.dishes.forEach((d) => {
    const h = db.households[d.household_id]; if (!h) return;
    h.customDishes.push({
      id: d.id, name: d.name, side: s(d.side_dish), meal: d.meal_type, createdAt: d.created_at,
      ingredients: (ingByDish[d.id] || []).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))
        .map((i) => ({ name: i.name, qty: Number(i.quantity), unit: i.unit, category: i.category_id })),
    });
  });

  T.audit_log.forEach((a) => {
    const h = db.households[a.household_id]; if (!h) return;
    h.audit.push({ id: a.id, actor: a.actor_id, action: a.action, entity: a.entity, entityId: a.entity_id, details: s(a.details), at: a.created_at });
  });

  Object.values(db.households).forEach((h) => {
    h.schedules.sort((a, b) => a.startDate.localeCompare(b.startDate));
    h.groceries.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0) || a.id.localeCompare(b.id, undefined, { numeric: true }));
    h.history.sort(byDesc('at'));
    h.notifications.sort(byDesc('at'));
    h.customDishes.sort(byDesc('createdAt'));
    h.audit.sort(byDesc('at'));
  });
  return db;
}

// Stable comparison: same values in schema column order, object keys sorted.
const canonVal = (v) => {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) return v.map(canonVal);
  if (typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => { o[k] = canonVal(v[k]); return o; }, {});
  return v;
};
export const canonRow = (tb, row) => JSON.stringify(tb.columns.map((c) => canonVal(row[c.name])));

// Row-level diff: only rows that changed are written (FR-042 sync friendliness).
export function diffTables(prev, next) {
  const changes = [];
  TABLES.forEach((tb) => {
    if (!(tb.name in next)) return;
    const a = new Map((prev?.[tb.name] || []).map((r) => [r.id, canonRow(tb, r)]));
    const b = new Map((next[tb.name] || []).map((r) => [r.id, r]));
    const upserts = []; const deletes = [];
    b.forEach((row, id) => { if (a.get(id) !== canonRow(tb, row)) upserts.push(row); });
    a.forEach((_, id) => { if (!b.has(id)) deletes.push(id); });
    if (upserts.length || deletes.length) changes.push({ table: tb.name, upserts, deletes });
  });
  return changes;
}

// ---- Cloud helpers: one household at a time ----
const LOCAL_ONLY = ['app_settings', 'grocery_categories'];

/** Rows of one household as stored online (no device settings, no password hashes). */
export function householdTables(db, hid) {
  if (!db.households[hid]) return null;
  const T = toTables({ ...db, users: db.users.filter((u) => u.householdId === hid), households: { [hid]: db.households[hid] } });
  LOCAL_ONLY.forEach((k) => delete T[k]);
  T.users = T.users.map((u) => ({ ...u, password_hash: null, password_salt: null }));
  return T;
}

/** Replace one household (and its users) in the local model with rows from the cloud. */
export function mergeHousehold(db, hid, remote) {
  const T = { app_settings: [{ id: 'lang', value: db.lang || 'en' }, { id: 'schema_version', value: String(db.seedVersion) }] };
  TABLES.forEach((tb) => { if (!T[tb.name]) T[tb.name] = remote[tb.name] || []; });
  const one = fromTables(T);
  if (!one.households[hid]) return db;
  const keepLocal = new Map(db.users.filter((u) => u.householdId === hid).map((u) => [u.id, u]));
  const users = one.users.map((u) => {
    const old = keepLocal.get(u.id);
    return old ? { ...u, passwordHash: old.passwordHash, passwordSalt: old.passwordSalt } : u;
  });
  return {
    ...db,
    users: [...db.users.filter((u) => u.householdId !== hid && !users.some((x) => x.id === u.id)), ...users],
    households: { ...db.households, [hid]: one.households[hid] },
  };
}

export const countRows = (T) => TABLES.reduce((acc, tb) => acc + (T[tb.name]?.length || 0), 0);
