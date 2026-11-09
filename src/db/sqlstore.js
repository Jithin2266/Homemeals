// SQL-backed table store. Works with expo-sqlite's async API
// (execAsync / runAsync / getAllAsync / withTransactionAsync).
import { TABLES, sqliteDDL } from './schema';

const encode = (col, v) => {
  if (v === undefined || v === null) return null;
  if (col.type === 'bool') return v ? 1 : 0;
  if (col.type === 'json') return JSON.stringify(v);
  return v;
};
const decode = (col, v) => {
  if (v === null || v === undefined) return null;
  if (col.type === 'bool') return !!v;
  if (col.type === 'json') { try { return JSON.parse(v); } catch (e) { return null; } }
  if (col.type === 'real' || col.type === 'int' || col.type === 'ts') return Number(v);
  return v;
};

export function createSqlStore(db, { label = 'SQLite on this device' } = {}) {
  let ready = null;
  const sqlType = { text: 'TEXT', int: 'INTEGER', real: 'REAL', bool: 'INTEGER', json: 'TEXT', ts: 'INTEGER', date: 'TEXT' };
  const migrate = async () => {
    for (const tb of TABLES) {
      const have = new Set((await db.getAllAsync(`PRAGMA table_info(${tb.name})`, [])).map((r) => r.name));
      for (const col of tb.columns) {
        if (!have.has(col.name)) await db.execAsync(`ALTER TABLE ${tb.name} ADD COLUMN ${col.name} ${sqlType[col.type]};`);
      }
    }
  };
  const init = () => {
    if (!ready) ready = db.execAsync(`PRAGMA foreign_keys = ON;\n${sqliteDDL()}`).then(migrate);
    return ready;
  };
  const upsertSql = {};
  TABLES.forEach((tb) => {
    const cols = tb.columns.map((c) => c.name);
    const sets = cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ');
    upsertSql[tb.name] = `INSERT INTO ${tb.name} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) ON CONFLICT(id) DO UPDATE SET ${sets}`;
  });
  const rowParams = (tb, row) => tb.columns.map((c) => encode(c, row[c.name]));

  const writeChanges = async (changes) => {
    const byTable = Object.fromEntries(changes.map((ch) => [ch.table, ch]));
    // children first for deletes, parents first for upserts (foreign keys)
    for (const tb of [...TABLES].reverse()) {
      const ch = byTable[tb.name];
      if (ch) for (const id of ch.deletes) await db.runAsync(`DELETE FROM ${tb.name} WHERE id = ?`, [id]);
    }
    for (const tb of TABLES) {
      const ch = byTable[tb.name];
      if (ch) for (const row of ch.upserts) await db.runAsync(upsertSql[tb.name], rowParams(tb, row));
    }
  };

  return {
    kind: 'sqlite',
    label,
    async loadAll() {
      await init();
      const T = {};
      for (const tb of TABLES) {
        const rows = await db.getAllAsync(`SELECT * FROM ${tb.name}`, []);
        T[tb.name] = rows.map((r) => Object.fromEntries(tb.columns.map((c) => [c.name, decode(c, r[c.name])])));
      }
      return T.users.length || T.households.length ? T : null;
    },
    async apply(changes) {
      await init();
      if (!changes.length) return;
      await db.withTransactionAsync(() => writeChanges(changes));
    },
    async replaceAll(T) {
      await init();
      await db.withTransactionAsync(async () => {
        for (const tb of [...TABLES].reverse()) await db.runAsync(`DELETE FROM ${tb.name}`, []);
        await writeChanges(TABLES.map((tb) => ({ table: tb.name, upserts: T[tb.name] || [], deletes: [] })));
      });
    },
    subscribe() { return () => {}; },
  };
}
