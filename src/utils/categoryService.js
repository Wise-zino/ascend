/**
 * categoryService.js
 *
 * There's no Django admin equivalent on-device, so this service is
 * what the new "Manage Tasks" screen calls to create/edit/delete
 * categories and tasks, and to add/remove tasks from the daily plan.
 * Straightforward CRUD -- no scoring logic lives here.
 *
 * Deletion behavior: categories/tasks CASCADE via the FKs in
 * schema.js (ON DELETE CASCADE + PRAGMA foreign_keys = ON in
 * client.js), so deleting a category also removes its tasks, their
 * completions, stats, and daily plan entries. deleteTask() and
 * deleteCategory() both warn about this in their return value so the
 * UI can confirm with the user before calling.
 */

import { getDB } from "../../database/client";

export const CategoryService = {
    // ---------------------------------------------------------------
    // Categories
    // ---------------------------------------------------------------
    async getCategories() {
        const db = await getDB();
        return db.getAllAsync(`SELECT * FROM categories ORDER BY name;`);
    },

    async getCategory(categoryId) {
        const db = await getDB();
        return db.getFirstAsync(`SELECT * FROM categories WHERE id = ?;`, [categoryId]);
    },

    /**
    * @param {object} params
    * @param {string} params.name
    * @param {string} [params.abbrv] - short label, e.g. "COD" for Coding
    * @param {string} [params.description]
    */
    async createCategory({ name, abbrv = null, description = '' }) {
        if (!name || !name.trim()) throw new Error('Category name is required');
    
        const db = await getDB();
        const result = await db.runAsync(
          `INSERT INTO categories (name, abbrv, description) VALUES (?, ?, ?);`,
          [name.trim(), abbrv ? abbrv.trim().slice(0, 5) : null, description]
        );
        return db.getFirstAsync(`SELECT * FROM categories WHERE id = ?;`, [
          result.lastInsertRowId,
        ]);
    },

    async updateCategory(categoryId, { name, abbrv, description }) {
        const db = await getDB();
        const existing = await CategoryService.getCategory(categoryId);
        if (!existing) throw new Error('Category not found');
    
        await db.runAsync(
          `UPDATE categories SET name = ?, abbrv = ?, description = ? WHERE id = ?;`,
          [
            name?.trim() ?? existing.name,
            abbrv !== undefined ? (abbrv ? abbrv.trim().slice(0, 5) : null) : existing.abbrv,
            description ?? existing.description,
            categoryId,
          ]
        );
        return db.getFirstAsync(`SELECT * FROM categories WHERE id = ?;`, [categoryId]);
    },

    /**
    * Deletes a category and (via ON DELETE CASCADE) everything under
    * it: its tasks, their completion history, category stats, and
    * daily plan entries. Returns a count of affected tasks so the UI
    * can show a confirmation like "This will also delete 4 tasks."
    */
    async deleteCategory(categoryId) {
        const db = await getDB();
        const taskCountRow = await db.getFirstAsync(
          `SELECT COUNT(*) AS cnt FROM tasks WHERE category_id = ?;`,
          [categoryId]
        );
        await db.runAsync(`DELETE FROM categories WHERE id = ?;`, [categoryId]);
        return { deleted: true, tasksRemoved: taskCountRow?.cnt ?? 0 };
    },

    // ---------------------------------------------------------------
    // Tasks
    // ---------------------------------------------------------------
    async getAllTasks() {
        const db = await getDB();
        return db.getAllAsync(
          `SELECT t.*, c.name AS category_name
           FROM tasks t
           JOIN categories c ON c.id = t.category_id
           ORDER BY c.name, t.name;`
        );
    },

    async getTask(taskId) {
        const db = await getDB();
        return db.getFirstAsync(`SELECT * FROM tasks WHERE id = ?;`, [taskId]);
    },

    /**
    * @param {object} params
    * @param {number} params.categoryId
    * @param {string} params.name
    * @param {string} [params.description]
    * @param {number} [params.points]           default 10
    * @param {'mandatory'|'extra'|'challenge'} [params.taskType] default 'mandatory'
    * @param {number} [params.cooldownHours]     default 0
    * @param {number} [params.difficulty]        1-5, default 1
    */
    async createTask({
        categoryId,
        name,
        description = '',
        points = 10,
        taskType = 'mandatory',
        cooldownHours = 0,
        difficulty = 1,
    }) {
        if (!categoryId) throw new Error('categoryId is required');
        if (!name || !name.trim()) throw new Error('Task name is required');
        if (!['mandatory', 'extra', 'challenge'].includes(taskType)) {
          throw new Error(`Invalid task_type: ${taskType}`);
        }
        if (difficulty < 1 || difficulty > 5) {
          throw new Error('Difficulty must be between 1 and 5');
        }
    
        const db = await getDB();
        const result = await db.runAsync(
          `INSERT INTO tasks (category_id, name, description, points, task_type, cooldown_hours, difficulty)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [categoryId, name.trim(), description, points, taskType, cooldownHours, difficulty]
        );
        return db.getFirstAsync(`SELECT * FROM tasks WHERE id = ?;`, [result.lastInsertRowId]);
    },

    async updateTask(taskId, updates) {
        const db = await getDB();
        const existing = await CategoryService.getTask(taskId);
        if (!existing) throw new Error('Task not found');
    
        const merged = {
          category_id: updates.categoryId ?? existing.category_id,
          name: updates.name?.trim() ?? existing.name,
          description: updates.description ?? existing.description,
          points: updates.points ?? existing.points,
          task_type: updates.taskType ?? existing.task_type,
          is_active: updates.isActive !== undefined ? (updates.isActive ? 1 : 0) : existing.is_active,
          cooldown_hours: updates.cooldownHours ?? existing.cooldown_hours,
          difficulty: updates.difficulty ?? existing.difficulty,
        };
    
        await db.runAsync(
          `UPDATE tasks SET category_id = ?, name = ?, description = ?, points = ?,
             task_type = ?, is_active = ?, cooldown_hours = ?, difficulty = ?
           WHERE id = ?;`,
          [
            merged.category_id,
            merged.name,
            merged.description,
            merged.points,
            merged.task_type,
            merged.is_active,
            merged.cooldown_hours,
            merged.difficulty,
            taskId,
          ]
        );
        return db.getFirstAsync(`SELECT * FROM tasks WHERE id = ?;`, [taskId]);
    },

    /**
    * Soft-delete: sets is_active = 0 instead of removing the row, so
    * historical task_completions (which reference task_id) keep their
    * name/category/points intact for past stats. This mirrors Django's
    * Task.is_active flag, which the queryset filters (`is_active=True`)
    * everywhere it lists tasks.
    */
    async deactivateTask(taskId) {
        const db = await getDB();
        await db.runAsync(`UPDATE tasks SET is_active = 0 WHERE id = ?;`, [taskId]);
        // Also pull it out of the daily plan so it stops showing on Goals.
        await db.runAsync(`UPDATE daily_task_plan SET is_active = 0 WHERE task_id = ?;`, [
          taskId,
        ]);
        return { deactivated: true };
    },
    
    async reactivateTask(taskId) {
        const db = await getDB();
        await db.runAsync(`UPDATE tasks SET is_active = 1 WHERE id = ?;`, [taskId]);
        return { reactivated: true };
    },

    /**
    * Hard delete -- actually removes the task and (via CASCADE) its
    * completion history, daily plan entry, and any category stats
    * that reference only it. Prefer deactivateTask() unless the user
    * explicitly wants history gone too; surface that distinction in
    * the UI (e.g. "Archive" vs. "Delete Permanently").
    */
    async deleteTask(taskId) {
        const db = await getDB();
        const completionCountRow = await db.getFirstAsync(
          `SELECT COUNT(*) AS cnt FROM task_completions WHERE task_id = ?;`,
          [taskId]
        );
        await db.runAsync(`DELETE FROM tasks WHERE id = ?;`, [taskId]);
        return { deleted: true, completionsRemoved: completionCountRow?.cnt ?? 0 };
    },

    // ---------------------------------------------------------------
    // Daily plan (which tasks show up on the Goals screen each day)
    // ---------------------------------------------------------------
    async getDailyPlan() {
        const db = await getDB();
        return db.getAllAsync(
          `SELECT dtp.*, t.name, t.task_type, t.points, c.name AS category_name
           FROM daily_task_plan dtp
           JOIN tasks t ON t.id = dtp.task_id
           JOIN categories c ON c.id = t.category_id
           WHERE dtp.is_active = 1
           ORDER BY dtp.created_at;`
        );
    },

    async addToDailyPlan(taskId, isMandatory = true) {
        const db = await getDB();
        await db.runAsync(
          `INSERT INTO daily_task_plan (task_id, is_mandatory, is_active)
           VALUES (?, ?, 1)
           ON CONFLICT(task_id) DO UPDATE SET is_mandatory = excluded.is_mandatory, is_active = 1;`,
          [taskId, isMandatory ? 1 : 0]
        );
        return { added: true };
    },
    
    async removeFromDailyPlan(taskId) {
        const db = await getDB();
        await db.runAsync(`UPDATE daily_task_plan SET is_active = 0 WHERE task_id = ?;`, [
          taskId,
        ]);
        return { removed: true };
    },
}