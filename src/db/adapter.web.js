// Web: every row is stored as its own entry, keyed "hm5:<table>:<id>".
// Falls back to memory if browser storage is unavailable.
import { TABLES } from './schema';

const PREFIX = 'hm5:';
const mem = new Map();
const ls = (() => {
  try { const s = window.localStorage; s.setItem('hm5:__probe', '1'); s.removeItem('hm5:__probe'); return s; } catch (e) { return null; }
})();
const io = {
  keys: () => (ls ? Object.keys(ls) : [...mem.keys()]).filter((k) => k.startsWith(PREFIX)),
  get: (k) => (ls ? ls.getItem(k) : mem.get(k)),
  set: (k, v) => { try { if (ls) ls.setItem(k, v); else mem.set(k, v); } catch (e) { mem.set(k, v); } },
  del: (k) => { if (ls) ls.removeItem(k); mem.delete(k); },
};
const key = (table, id) => `${PREFIX}${table}:${id}`;

export async function openStore() {
  return {
    kind: 'rows',
    label: ls ? 'Browser storage · one entry per row' : 'Memory (browser storage blocked)',
    async loadAll() {
      const T = Object.fromEntries(TABLES.map((tb) => [tb.name, []]));
      io.keys().forEach((k) => {
        const rest = k.slice(PREFIX.length);
        const table = rest.slice(0, rest.indexOf(':'));
        if (!T[table]) return;
        try { T[table].push(JSON.parse(io.get(k))); } catch (e) {}
      });
      return T.users.length || T.households.length || T.app_settings.length ? T : null;
    },
    async apply(changes) {
      changes.forEach((ch) => {
        ch.deletes.forEach((id) => io.del(key(ch.table, id)));
        ch.upserts.forEach((row) => io.set(key(ch.table, row.id), JSON.stringify(row)));
      });
    },
    async replaceAll(T) {
      io.keys().forEach((k) => io.del(k));
      TABLES.forEach((tb) => (T[tb.name] || []).forEach((row) => io.set(key(tb.name, row.id), JSON.stringify(row))));
    },
    // Another tab changed some rows → reload (simulates realtime push from the server)
    subscribe(cb) {
      if (typeof window === 'undefined') return () => {};
      let timer = null;
      const on = (e) => { if (e.key && e.key.startsWith(PREFIX)) { clearTimeout(timer); timer = setTimeout(cb, 60); } };
      window.addEventListener('storage', on);
      return () => window.removeEventListener('storage', on);
    },
  };
}
