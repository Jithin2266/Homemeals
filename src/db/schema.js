/*
 * HomeMeal database schema — one table per entity (SRS §7.1).
 * The same definition creates the on-device SQLite tables, the browser
 * row store, and database/schema.sql (PostgreSQL) for the backend.
 *
 * Column types: text | int | real | bool | json | ts (epoch ms) | date (YYYY-MM-DD)
 * Tables are listed parent-first so inserts respect foreign keys.
 */
export const SCHEMA_VERSION = 5;

const t = (name, label, columns, extra = {}) => ({ name, label, columns, pk: 'id', ...extra });
const c = (name, type, opts = {}) => ({ name, type, ...opts });

export const TABLES = [
  t('app_settings', 'App settings', [
    c('id', 'text', { pk: true }), c('value', 'text'),
  ], { device: true, note: 'Device-level settings such as language and schema version' }),

  t('households', 'Households', [
    c('id', 'text', { pk: true }), c('name', 'text', { required: true }), c('timezone', 'text'),
    c('status', 'text', { check: ['active', 'closed'] }), c('created_at', 'ts'),
    c('join_code', 'text', { unique: true }),
  ], { note: 'join_code: household code any family member can use to join as a Viewer.' }),

  t('users', 'Users', [
    c('id', 'text', { pk: true }), c('name', 'text', { required: true }), c('email', 'text', { unique: true }),
    c('phone', 'text', { unique: true }), c('password_hash', 'text'), c('password_salt', 'text'),
    c('avatar_color', 'text'), c('account_status', 'text', { check: ['active', 'pending'] }), c('created_at', 'ts'),
  ], { note: 'Login identity. Passwords are stored only as salted SHA-256 hashes.' }),

  t('household_members', 'Household members', [
    c('id', 'text', { pk: true }), c('household_id', 'text', { ref: 'households' }), c('user_id', 'text', { ref: 'users' }),
    c('role', 'text', { check: ['creator', 'viewer'] }), c('relation', 'text'),
    c('membership_status', 'text', { check: ['invited', 'active', 'deactivated'] }), c('invite_code', 'text'), c('joined_at', 'ts'),
  ], { note: 'Links a user to a household with a role (Creator / Viewer).' }),

  t('user_preferences', 'Notification preferences', [
    c('id', 'text', { pk: true }), c('user_id', 'text', { ref: 'users' }), c('household_id', 'text', { ref: 'households' }),
    c('schedule_alerts', 'bool'), c('grocery_alerts', 'bool'), c('purchase_alerts', 'bool'), c('reminders', 'bool'),
    c('sound_enabled', 'bool'), c('reminder_hour', 'int'),
  ]),

  t('weekly_schedules', 'Weekly schedules', [
    c('id', 'text', { pk: true }), c('household_id', 'text', { ref: 'households' }), c('start_date', 'date', { required: true }),
    c('end_date', 'date', { required: true }), c('status', 'text', { check: ['draft', 'published', 'archived'] }),
    c('created_by', 'text', { ref: 'users' }), c('published_at', 'ts'), c('updated_at', 'ts'), c('edited_after_publish', 'bool'),
  ], { note: 'end_date = start_date + 6 days (BR-003). No overlapping ranges per household (BR-012).' }),

  t('daily_meals', 'Daily meals', [
    c('id', 'text', { pk: true }), c('schedule_id', 'text', { ref: 'weekly_schedules' }), c('meal_date', 'date', { required: true }),
    c('meal_type', 'text', { check: ['breakfast', 'lunch', 'dinner'] }),
  ], { note: '7 dates × 3 meal types = 21 rows per schedule (BR-004).' }),

  t('meal_items', 'Meal items', [
    c('id', 'text', { pk: true }), c('daily_meal_id', 'text', { ref: 'daily_meals' }), c('dish_name', 'text', { required: true }),
    c('side_dish', 'text'), c('description', 'text'), c('prep_notes', 'text'), c('special_instructions', 'text'), c('display_order', 'int'),
  ]),

  t('grocery_categories', 'Grocery categories', [
    c('id', 'text', { pk: true }), c('household_id', 'text', { ref: 'households', nullable: true }), c('name', 'text'),
    c('icon', 'text'), c('is_system', 'bool'), c('active', 'bool'),
  ], { note: 'System categories have no household; custom ones belong to a household (FR-035/036).' }),

  t('grocery_items', 'Grocery items', [
    c('id', 'text', { pk: true }), c('household_id', 'text', { ref: 'households' }), c('item_name', 'text', { required: true }),
    c('category_id', 'text', { ref: 'grocery_categories' }), c('quantity', 'real'), c('unit', 'text'),
    c('priority', 'text', { check: ['normal', 'urgent'] }), c('required_by', 'date'), c('remarks', 'text'),
    c('status', 'text', { check: ['pending', 'partial', 'purchased', 'cancelled'] }), c('purchased_qty', 'real'),
    c('created_by', 'text', { ref: 'users' }), c('created_at', 'ts'), c('updated_by', 'text', { ref: 'users' }), c('updated_at', 'ts'),
    c('purchased_by', 'text', { ref: 'users', nullable: true }), c('purchased_at', 'ts'), c('version', 'int'),
  ], { note: 'version increases on every change; a stale version is rejected (FR-051).' }),

  t('purchase_history', 'Purchase history', [
    c('id', 'text', { pk: true }), c('household_id', 'text', { ref: 'households' }), c('grocery_item_id', 'text'),
    c('item_name', 'text'), c('action', 'text'), c('old_status', 'text'), c('new_status', 'text'),
    c('purchased_qty', 'real'), c('unit', 'text'), c('updated_by', 'text', { ref: 'users' }), c('created_at', 'ts'),
  ], { note: 'Kept even after an item is deleted (no FK to grocery_items) — BR-009.' }),

  t('notifications', 'Notifications', [
    c('id', 'text', { pk: true }), c('household_id', 'text', { ref: 'households' }), c('target_role', 'text'),
    c('type', 'text'), c('title', 'text'), c('message', 'text'), c('schedule_id', 'text'),
    c('from_user_id', 'text'), c('meta', 'json'), c('created_at', 'ts'),
  ]),

  t('notification_reads', 'Notification reads', [
    c('id', 'text', { pk: true }), c('notification_id', 'text', { ref: 'notifications' }), c('user_id', 'text', { ref: 'users' }),
  ], { note: 'One row per user who has read a notification.' }),

  t('dishes', 'Saved dishes', [
    c('id', 'text', { pk: true }), c('household_id', 'text', { ref: 'households' }), c('name', 'text'),
    c('side_dish', 'text'), c('meal_type', 'text'), c('created_at', 'ts'),
  ], { note: "Household's own dishes, remembered for quick-pick." }),

  t('dish_ingredients', 'Dish ingredients', [
    c('id', 'text', { pk: true }), c('dish_id', 'text', { ref: 'dishes' }), c('name', 'text'),
    c('quantity', 'real'), c('unit', 'text'), c('category_id', 'text'),
  ]),

  t('audit_log', 'Audit log', [
    c('id', 'text', { pk: true }), c('household_id', 'text', { ref: 'households' }), c('actor_id', 'text'),
    c('action', 'text'), c('entity', 'text'), c('entity_id', 'text'), c('details', 'text'), c('created_at', 'ts'),
  ], { note: 'Who did what and when, for schedules, groceries and members (NFR-010).' }),
];

export const TABLE = Object.fromEntries(TABLES.map((x) => [x.name, x]));

// ---------- SQLite DDL ----------
const sqliteType = { text: 'TEXT', int: 'INTEGER', real: 'REAL', bool: 'INTEGER', json: 'TEXT', ts: 'INTEGER', date: 'TEXT' };

export function sqliteDDL() {
  const out = [];
  TABLES.forEach((tb) => {
    const cols = tb.columns.map((col) => {
      let s = `  ${col.name} ${sqliteType[col.type]}`;
      if (col.pk) s += ' PRIMARY KEY NOT NULL';
      else if (col.required) s += ' NOT NULL';
      if (col.ref) s += ` REFERENCES ${col.ref}(id) ON DELETE CASCADE`;
      return s;
    });
    out.push(`CREATE TABLE IF NOT EXISTS ${tb.name} (\n${cols.join(',\n')}\n);`);
    tb.columns.filter((col) => col.ref).forEach((col) => out.push(`CREATE INDEX IF NOT EXISTS idx_${tb.name}_${col.name} ON ${tb.name}(${col.name});`));
  });
  return out.join('\n');
}

// ---------- PostgreSQL DDL (backend) ----------
const pgType = { text: 'TEXT', int: 'INTEGER', real: 'NUMERIC(10,2)', bool: 'BOOLEAN', json: 'JSONB', ts: 'TIMESTAMPTZ', date: 'DATE' };

export function postgresDDL() {
  const out = ['-- HomeMeal — PostgreSQL schema (generated from src/db/schema.js)', '-- Timestamps are stored as epoch ms in the app and as TIMESTAMPTZ on the server.', ''];
  TABLES.filter((tb) => !tb.device).forEach((tb) => {
    if (tb.note) out.push(`-- ${tb.label}: ${tb.note}`);
    const cols = tb.columns.map((col) => {
      let s = `  ${col.name} ${pgType[col.type]}`;
      if (col.pk) s += ' PRIMARY KEY';
      else if (col.required) s += ' NOT NULL';
      if (col.unique) s += ' UNIQUE';
      if (col.ref) s += ` REFERENCES ${col.ref}(id)${tb.name === 'grocery_items' && col.ref === 'users' ? '' : ' ON DELETE CASCADE'}`;
      if (col.check) s += ` CHECK (${col.name} IN (${col.check.map((v) => `'${v}'`).join(', ')}))`;
      return s;
    });
    out.push(`CREATE TABLE ${tb.name} (\n${cols.join(',\n')}\n);`);
    tb.columns.filter((col) => col.ref).forEach((col) => out.push(`CREATE INDEX idx_${tb.name}_${col.name} ON ${tb.name}(${col.name});`));
    out.push('');
  });
  out.push('-- Business-rule constraints');
  out.push('ALTER TABLE household_members ADD CONSTRAINT uq_member UNIQUE (household_id, user_id);');
  out.push('ALTER TABLE daily_meals ADD CONSTRAINT uq_daily_meal UNIQUE (schedule_id, meal_date, meal_type);');
  out.push('ALTER TABLE weekly_schedules ADD CONSTRAINT ck_week_length CHECK (end_date = start_date + 6);');
  out.push('CREATE EXTENSION IF NOT EXISTS btree_gist;');
  out.push("ALTER TABLE weekly_schedules ADD CONSTRAINT no_overlap EXCLUDE USING gist (household_id WITH =, daterange(start_date, end_date, '[]') WITH &&);");
  out.push("CREATE UNIQUE INDEX one_creator_per_household ON household_members(household_id) WHERE role = 'creator' AND membership_status = 'active';");
  out.push('ALTER TABLE notification_reads ADD CONSTRAINT uq_read UNIQUE (notification_id, user_id);');
  return out.join('\n') + '\n';
}
