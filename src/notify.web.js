// Web preview: browser notifications when allowed, plus a synthesized chime
// (same two notes as assets/sounds/grocery_chime.wav) and a title badge.
let ctx = null;
if (typeof window !== 'undefined') {
  const unlock = () => {
    try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch (e) {}
  };
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
}

export function playChime() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime + 0.02;
    [[1318.5, 0, 0.5, 0.35], [1760, 0.16, 0.7, 0.3], [880, 0.16, 0.7, 0.08]].forEach(([f, st, dur, a]) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + st);
      g.gain.linearRampToValueAtTime(a, t0 + st + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + st + dur);
      o.connect(g).connect(ctx.destination); o.start(t0 + st); o.stop(t0 + st + dur + 0.05);
    });
    window.__hmChimes = (window.__hmChimes || 0) + 1;
    return true;
  } catch (e) { return false; }
}

let permission = null;
export async function initNotifications() {
  try {
    if (typeof Notification === 'undefined') return (permission = false);
    if (Notification.permission === 'default') await Notification.requestPermission();
    permission = Notification.permission === 'granted';
  } catch (e) { permission = false; }
  return permission;
}

export async function showAlert({ title, body, sound = true, data }) {
  if (sound) playChime();
  try {
    if (permission && document.visibilityState !== 'visible') {
      const n = new Notification(title, { body, tag: data?.tag || 'homemeal' });
      n.onclick = () => window.focus();
    }
  } catch (e) {}
  return true;
}

export async function setBadge(n) {
  try {
    const base = 'HomeMeal – Weekly Meal Planner & Grocery';
    document.title = n ? `(${n}) ${base}` : base;
    if (navigator.setAppBadge) n ? navigator.setAppBadge(n) : navigator.clearAppBadge();
  } catch (e) {}
}

export async function scheduleReminder() {}
export function onNotificationTap() { return () => {}; }
export const notificationsSupported = false;
