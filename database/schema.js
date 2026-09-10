/**
 * schema.js
 *
 * SQLite schema for the offline leveling app (Expo / expo-sqlite).
 * Ported from the Django models. Single-user app: instead of a
 * CustomUser table with FKs everywhere, we use one fixed row in
 * `user_state` (id = 1) that holds everything AbstractUser + the
 * custom leveling fields used to.
 *
 * Design notes / mapping from Django -> SQLite:
 * - auto_now / auto_now_add        -> plain TEXT columns set in JS at write time
 * - DateField                      -> TEXT 'YYYY-MM-DD'
 * - DateTimeField                  -> TEXT ISO 8601 ('YYYY-MM-DDTHH:MM:SS.sssZ')
 * - BooleanField                   -> INTEGER (0 / 1)
 * - unique_together                -> UNIQUE(...) constraints
 * - ForeignKey(on_delete=CASCADE)  -> FOREIGN KEY ... ON DELETE CASCADE
 * - No JWT / auth tables needed (single local user, no network auth)
 */

import { version } from "react";

export const SCHEMA_VERSION = 1;

/**
 * Each entry is one migration step. We never edit old entries once
 * shipped -- add a new { version, statements } block instead, the
 * same way you'd add a Django migration file.
 */

export const MIGRATIONS = [
    {
        version: 1,
        statements: [
            `CREATE TABLE IF NOT EXISTS user_state (
                id                       INTEGER PRIMARY KEY CHECK (id = 1),
                username                 TEXT NOT NULL DEFAULT 'Player',
                level                    INTEGER NOT NULL DEFAULT 0,
                experience               INTEGER NOT NULL DEFAULT 0,
                total_points             INTEGER NOT NULL DEFAULT 0,
                streak_days              INTEGER NOT NULL DEFAULT 0,
                last_active              TEXT,

                total_sessions           INTEGER NOT NULL DEFAULT 0,
                avg_daily_tasks          REAL NOT NULL DEFAULT 0.0,
                consistency_score        REAL NOT NULL DEFAULT 0.0,
                reward_experience_gained INTEGER NOT NULL DEFAULT 0,
                penalty_experience_lost  INTEGER NOT NULL DEFAULT 0,

                -- bookkeeping for the offline "catch up on missed days" job
                -- (replaces the Django 11PM-cron penalty check)
                last_checked_date        TEXT,

                created_at               TEXT NOT NULL DEFAULT (datetime('now'))
            )`,
            // Seed the single user row if it doesn't exist yet.
            `INSERT OR IGNORE INTO user_state (id, username) VALUES (1, 'Wise');`,

            // ---------------------------------------------------------------
            // categories
            // ---------------------------------------------------------------
            `CREATE TABLE IF NOT EXISTS categories (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT NOT NULL,
                abbrv       TEXT,
                description TEXT NOT NULL DEFAULT '',
                created_at  TEXT NOT NULL DEFAULT (datetime('now'))
            );`,
            // ---------------------------------------------------------------
            // tasks
            // task_type: 'mandatory' | 'extra' | 'challenge'
            // ---------------------------------------------------------------
            `CREATE TABLE IF NOT EXISTS tasks (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                category_id    INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
                name           TEXT NOT NULL,
                description    TEXT NOT NULL DEFAULT '',
                points         INTEGER NOT NULL DEFAULT 10,
                task_type      TEXT NOT NULL DEFAULT 'mandatory'
                                CHECK (task_type IN ('mandatory', 'extra', 'challenge')),
                is_active      INTEGER NOT NULL DEFAULT 1,
                cooldown_hours INTEGER NOT NULL DEFAULT 0,
                difficulty     INTEGER NOT NULL DEFAULT 1
                                CHECK (difficulty BETWEEN 1 AND 5),
                created_at     TEXT NOT NULL DEFAULT (datetime('now'))
            );`,
            `CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category_id);`,
            `CREATE INDEX IF NOT EXISTS idx_tasks_type_active ON tasks(task_type, is_active);`,
            // ---------------------------------------------------------------
            // task_completions
            // The permanent historical log (never resets). Mirrors
            // TaskCompletion in Django. Cooldown checks and 30-day
            // "recent_points" queries read from this table.
            // ---------------------------------------------------------------
            `CREATE TABLE IF NOT EXISTS task_completions (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id       INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                completed_at  TEXT NOT NULL DEFAULT (datetime('now')),
                notes         TEXT NOT NULL DEFAULT '',
                 points_earned INTEGER NOT NULL
            );`,
            `CREATE INDEX IF NOT EXISTS idx_completions_task ON task_completions(task_id);`,
            `CREATE INDEX IF NOT EXISTS idx_completions_completed_at ON task_completions(completed_at);`,

            // ---------------------------------------------------------------
            // user_category_stats
            // One row per category (single user, so no user FK needed --
            // unique on category_id alone, mirroring unique_together
            // ['user', 'category'] collapsed to just category).
            // ---------------------------------------------------------------
            `CREATE TABLE IF NOT EXISTS user_category_stats (
                id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                category_id          INTEGER NOT NULL UNIQUE REFERENCES categories(id) ON DELETE CASCADE,
                total_points         INTEGER NOT NULL DEFAULT 0,
                mandatory_completed  INTEGER NOT NULL DEFAULT 0,
                extra_completed      INTEGER NOT NULL DEFAULT 0,
                challenges_completed INTEGER NOT NULL DEFAULT 0,
                last_updated         TEXT NOT NULL DEFAULT (datetime('now'))
            );`,

            // ---------------------------------------------------------------
            // daily_activity
            // One row per calendar date (single user -> unique on date alone).
            // ---------------------------------------------------------------
            `CREATE TABLE IF NOT EXISTS daily_activity (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                date             TEXT NOT NULL UNIQUE,
                tasks_completed  INTEGER NOT NULL DEFAULT 0,
                total_points     INTEGER NOT NULL DEFAULT 0,
                session_duration INTEGER NOT NULL DEFAULT 0,
                login_count      INTEGER NOT NULL DEFAULT 1
            );`,
            `CREATE INDEX IF NOT EXISTS idx_daily_activity_date ON daily_activity(date);`,

            // ---------------------------------------------------------------
            // daily_task_plan
            // Which tasks are part of the user's daily routine.
            // unique on task_id alone (single user).
            // ---------------------------------------------------------------
            `CREATE TABLE IF NOT EXISTS daily_task_plan (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id      INTEGER NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
                is_mandatory INTEGER NOT NULL DEFAULT 1,
                is_active    INTEGER NOT NULL DEFAULT 1,
                created_at   TEXT NOT NULL DEFAULT (datetime('now'))
            );`,
            `CREATE INDEX IF NOT EXISTS idx_daily_task_plan_active ON daily_task_plan(is_active);`,

            // ---------------------------------------------------------------
            // daily_task_completion
            // Resets daily. unique on (task_id, date).
            // ---------------------------------------------------------------
            `CREATE TABLE IF NOT EXISTS daily_task_completion (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                date         TEXT NOT NULL,
                notes        TEXT NOT NULL DEFAULT '',
                completed_at TEXT NOT NULL DEFAULT (datetime('now')),
                completed    INTEGER NOT NULL DEFAULT 1,
                UNIQUE(task_id, date)
            );`,
            `CREATE INDEX IF NOT EXISTS idx_daily_task_completion_date ON daily_task_completion(date);`,

            // ---------------------------------------------------------------
            // daily_mandatory_tracker
            // unique on date alone (single user).
            // ---------------------------------------------------------------
            `CREATE TABLE IF NOT EXISTS daily_mandatory_tracker (
                id                    INTEGER PRIMARY KEY AUTOINCREMENT,
                date                  TEXT NOT NULL UNIQUE,
                completed_mandatory   INTEGER NOT NULL DEFAULT 0,
                mandatory_tasks_count INTEGER NOT NULL DEFAULT 0,
                completed_count       INTEGER NOT NULL DEFAULT 0,
                penalty_applied       INTEGER NOT NULL DEFAULT 0,
                penalty_amount        INTEGER NOT NULL DEFAULT 0
            );`,
            `CREATE INDEX IF NOT EXISTS idx_mandatory_tracker_date ON daily_mandatory_tracker(date);`,
            `CREATE INDEX IF NOT EXISTS idx_mandatory_tracker_completed ON daily_mandatory_tracker(date, completed_mandatory);`,

            // ---------------------------------------------------------------
            // weekly_reward
            // unique on week_start alone (single user).
            // ---------------------------------------------------------------
            `CREATE TABLE IF NOT EXISTS weekly_reward (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                week_start        TEXT NOT NULL UNIQUE,
                week_end          TEXT NOT NULL,
                earned_reward     INTEGER NOT NULL DEFAULT 0,
                reward_experience INTEGER NOT NULL DEFAULT 10,
                earned_at         TEXT
            );`,
        ]
    },

    // Future schema changes go here as new { version: 2, statements: [...] }
    // blocks. runMigrations() below applies only the ones not yet applied.
]