-- HomeMeal — PostgreSQL schema (generated from src/db/schema.js)
-- Timestamps are stored as epoch ms in the app and as TIMESTAMPTZ on the server.

CREATE TABLE households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT,
  status TEXT CHECK (status IN ('active', 'closed')),
  created_at TIMESTAMPTZ
);

-- Users: Login identity. Passwords are stored only as salted SHA-256 hashes.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT,
  password_salt TEXT,
  avatar_color TEXT,
  account_status TEXT CHECK (account_status IN ('active', 'pending')),
  created_at TIMESTAMPTZ
);

-- Household members: Links a user to a household with a role (Creator / Viewer).
CREATE TABLE household_members (
  id TEXT PRIMARY KEY,
  household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('creator', 'viewer')),
  relation TEXT,
  membership_status TEXT CHECK (membership_status IN ('invited', 'active', 'deactivated')),
  invite_code TEXT,
  joined_at TIMESTAMPTZ
);
CREATE INDEX idx_household_members_household_id ON household_members(household_id);
CREATE INDEX idx_household_members_user_id ON household_members(user_id);

CREATE TABLE user_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
  schedule_alerts BOOLEAN,
  grocery_alerts BOOLEAN,
  purchase_alerts BOOLEAN,
  reminders BOOLEAN
);
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_user_preferences_household_id ON user_preferences(household_id);

-- Weekly schedules: end_date = start_date + 6 days (BR-003). No overlapping ranges per household (BR-012).
CREATE TABLE weekly_schedules (
  id TEXT PRIMARY KEY,
  household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT CHECK (status IN ('draft', 'published', 'archived')),
  created_by TEXT REFERENCES users(id) ON DELETE CASCADE,
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  edited_after_publish BOOLEAN
);
CREATE INDEX idx_weekly_schedules_household_id ON weekly_schedules(household_id);
CREATE INDEX idx_weekly_schedules_created_by ON weekly_schedules(created_by);

-- Daily meals: 7 dates × 3 meal types = 21 rows per schedule (BR-004).
CREATE TABLE daily_meals (
  id TEXT PRIMARY KEY,
  schedule_id TEXT REFERENCES weekly_schedules(id) ON DELETE CASCADE,
  meal_date DATE NOT NULL,
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner'))
);
CREATE INDEX idx_daily_meals_schedule_id ON daily_meals(schedule_id);

CREATE TABLE meal_items (
  id TEXT PRIMARY KEY,
  daily_meal_id TEXT REFERENCES daily_meals(id) ON DELETE CASCADE,
  dish_name TEXT NOT NULL,
  side_dish TEXT,
  description TEXT,
  prep_notes TEXT,
  special_instructions TEXT,
  display_order INTEGER
);
CREATE INDEX idx_meal_items_daily_meal_id ON meal_items(daily_meal_id);

-- Grocery categories: System categories have no household; custom ones belong to a household (FR-035/036).
CREATE TABLE grocery_categories (
  id TEXT PRIMARY KEY,
  household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
  name TEXT,
  icon TEXT,
  is_system BOOLEAN,
  active BOOLEAN
);
CREATE INDEX idx_grocery_categories_household_id ON grocery_categories(household_id);

-- Grocery items: version increases on every change; a stale version is rejected (FR-051).
CREATE TABLE grocery_items (
  id TEXT PRIMARY KEY,
  household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  category_id TEXT REFERENCES grocery_categories(id) ON DELETE CASCADE,
  quantity NUMERIC(10,2),
  unit TEXT,
  priority TEXT CHECK (priority IN ('normal', 'urgent')),
  required_by DATE,
  remarks TEXT,
  status TEXT CHECK (status IN ('pending', 'partial', 'purchased', 'cancelled')),
  purchased_qty NUMERIC(10,2),
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ,
  updated_by TEXT REFERENCES users(id),
  updated_at TIMESTAMPTZ,
  purchased_by TEXT REFERENCES users(id),
  purchased_at TIMESTAMPTZ,
  version INTEGER
);
CREATE INDEX idx_grocery_items_household_id ON grocery_items(household_id);
CREATE INDEX idx_grocery_items_category_id ON grocery_items(category_id);
CREATE INDEX idx_grocery_items_created_by ON grocery_items(created_by);
CREATE INDEX idx_grocery_items_updated_by ON grocery_items(updated_by);
CREATE INDEX idx_grocery_items_purchased_by ON grocery_items(purchased_by);

-- Purchase history: Kept even after an item is deleted (no FK to grocery_items) — BR-009.
CREATE TABLE purchase_history (
  id TEXT PRIMARY KEY,
  household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
  grocery_item_id TEXT,
  item_name TEXT,
  action TEXT,
  old_status TEXT,
  new_status TEXT,
  purchased_qty NUMERIC(10,2),
  unit TEXT,
  updated_by TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ
);
CREATE INDEX idx_purchase_history_household_id ON purchase_history(household_id);
CREATE INDEX idx_purchase_history_updated_by ON purchase_history(updated_by);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
  target_role TEXT,
  type TEXT,
  title TEXT,
  message TEXT,
  schedule_id TEXT,
  from_user_id TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ
);
CREATE INDEX idx_notifications_household_id ON notifications(household_id);

-- Notification reads: One row per user who has read a notification.
CREATE TABLE notification_reads (
  id TEXT PRIMARY KEY,
  notification_id TEXT REFERENCES notifications(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX idx_notification_reads_notification_id ON notification_reads(notification_id);
CREATE INDEX idx_notification_reads_user_id ON notification_reads(user_id);

-- Saved dishes: Household's own dishes, remembered for quick-pick.
CREATE TABLE dishes (
  id TEXT PRIMARY KEY,
  household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
  name TEXT,
  side_dish TEXT,
  meal_type TEXT,
  created_at TIMESTAMPTZ
);
CREATE INDEX idx_dishes_household_id ON dishes(household_id);

CREATE TABLE dish_ingredients (
  id TEXT PRIMARY KEY,
  dish_id TEXT REFERENCES dishes(id) ON DELETE CASCADE,
  name TEXT,
  quantity NUMERIC(10,2),
  unit TEXT,
  category_id TEXT
);
CREATE INDEX idx_dish_ingredients_dish_id ON dish_ingredients(dish_id);

-- Audit log: Who did what and when, for schedules, groceries and members (NFR-010).
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  household_id TEXT REFERENCES households(id) ON DELETE CASCADE,
  actor_id TEXT,
  action TEXT,
  entity TEXT,
  entity_id TEXT,
  details TEXT,
  created_at TIMESTAMPTZ
);
CREATE INDEX idx_audit_log_household_id ON audit_log(household_id);

-- Business-rule constraints
ALTER TABLE household_members ADD CONSTRAINT uq_member UNIQUE (household_id, user_id);
ALTER TABLE daily_meals ADD CONSTRAINT uq_daily_meal UNIQUE (schedule_id, meal_date, meal_type);
ALTER TABLE weekly_schedules ADD CONSTRAINT ck_week_length CHECK (end_date = start_date + 6);
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE weekly_schedules ADD CONSTRAINT no_overlap EXCLUDE USING gist (household_id WITH =, daterange(start_date, end_date, '[]') WITH &&);
CREATE UNIQUE INDEX one_creator_per_household ON household_members(household_id) WHERE role = 'creator' AND membership_status = 'active';
ALTER TABLE notification_reads ADD CONSTRAINT uq_read UNIQUE (notification_id, user_id);
