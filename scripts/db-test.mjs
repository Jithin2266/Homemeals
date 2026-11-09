import initSqlJs from 'sql.js';
import assert from 'node:assert/strict';
import { buildDb } from '../src/seed.js';
import { toTables, fromTables, diffTables, countRows } from '../src/db/mapper.js';
import { createSqlStore } from '../src/db/sqlstore.js';
import { TABLES, postgresDDL } from '../src/db/schema.js';
import { hashPassword } from '../src/db/crypto.js';
import { createHash } from 'node:crypto';

// expo-sqlite-compatible shim over sql.js (real SQLite compiled to wasm)
const SQL = await initSqlJs();
const raw = new SQL.Database();
const db = {
  async execAsync(sql) { raw.exec(sql); },
  async runAsync(sql, params) { raw.run(sql, params); },
  async getAllAsync(sql, params) { const st = raw.prepare(sql); st.bind(params); const out = []; while (st.step()) out.push(st.getAsObject()); st.free(); return out; },
  async withTransactionAsync(fn) { raw.exec('BEGIN'); try { await fn(); raw.exec('COMMIT'); } catch (e) { raw.exec('ROLLBACK'); throw e; } },
};
const store = createSqlStore(db);

// 1. sha256 matches node's implementation
assert.equal(hashPassword('demo123', 'salt'), createHash('sha256').update('salt:demo123').digest('hex'));
assert.equal(hashPassword('പാചകം', 'x'), createHash('sha256').update('x:പാചകം').digest('hex'));

// 2. Seed → tables → SQLite → back
const seed = buildDb();
const T = toTables(seed);
await store.replaceAll(T);
const loaded = await store.loadAll();
for (const tb of TABLES) assert.equal(loaded[tb.name].length, T[tb.name].length, `row count ${tb.name}`);
const back = fromTables(loaded);
assert.deepEqual(diffTables(toTables(back), T), [], 'roundtrip produces no diff');
assert.equal(back.households.hh1.schedules.length, 3);
assert.equal(back.households.hh1.schedules[1].days[seed.households.hh1.schedules[1].startDate].breakfast[0].name, 'Puttu');

// 3. Foreign keys are enforced
const fk = raw.exec('PRAGMA foreign_keys')[0].values[0][0];
assert.equal(fk, 1);
assert.throws(() => raw.run("INSERT INTO meal_items (id, daily_meal_id, dish_name) VALUES ('x','missing','y')"));

// 4. Row-level change: buy one item, delete a schedule
const next = structuredClone(back);
const g = next.households.hh1.groceries.find((x) => x.id === 'g1');
g.status = 'purchased'; g.purchasedQty = g.qty; g.version += 1;
next.households.hh1.schedules = next.households.hh1.schedules.filter((x) => x.id !== 's_last');
const changes = diffTables(loaded, toTables(next));
const summary = Object.fromEntries(changes.map((c) => [c.table, `+${c.upserts.length} -${c.deletes.length}`]));
console.log('Changes written:', summary);
assert.equal(changes.find((c) => c.table === 'grocery_items').upserts.length, 1);
await store.apply(changes);
const after = await store.loadAll();
assert.equal(after.weekly_schedules.length, 2);
assert.equal(after.daily_meals.length, 42);
assert.equal(after.grocery_items.find((x) => x.id === 'g1').status, 'purchased');
assert.deepEqual(diffTables(after, toTables(next)), []);

console.log('Tables:', TABLES.length, '· rows:', countRows(T));
console.log(Object.fromEntries(TABLES.map((tb) => [tb.name, T[tb.name].length])));
console.log('ALL DATABASE TESTS PASSED');
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('../database', { recursive: true });
writeFileSync('../database/schema.sql', postgresDDL());
