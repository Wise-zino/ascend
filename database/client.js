/**
 * client.js
 *
 * Opens the SQLite database and applies pending migrations.
 * Uses the modern expo-sqlite async API (expo-sqlite >= 14 / SDK 51+).
 * If you're on an older Expo SDK with the legacy WebSQL-style API,
 * say so and I'll adjust this file -- the migration *statements* in
 * schema.js don't change either way.
 */
import * as SQLite from 'expo-sqlite';
import { MIGRATIONS } from './schema';

const DB_NAME = 'ascend.db';

let dbInstance = null;
let initPromise = null;

/**
 * Returns the open database instance, running migrations on first call.
 * Safe to call multiple times -- subsequent calls reuse the same
 * connection / in-flight init promise.
 */

export async function getDB() {
  if (dbInstance) return dbInstance;
  if (!initPromise) {
    initPromise = initDB();
  }
  dbInstance = await initPromise;
  return dbInstance;
}

async function initDB() {
  const db = await SQLite.openDatabaseAsync(DB_NAME);

  // Recommended pragmas for a mobile app: WAL improves write
  // concurrency/perf, foreign_keys must be turned on explicitly
  // per-connection in SQLite (it's off by default).
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  await runMigrations(db);

  return db;
}

/**
 * Tracks applied migrations in a small internal table, then runs
 * any migration in schema.js whose version hasn't been applied yet.
 * Mirrors Django's migration ledger (django_migrations table).
 */
async function runMigrations(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = await db.getAllAsync(`SELECT version FROM _migrations;`);
  const appliedVersions = new Set(applied.map((row) => row.version));

  const pending = MIGRATIONS.filter((m) => !appliedVersions.has(m.version)).sort(
    (a, b) => a.version - b.version
  );

  for (const migration of pending) {
    await db.withTransactionAsync(async () => {
      for (const statement of migration.statements) {
        await db.execAsync(statement);
      }
      await db.runAsync(`INSERT INTO _migrations (version) VALUES (?);`, [
        migration.version,
      ]);
    });
    console.log(`[db] applied migration v${migration.version}`);
  }
}

/**
 * Convenience helper for atomic multi-statement writes, mirroring
 * Django's `with transaction.atomic():` blocks used in
 * TaskCompletionViewSet.perform_create.
 *
 * Usage:
 *   await withTransaction(async (db) => {
 *     await db.runAsync('INSERT INTO ...', [...]);
 *     await db.runAsync('UPDATE ...', [...]);
 *   });
 */
export async function withTransaction(work) {
  const db = await getDB();
  let result;
  await db.withTransactionAsync(async () => {
    result = await work(db);
  });
  return result;
}

/**
 * Escape hatch for tests / dev tools that need to fully reset local
 * state. Not called anywhere in app code by default.
 */
export async function resetDatabase() {
  const db = await getDB();
  const tables = [
    'weekly_reward',
    'daily_mandatory_tracker',
    'daily_task_completion',
    'daily_task_plan',
    'daily_activity',
    'user_category_stats',
    'task_completions',
    'tasks',
    'categories',
  ];
  await db.withTransactionAsync(async () => {
    for (const table of tables) {
      await db.execAsync(`DELETE FROM ${table};`);
    }
    await db.execAsync(`
      UPDATE user_state SET
        level = 0, experience = 0, total_points = 0, streak_days = 0,
        total_sessions = 0, avg_daily_tasks = 0.0, consistency_score = 0.0,
        reward_experience_gained = 0, penalty_experience_lost = 0,
        last_checked_date = NULL
      WHERE id = 1;
    `);
  });
}
