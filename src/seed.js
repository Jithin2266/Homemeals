import { addDays, mondayOf, todayISO, weekDates } from './dates';
import { hashPassword, newSalt } from './db/crypto';
import { SCHEMA_VERSION } from './db/schema';

let n = 0;
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}_${(n++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Dish library — a value-add: picking a saved dish fills the form and
// can push its ingredients straight to the grocery list.
export const DISH_LIBRARY = [
  { name: 'Puttu', side: 'Kadala curry', meal: 'breakfast', ingredients: [
    { name: 'Puttu podi (rice flour)', qty: 1, unit: 'kg', category: 'grains' },
    { name: 'Black chickpeas (kadala)', qty: 500, unit: 'g', category: 'pulses' },
    { name: 'Coconut', qty: 2, unit: 'nos', category: 'vegetables' } ] },
  { name: 'Appam', side: 'Vegetable stew', meal: 'breakfast', ingredients: [
    { name: 'Raw rice', qty: 1, unit: 'kg', category: 'grains' },
    { name: 'Coconut milk', qty: 2, unit: 'packet', category: 'dairy' },
    { name: 'Potato', qty: 500, unit: 'g', category: 'vegetables' } ] },
  { name: 'Idli', side: 'Sambar', meal: 'breakfast', ingredients: [
    { name: 'Idli rice', qty: 1, unit: 'kg', category: 'grains' },
    { name: 'Urad dal', qty: 250, unit: 'g', category: 'pulses' },
    { name: 'Toor dal', qty: 500, unit: 'g', category: 'pulses' } ] },
  { name: 'Dosa', side: 'Coconut chutney', meal: 'breakfast', ingredients: [
    { name: 'Dosa batter', qty: 1, unit: 'packet', category: 'other' },
    { name: 'Coconut', qty: 1, unit: 'nos', category: 'vegetables' } ] },
  { name: 'Idiyappam', side: 'Egg curry', meal: 'breakfast', ingredients: [
    { name: 'Idiyappam podi', qty: 1, unit: 'kg', category: 'grains' },
    { name: 'Eggs', qty: 1, unit: 'dozen', category: 'dairy' } ] },
  { name: 'Upma', side: 'Banana', meal: 'breakfast', ingredients: [
    { name: 'Rava', qty: 500, unit: 'g', category: 'grains' },
    { name: 'Nendran banana', qty: 6, unit: 'nos', category: 'fruits' } ] },
  { name: 'Poori', side: 'Potato masala', meal: 'breakfast', ingredients: [
    { name: 'Atta', qty: 1, unit: 'kg', category: 'grains' },
    { name: 'Potato', qty: 1, unit: 'kg', category: 'vegetables' } ] },
  { name: 'Rice & Sambar', side: 'Cabbage thoran, Pappadam', meal: 'lunch', ingredients: [
    { name: 'Matta rice', qty: 5, unit: 'kg', category: 'grains' },
    { name: 'Toor dal', qty: 500, unit: 'g', category: 'pulses' },
    { name: 'Cabbage', qty: 1, unit: 'nos', category: 'vegetables' },
    { name: 'Pappadam', qty: 1, unit: 'packet', category: 'other' } ] },
  { name: 'Meen curry', side: 'Rice, Beans thoran', meal: 'lunch', ingredients: [
    { name: 'Fish (ayala / mackerel)', qty: 1, unit: 'kg', category: 'fish' },
    { name: 'Kudampuli', qty: 100, unit: 'g', category: 'spices' },
    { name: 'Beans', qty: 250, unit: 'g', category: 'vegetables' } ] },
  { name: 'Avial', side: 'Rice, Moru curry', meal: 'lunch', ingredients: [
    { name: 'Drumstick', qty: 4, unit: 'nos', category: 'vegetables' },
    { name: 'Raw banana', qty: 2, unit: 'nos', category: 'vegetables' },
    { name: 'Curd', qty: 500, unit: 'g', category: 'dairy' } ] },
  { name: 'Chicken curry', side: 'Rice, Salad', meal: 'lunch', ingredients: [
    { name: 'Chicken', qty: 1, unit: 'kg', category: 'meat' },
    { name: 'Onion', qty: 1, unit: 'kg', category: 'vegetables' },
    { name: 'Garam masala', qty: 1, unit: 'packet', category: 'spices' } ] },
  { name: 'Rasam rice', side: 'Pavakka fry', meal: 'lunch', ingredients: [
    { name: 'Tomato', qty: 500, unit: 'g', category: 'vegetables' },
    { name: 'Bitter gourd', qty: 250, unit: 'g', category: 'vegetables' } ] },
  { name: 'Chapati', side: 'Dal tadka', meal: 'dinner', ingredients: [
    { name: 'Atta', qty: 1, unit: 'kg', category: 'grains' },
    { name: 'Moong dal', qty: 500, unit: 'g', category: 'pulses' } ] },
  { name: 'Kanji', side: 'Cherupayar, Pickle', meal: 'dinner', ingredients: [
    { name: 'Kanji rice', qty: 2, unit: 'kg', category: 'grains' },
    { name: 'Green gram (cherupayar)', qty: 500, unit: 'g', category: 'pulses' } ] },
  { name: 'Chapati', side: 'Chicken curry', meal: 'dinner', ingredients: [
    { name: 'Atta', qty: 1, unit: 'kg', category: 'grains' },
    { name: 'Chicken', qty: 1, unit: 'kg', category: 'meat' } ] },
  { name: 'Vegetable fried rice', side: 'Gobi manchurian', meal: 'dinner', ingredients: [
    { name: 'Basmati rice', qty: 1, unit: 'kg', category: 'grains' },
    { name: 'Cauliflower', qty: 1, unit: 'nos', category: 'vegetables' },
    { name: 'Carrot', qty: 500, unit: 'g', category: 'vegetables' } ] },
  { name: 'Pathiri', side: 'Mutton stew', meal: 'dinner', ingredients: [
    { name: 'Rice flour', qty: 1, unit: 'kg', category: 'grains' },
    { name: 'Mutton', qty: 1, unit: 'kg', category: 'meat' } ] },
  { name: 'Dosa', side: 'Tomato chutney', meal: 'dinner', ingredients: [
    { name: 'Dosa batter', qty: 1, unit: 'packet', category: 'other' },
    { name: 'Tomato', qty: 500, unit: 'g', category: 'vegetables' } ] },
];

const dish = (name, side, extra = {}) => ({ id: uid('mi'), name, side, description: '', notes: '', special: '', ...extra });

const emptyDays = (start) => {
  const days = {};
  weekDates(start).forEach((d) => { days[d] = { breakfast: [], lunch: [], dinner: [] }; });
  return days;
};

const fillWeek = (start, plan) => {
  const days = emptyDays(start);
  weekDates(start).forEach((d, i) => {
    const p = plan[i];
    if (!p) return;
    ['breakfast', 'lunch', 'dinner'].forEach((m, j) => {
      if (p[j]) days[d][m] = p[j].map(([name, side, extra]) => dish(name, side, extra));
    });
  });
  return days;
};

export const newEmptyDays = emptyDays;

export function buildSeed() {
  const today = todayISO();
  const thisMon = mondayOf(today);
  const lastMon = addDays(thisMon, -7);
  const nextMon = addDays(thisMon, 7);
  const now = Date.now();
  const H = 3600000;

  const users = [
    { id: 'u1', name: 'Anitha Menon', email: 'anitha@homemeal.app', phone: '9847000001', password: 'demo123', role: 'creator', status: 'active', color: '#1F5C46', relation: 'Homemaker' },
    { id: 'u2', name: 'Rahul Menon', email: 'rahul@homemeal.app', phone: '9847000002', password: 'demo123', role: 'viewer', status: 'active', color: '#C4513A', relation: 'Husband' },
    { id: 'u3', name: 'Meera Menon', email: 'meera@homemeal.app', phone: '9847000003', password: 'demo123', role: 'viewer', status: 'active', color: '#5B4B9A', relation: 'Daughter' },
    { id: 'u4', name: 'Ammachi', email: '', phone: '9847000004', password: '', role: 'viewer', status: 'invited', color: '#E19A2B', relation: 'Grandmother', inviteCode: 'AMMA42' },
  ];

  const lastWeek = fillWeek(lastMon, [
    [[['Idli', 'Sambar']], [['Rice & Sambar', 'Cabbage thoran, Pappadam']], [['Chapati', 'Dal tadka']]],
    [[['Puttu', 'Kadala curry']], [['Meen curry', 'Rice, Beans thoran']], [['Kanji', 'Cherupayar, Pickle']]],
    [[['Dosa', 'Coconut chutney']], [['Avial', 'Rice, Moru curry']], [['Chapati', 'Chicken curry']]],
    [[['Upma', 'Banana']], [['Rasam rice', 'Pavakka fry']], [['Dosa', 'Tomato chutney']]],
    [[['Appam', 'Vegetable stew']], [['Chicken curry', 'Rice, Salad']], [['Kanji', 'Cherupayar, Pickle']]],
    [[['Idiyappam', 'Egg curry']], [['Rice & Sambar', 'Cabbage thoran, Pappadam']], [['Vegetable fried rice', 'Gobi manchurian']]],
    [[['Poori', 'Potato masala']], [['Meen curry', 'Rice, Beans thoran']], [['Pathiri', 'Mutton stew']]],
  ]);

  const thisWeek = fillWeek(thisMon, [
    [[['Puttu', 'Kadala curry', { special: 'Less spicy for Meera' }]], [['Rice & Sambar', 'Cabbage thoran, Pappadam']], [['Chapati', 'Dal tadka']]],
    [[['Appam', 'Vegetable stew']], [['Meen curry', 'Rice, Beans thoran', { notes: 'Use kudampuli, cook in manchatti' }]], [['Kanji', 'Cherupayar, Pickle']]],
    [[['Idli', 'Sambar']], [['Avial', 'Rice, Moru curry']], [['Chapati', 'Chicken curry']]],
    [[['Dosa', 'Coconut chutney']], [['Rasam rice', 'Pavakka fry']], [['Vegetable fried rice', 'Gobi manchurian']]],
    [[['Idiyappam', 'Egg curry']], [['Chicken curry', 'Rice, Salad']], [['Dosa', 'Tomato chutney']]],
    [[['Upma', 'Banana']], [['Rice & Sambar', 'Cabbage thoran, Pappadam']], [['Pathiri', 'Mutton stew', { description: 'Sunday special' }]]],
    [[['Poori', 'Potato masala']], [['Meen curry', 'Rice, Beans thoran']], []],
  ]);

  const nextWeek = fillWeek(nextMon, [
    [[['Idli', 'Sambar']], [['Avial', 'Rice, Moru curry']], [['Chapati', 'Dal tadka']]],
    [[['Puttu', 'Kadala curry']], [['Chicken curry', 'Rice, Salad']]],
    [[['Appam', 'Vegetable stew']]],
  ]);

  const schedules = [
    { id: 's_last', startDate: lastMon, status: 'published', createdBy: 'u1', publishedAt: now - 9 * 24 * H, updatedAt: now - 9 * 24 * H, editedAfterPublish: false, days: lastWeek },
    { id: 's_this', startDate: thisMon, status: 'published', createdBy: 'u1', publishedAt: now - 2 * 24 * H, updatedAt: now - 5 * H, editedAfterPublish: true, days: thisWeek },
    { id: 's_next', startDate: nextMon, status: 'draft', createdBy: 'u1', publishedAt: null, updatedAt: now - 1 * H, editedAfterPublish: false, days: nextWeek },
  ];

  const g = (id, name, category, qty, unit, extra = {}) => ({
    id, name, category, qty, unit, priority: 'normal', requiredBy: null, remarks: '', status: 'pending', purchasedQty: 0,
    createdBy: 'u1', createdAt: now - 30 * H, updatedAt: now - 30 * H, updatedBy: 'u1', purchasedBy: null, purchasedAt: null, version: 1, ...extra,
  });

  const groceries = [
    g('g1', 'Matta rice', 'grains', 5, 'kg', { remarks: 'Double Horse brand' }),
    g('g2', 'Coconut', 'vegetables', 4, 'nos', { priority: 'urgent', requiredBy: today }),
    g('g3', 'Fish (ayala / mackerel)', 'fish', 1, 'kg', { priority: 'urgent', requiredBy: addDays(today, 1), remarks: 'Fresh, medium size' }),
    g('g4', 'Toor dal', 'pulses', 1, 'kg'),
    g('g5', 'Curd', 'dairy', 500, 'g'),
    g('g6', 'Milk', 'dairy', 2, 'litre', { status: 'purchased', purchasedQty: 2, purchasedBy: 'u2', purchasedAt: now - 3 * H, updatedBy: 'u2', updatedAt: now - 3 * H }),
    g('g7', 'Onion', 'vegetables', 2, 'kg', { status: 'partial', purchasedQty: 1, purchasedBy: 'u2', purchasedAt: now - 3 * H, updatedBy: 'u2', updatedAt: now - 3 * H, remarks: 'Small shallots also fine' }),
    g('g8', 'Nendran banana', 'fruits', 6, 'nos'),
    g('g9', 'Coconut oil', 'household', 1, 'litre', { remarks: 'KLF Coconad' }),
    g('g10', 'Chicken', 'meat', 1, 'kg', { requiredBy: addDays(today, 2) }),
    g('g11', 'Dishwash liquid', 'household', 1, 'nos', { status: 'purchased', purchasedQty: 1, purchasedBy: 'u3', purchasedAt: now - 20 * H, updatedBy: 'u3', updatedAt: now - 20 * H }),
    g('g12', 'Garam masala', 'spices', 1, 'packet'),
    g('g13', 'Curry leaves', 'vegetables', 1, 'bunch', { status: 'cancelled', updatedBy: 'u1', updatedAt: now - 26 * H, remarks: 'Have plenty from garden' }),
    g('g14', 'Bread', 'bakery', 1, 'packet', { status: 'purchased', purchasedQty: 1, purchasedBy: 'u2', purchasedAt: now - 27 * H, updatedBy: 'u2', updatedAt: now - 27 * H }),
  ];

  const history = [
    { id: 'h1', itemId: 'g6', itemName: 'Milk', action: 'status', from: 'pending', to: 'purchased', qty: 2, unit: 'litre', by: 'u2', at: now - 3 * H },
    { id: 'h2', itemId: 'g7', itemName: 'Onion', action: 'status', from: 'pending', to: 'partial', qty: 1, unit: 'kg', by: 'u2', at: now - 3 * H },
    { id: 'h3', itemId: 'g11', itemName: 'Dishwash liquid', action: 'status', from: 'pending', to: 'purchased', qty: 1, unit: 'nos', by: 'u3', at: now - 20 * H },
    { id: 'h4', itemId: 'g13', itemName: 'Curry leaves', action: 'status', from: 'pending', to: 'cancelled', by: 'u1', at: now - 26 * H },
    { id: 'h5', itemId: 'g14', itemName: 'Bread', action: 'status', from: 'pending', to: 'purchased', qty: 1, unit: 'packet', by: 'u2', at: now - 27 * H },
    ...groceries.map((it, i) => ({ id: `hc${i}`, itemId: it.id, itemName: it.name, action: 'created', by: 'u1', at: now - 30 * H })),
  ];

  const notifications = [
    { id: 'n1', to: 'creator', type: 'purchase', title: 'Rahul bought Milk', body: '2 litre · marked purchased', at: now - 3 * H, readBy: [] },
    { id: 'n2', to: 'creator', type: 'purchase', title: 'Rahul partly bought Onion', body: '1 of 2 kg bought · 1 kg remaining', at: now - 3 * H, readBy: [] },
    { id: 'n3', to: 'viewer', type: 'schedule', title: 'This week’s menu was updated', body: 'Anitha changed Tuesday lunch', at: now - 5 * H, readBy: [] },
    { id: 'n4', to: 'viewer', type: 'grocery', title: '2 urgent items added', body: 'Coconut, Fish (ayala / mackerel)', at: now - 6 * H, readBy: [] },
    { id: 'n5', to: 'viewer', type: 'schedule', title: 'New weekly menu published', body: 'Meals for this week are ready to view', at: now - 2 * 24 * H, readBy: ['u2'] },
    { id: 'n6', to: 'creator', type: 'purchase', title: 'Meera bought Dishwash liquid', body: '1 nos · marked purchased', at: now - 20 * H, readBy: ['u1'] },
  ];

  return {
    seedVersion: 3,
    household: { id: 'hh1', name: 'Menon Family', timezone: 'Asia/Kolkata', joinCode: 'MENU24' },
    users,
    schedules,
    groceries,
    history,
    notifications,
    customCategories: [],
    customDishes: [],
    lang: 'en',
    prefs: { u1: { schedule: true, grocery: true, purchase: true, reminders: true }, u2: { schedule: true, grocery: true, purchase: true, reminders: true }, u3: { schedule: true, grocery: true, purchase: true, reminders: false } },
    sessionUserId: null,
  };
}

export const SEED_VERSION = SCHEMA_VERSION;

// Live app: nothing but settings until someone registers.
export const emptyDb = () => ({ seedVersion: SEED_VERSION, lang: 'en', users: [], households: {} });

export const emptyHousehold = (id, name) => ({
  household: { id, name, timezone: 'Asia/Kolkata', createdAt: Date.now() },
  schedules: [], groceries: [], history: [], notifications: [], customCategories: [], customDishes: [], prefs: {}, audit: [],
});

// Multi-household database: users are global (one login), all other data is per household.
export function buildDb() {
  const s = buildSeed();
  const { users, lang, seedVersion, sessionUserId, ...hh } = s;
  const now = Date.now(); const D = 86400000;
  hh.household.createdAt = now - 30 * D;
  hh.audit = [
    { id: 'a1', actor: 'u1', action: 'household.created', entity: 'household', entityId: 'hh1', details: 'Menon Family', at: now - 30 * D },
    { id: 'a2', actor: 'u1', action: 'schedule.published', entity: 'weekly_schedule', entityId: 's_last', details: 'Last week', at: now - 9 * D },
    { id: 'a3', actor: 'u1', action: 'schedule.published', entity: 'weekly_schedule', entityId: 's_this', details: 'This week', at: now - 2 * D },
    { id: 'a4', actor: 'u1', action: 'member.invited', entity: 'household_member', entityId: 'm_u4', details: 'Ammachi', at: now - 1 * D },
  ];
  return {
    seedVersion: SEED_VERSION,
    lang: 'en',
    users: users.map(({ password, ...u }) => {
      const salt = password ? newSalt() : null;
      return { ...u, householdId: 'hh1', createdAt: now - 30 * D, joinedAt: u.status === 'active' ? now - 29 * D : null,
        passwordSalt: salt, passwordHash: password ? hashPassword(password, salt) : null };
    }),
    households: { hh1: hh },
  };
}
