// Date helpers working on local 'YYYY-MM-DD' strings.
const pad = (n) => String(n).padStart(2, '0');

export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const todayISO = () => toISO(new Date());
export const addDays = (iso, n) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
export const diffDays = (a, b) => Math.round((fromISO(a) - fromISO(b)) / 86400000);
export const mondayOf = (iso) => {
  const d = fromISO(iso);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return toISO(d);
};
export const weekDates = (startISO) => Array.from({ length: 7 }, (_, i) => addDays(startISO, i));

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const dow = (iso) => DOW[fromISO(iso).getDay()];
export const dowLong = (iso) => DOW_LONG[fromISO(iso).getDay()];
export const dayNum = (iso) => fromISO(iso).getDate();
export const fmtShort = (iso) => {
  const d = fromISO(iso);
  return `${d.getDate()} ${MON[d.getMonth()]}`;
};
export const fmtRange = (startISO) => {
  const s = fromISO(startISO);
  const e = fromISO(addDays(startISO, 6));
  if (s.getMonth() === e.getMonth()) return `${s.getDate()}–${e.getDate()} ${MON[e.getMonth()]}`;
  return `${s.getDate()} ${MON[s.getMonth()]} – ${e.getDate()} ${MON[e.getMonth()]}`;
};

export const relTime = (ts) => {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  const dt = new Date(ts);
  return `${dt.getDate()} ${MON[dt.getMonth()]}`;
};

export const fmtStamp = (ts) => {
  const d = new Date(ts);
  let h = d.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${d.getDate()} ${MON[d.getMonth()]}, ${h}:${pad(d.getMinutes())} ${ap}`;
};

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};
