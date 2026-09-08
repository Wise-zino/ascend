/**
 * taskService.js
 *
 * Ported from the task-completion logic in views.py
 * (TaskCompletionViewSet.perform_create) and DailyTasksViewSet
 * (today_overview, today_tasks, mark_complete).
 *
 * Bug fix carried over from views.py:
 *   - TaskViewSet.get_queryset filtered task_type by category_id
 *     again instead of task_type. Fixed here in getTasks().
 */

import { getDB, withTransaction } from "../../database/client";
import { LevelCalculator } from "./levelCalculator";
import { PenaltyRewardService } from "./penaltyRewardService";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function isoNow() {
  return new Date().toISOString();
}

export const TaskService = {
    /** List active tasks, optionally filtered by category and/or type. */
    async getTasks({ categoryId, taskType } = {}) {
        const db = await getDB();
        let query = `SELECT * FROM tasks WHERE is_active = 1`;
        const params = [];
        if (categoryId) {
          query += ` AND category_id = ?`;
          params.push(categoryId);
        }
        if (taskType) {
          query += ` AND task_type = ?`; // fixed vs. Django original
          params.push(taskType);
        }
        return db.getAllAsync(query, params);
    },

    /**
    * Log a task completion to permanent history, awarding points and
    * triggering XP/level + mandatory tracker recalculation.
    */
    async completeTask(taskId, notes = '') {
        const db = await getDB();
        const task = await db.getFirstAsync(`SELECT * FROM tasks WHERE id = ?;`, [taskId]);
        if (!task) throw new Error('Task not found');
    
        if (task.cooldown_hours > 0) {
          const lastCompletion = await db.getFirstAsync(
            `SELECT * FROM task_completions WHERE task_id = ? ORDER BY completed_at DESC LIMIT 1;`,
            [taskId]
          );
          if (lastCompletion) {
            const cooldownUntil =
              new Date(lastCompletion.completed_at).getTime() + task.cooldown_hours * 3600000;
            if (Date.now() < cooldownUntil) {
              const remainingHours = ((cooldownUntil - Date.now()) / 3600000).toFixed(1);
              throw new Error(`Task is on cooldown for another ${remainingHours}h`);
            }
          }
        }
    
        const difficultyMultiplier = 1 + (task.difficulty - 1) * 0.2;
        const pointsEarned = Math.floor(task.points * difficultyMultiplier);
        const now = isoNow();
        const today = todayStr();
    
        await withTransaction(async (db) => {
          await db.runAsync(
            `INSERT INTO task_completions (task_id, completed_at, notes, points_earned) VALUES (?, ?, ?, ?);`,
            [taskId, now, notes, pointsEarned]
          );
    
          const statsField =
            task.task_type === 'mandatory'
              ? 'mandatory_completed'
              : task.task_type === 'extra'
              ? 'extra_completed'
              : 'challenges_completed';
    
          const existingStats = await db.getFirstAsync(
            `SELECT * FROM user_category_stats WHERE category_id = ?;`,
            [task.category_id]
          );
    
          if (existingStats) {
            await db.runAsync(
              `UPDATE user_category_stats
               SET total_points = total_points + ?, ${statsField} = ${statsField} + 1, last_updated = ?
               WHERE category_id = ?;`,
              [pointsEarned, now, task.category_id]
            );
          } else {
            await db.runAsync(
              `INSERT INTO user_category_stats
                 (category_id, total_points, mandatory_completed, extra_completed, challenges_completed, last_updated)
               VALUES (?, ?, ?, ?, ?, ?);`,
              [
                task.category_id,
                pointsEarned,
                task.task_type === 'mandatory' ? 1 : 0,
                task.task_type === 'extra' ? 1 : 0,
                task.task_type === 'challenge' ? 1 : 0,
                now,
              ]
            );
          }
    
          await db.runAsync(`UPDATE user_state SET total_points = total_points + ? WHERE id = 1;`, [
            pointsEarned,
          ]);
    
          const existingActivity = await db.getFirstAsync(
            `SELECT * FROM daily_activity WHERE date = ?;`,
            [today]
          );
          if (existingActivity) {
            await db.runAsync(
              `UPDATE daily_activity SET tasks_completed = tasks_completed + 1, total_points = total_points + ? WHERE date = ?;`,
              [pointsEarned, today]
            );
          } else {
            await db.runAsync(
              `INSERT INTO daily_activity (date, tasks_completed, total_points, login_count) VALUES (?, 1, ?, 1);`,
              [today, pointsEarned]
            );
          }
        });
    
        // These run their own writes against the shared connection after
        // the completion transaction above has committed (expo-sqlite has
        // no nested-transaction support, and Django's version calls these
        // as plain function calls inside the same atomic() block too, not
        // as separately-nested transactions).
        const levelResult = await LevelCalculator.updateUserExperience();
        await PenaltyRewardService.checkAndUpdateDailyMandatory(today);
        const weeklyReward = await PenaltyRewardService.checkWeeklyReward(today);
    
        const completion = await db.getFirstAsync(
          `SELECT * FROM task_completions WHERE task_id = ? ORDER BY completed_at DESC LIMIT 1;`,
          [taskId]
        );
    
        return { completion, pointsEarned, ...levelResult, weeklyReward };
    },

    /** Today's daily-plan tasks grouped by type, with completion status. */
    async getTodayTasks(date = todayStr()) {
        const db = await getDB();
        const dailyPlans = await db.getAllAsync(
          `SELECT dtp.*, t.name, t.description, t.points, t.difficulty, t.task_type, c.name AS category_name
           FROM daily_task_plan dtp
           JOIN tasks t ON t.id = dtp.task_id
           JOIN categories c ON c.id = t.category_id
           WHERE dtp.is_active = 1;`
        );
    
        const completions = await db.getAllAsync(
          `SELECT task_id, notes, completed_at FROM daily_task_completion WHERE date = ? AND completed = 1;`,
          [date]
        );
        const completionsByTaskId = new Map(completions.map((c) => [c.task_id, c]));
    
        const tasksByType = { mandatory: [], extra: [], challenge: [] };
        for (const plan of dailyPlans) {
          if (!(plan.task_type in tasksByType)) continue;
          const completion = completionsByTaskId.get(plan.task_id);
          const completed = !!completion;
          tasksByType[plan.task_type].push({
            id: plan.id,
            taskId: plan.task_id,
            name: plan.name,
            description: plan.description,
            category: plan.category_name,
            points: plan.points,
            difficulty: plan.difficulty,
            completed,
            isMandatory: !!plan.is_mandatory,
            completionDetails: completed
              ? { completedAt: completion.completed_at, notes: completion.notes }
              : null,
          });
        }
        return { date, tasks: tasksByType };
    },

    /** Summary counts by type (total/completed/pending). */
    async getTodayOverview(date = todayStr()) {
        const { tasks } = await TaskService.getTodayTasks(date);
        const summary = {};
        for (const type of ['mandatory', 'extra', 'challenge']) {
          const list = tasks[type];
          const completed = list.filter((t) => t.completed).length;
          summary[type] = { total: list.length, completed, pending: list.length - completed };
        }
        return { date, summary };
    },

    /** Marks a daily-plan task complete for today (the resettable tracker). */
    async markDailyComplete(taskId, notes = '', date = todayStr()) {
        const db = await getDB();
        const task = await db.getFirstAsync(`SELECT * FROM tasks WHERE id = ?;`, [taskId]);
        if (!task) throw new Error('Task not found');
    
        const plan = await db.getFirstAsync(
          `SELECT * FROM daily_task_plan WHERE task_id = ? AND is_active = 1;`,
          [taskId]
        );
        if (!plan) throw new Error('Task is not in your daily plan');
    
        await db.runAsync(
          `INSERT INTO daily_task_completion (task_id, date, notes, completed_at, completed)
           VALUES (?, ?, ?, ?, 1)
           ON CONFLICT(task_id, date) DO UPDATE SET
             notes = excluded.notes, completed = 1, completed_at = excluded.completed_at;`,
          [taskId, date, notes, isoNow()]
        );
    
        return { status: 'completed', pointsEarned: task.points };
    },
    
    /**
    * Full "check the box" action: daily tracker + permanent log + XP,
    * together. This is what your Goals screen should call on checkbox
    * toggle (mirrors goal.html firing both fetches together).
    */
    async markTaskDoneForToday(taskId, notes = '') {
        const dailyResult = await TaskService.markDailyComplete(taskId, notes);
        const completionResult = await TaskService.completeTask(taskId, notes);
        return { ...dailyResult, ...completionResult };
    },
    
    /** Unmark a daily task (undo a checkbox tick before day rolls over). */
    async unmarkDailyComplete(taskId, date = todayStr()) {
        const db = await getDB();
        await db.runAsync(
          `DELETE FROM daily_task_completion WHERE task_id = ? AND date = ?;`,
          [taskId, date]
        );
        await PenaltyRewardService.checkAndUpdateDailyMandatory(date);
        return { status: 'unmarked' };
    },
  }