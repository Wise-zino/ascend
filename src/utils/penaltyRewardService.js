/**
 * penaltyRewardService.js
 *
 * Ported from penalty_reward_service.py. The core rule is unchanged:
 * complete ALL mandatory tasks each day or lose 5 XP; complete ALL
 * mandatory tasks for 7 consecutive days and earn +10 XP.
 *
 * The one structural change is how the "end of day" check triggers.
 * Django ran this via a scheduled job checking `current_time.hour >= 23`.
 * There's no reliable background cron on a phone (especially if the
 * app is closed), so instead:
 *
 *   - checkAndUpdateDailyMandatory(date) does the same live count/
 *     tracker-upsert work as before, but never applies the penalty
 *     itself for *today* -- today isn't over yet.
 *   - catchUpMissedDays() is the offline equivalent of the cron: call
 *     it once on app launch (see App.js wiring below). It walks every
 *     date from user_state.last_checked_date+1 up to yesterday,
 *     finalizes each one (applying penalty if mandatory tasks were
 *     incomplete), then updates last_checked_date. This correctly
 *     backfills penalties for days the app was never opened, same as
 *     the cron would have.
 *
 * Bug fix applied vs. the original Python (noted inline):
 *  - `hasattr(tracker, 'penalty_applied')` in _apply_daily_penalty_if_needed
 *    always evaluated truthy once the field existed as a model column,
 *    silently skipping the intended "already applied" guard. Replaced
 *    with an actual value check: `tracker.penalty_applied` truthy.
 */

import { getDB, withTransaction } from "../../database/client";

function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateStr(d);
}

function todayStr() {
  return toDateStr(new Date());
}

/** Monday of the week containing `dateStr` (ISO: Monday = start). */
function weekStartFor(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = dow === 0 ? 6 : dow - 1;
  return addDays(dateStr, -diffToMonday);
}

export const PenaltyRewardService = {
    async checkAndUpdateDailyMandatory(date = todayStr()) {
        const db = await getDB();
    
        // Gets the user's mandatory tasks from daily plan
        const mandatoryPlans = await db.getAllAsync(
          `SELECT dtp.task_id
           FROM daily_task_plan dtp
           JOIN tasks t ON t.id = dtp.task_id
           WHERE dtp.is_active = 1 AND t.task_type = 'mandatory';`
        );
    
        let totalTasks = 0;
        let completedCount = 0;
        let completedAll = true;
    
        if (mandatoryPlans.length > 0) {
          // if you have daily tasks to perform
          totalTasks = mandatoryPlans.length;
          const taskIds = mandatoryPlans.map((p) => p.task_id);
          const placeholders = taskIds.map(() => '?').join(',');
    
          const row = await db.getFirstAsync(
            `SELECT COUNT(*) AS cnt
             FROM daily_task_completion
             WHERE task_id IN (${placeholders}) AND date = ? AND completed = 1;`,
            [...taskIds, date]
          );
          // count how many was actually completed
          completedCount = row?.cnt ?? 0;
          completedAll = completedCount === totalTasks; // you completed all if count matches
        }
        // else: no mandatory tasks configured -> automatically "completed",
        // same as the Python fallback.
    
        // check if a tracker was created for today
        const existing = await db.getFirstAsync(
          `SELECT * FROM daily_mandatory_tracker WHERE date = ?;`,
          [date]
        );
    
        // if a tracker exists for today, update it
        if (existing) {
          await db.runAsync(
            `UPDATE daily_mandatory_tracker
             SET completed_mandatory = ?, mandatory_tasks_count = ?, completed_count = ?
             WHERE date = ?;`,
            [completedAll ? 1 : 0, totalTasks, completedCount, date]
          );
        } else {
          // else create a tracker for today's task
          await db.runAsync(
            `INSERT INTO daily_mandatory_tracker
               (date, completed_mandatory, mandatory_tasks_count, completed_count)
             VALUES (?, ?, ?, ?);`,
            [date, completedAll ? 1 : 0, totalTasks, completedCount]
          );
        }
    
        // return the current tracked data
    
        return db.getFirstAsync(`SELECT * FROM daily_mandatory_tracker WHERE date = ?;`, [
          date,
        ]);
    },
    
    /**
    * Finalizes a single PAST day: applies the -5 XP penalty if
    * mandatory tasks were incomplete and it hasn't already been
    * applied. Safe to call multiple times (idempotent via
    * penalty_applied guard). Only call this for days that have
    * actually ended.
    */
    async _applyDailyPenaltyIfNeeded(date, tracker) {
        if (tracker.mandatory_tasks_count === 0) return null; // return null if the user has no mandatory tasks
        if (tracker.completed_mandatory) return null; // return null if all mandatory tasks has been completed
        if (tracker.penalty_applied) return null; // return null if a penalty has already been given
    
        // apply penalty
        return withTransaction(async (db) => {
          const user = await db.getFirstAsync(`SELECT * FROM user_state WHERE id = 1;`); // get user
          const newExperience = Math.max(0, user.experience - 5); // update XP, don't go below 0
    
          // update user state
          await db.runAsync(
            `UPDATE user_state
             SET experience = ?, penalty_experience_lost = penalty_experience_lost + 5
             WHERE id = 1;`,
            [newExperience]
          );
    
          // update tracker state
          await db.runAsync(
            `UPDATE daily_mandatory_tracker
             SET penalty_applied = 1, penalty_amount = 5
             WHERE date = ?;`,
            [date]
          );
    
          return {
            penaltyApplied: true,
            penaltyAmount: -5,
            newExperience,
            reason: 'failed to complete all mandatory tasks',
            completedCount: tracker.completed_count,
            requiredCount: tracker.mandatory_tasks_count,
          };
        });
    },

    /**
    * Checks whether the 7 days ending on `date` had all mandatory tasks fully
    * completed, and if so awards +10 XP (once per week).
    */
    async checkWeeklyReward(date = todayStr()) {
       const db = await getDB();
       const weekStart = weekStartFor(date);
       const weekEnd = addDays(weekStart, 6);
   
       // check if reward was already earned this week
       const existingReward = await db.getFirstAsync(
         `SELECT * FROM weekly_reward WHERE week_start = ?;`,
         [weekStart]
       );
       if (existingReward?.earned_reward) {
         return null; // already earned this week
       }
   
       // check last seven days (including today)
       let allCompleted = true;
       let anyMandatoryTasksExisted = false;
       const dailyStatus = [];
   
       for (let i = 0; i < 7; i++) {
         const day = addDays(date, -i);
         const tracker = await db.getFirstAsync(
           `SELECT * FROM daily_mandatory_tracker WHERE date = ?;`,
           [day]
         );
   
         let completedAll, completedCount, totalTasks;
         if (tracker) {
           completedAll = !!tracker.completed_mandatory;
           completedCount = tracker.completed_count;
           totalTasks = tracker.mandatory_tasks_count;
         } else {
           // No tracker yet for this date (most likely today) -> check directly
           const result = await PenaltyRewardService._checkMandatoryLive(day);
           completedAll = result.completedAll;
           completedCount = result.completedCount;
           totalTasks = result.totalTasks;
         }
   
         dailyStatus.push({ date: day, completedAll, completedCount, totalTasks });
         if (!completedAll) allCompleted = false;
         if (totalTasks > 0) anyMandatoryTasksExisted = true;
       }

      // A week where the user had zero mandatory tasks configured on
      // every single day is NOT a "perfect streak" -- there was
      // nothing to fail, so there's nothing to reward either. Without
      // this check, a brand-new user with an empty daily plan earns
      // +10 XP for doing nothing at all, which defeats the point of
      // the whole system. (Days that DO have tasks still count
      // normally even if other days in the week had none configured
      // yet -- we only block the reward if NO day had any tasks.)
      if (!anyMandatoryTasksExisted) return null;
   
       if (!allCompleted) return null; // return if not all tasks were completed
   
       return withTransaction(async (db) => {
         const already = await db.getFirstAsync(
           `SELECT * FROM weekly_reward WHERE week_start = ?;`,
           [weekStart]
         ); // qqueries to see if a reward for this week has already been inserted
   
         if (already) {
           // if it exists, simply update it
           await db.runAsync(
             `UPDATE weekly_reward
              SET week_end = ?, earned_reward = 1, earned_at = ?
              WHERE week_start = ?;`,
             [weekEnd, new Date().toISOString(), weekStart]
           );
         } else {
           // if not, create it
           await db.runAsync(
             `INSERT INTO weekly_reward (week_start, week_end, earned_reward, earned_at)
              VALUES (?, ?, 1, ?);`,
             [weekStart, weekEnd, new Date().toISOString()]
           );
   
           // also update user XP
           await db.runAsync(
             `UPDATE user_state
              SET experience = experience + 10,
                  reward_experience_gained = reward_experience_gained + 10
              WHERE id = 1;`
           );
         }
   
         const user = await db.getFirstAsync(`SELECT * FROM user_state WHERE id = 1;`);
   
         return {
           rewardEarned: true,
           rewardAmount: 10,
           newExperience: user.experience,
           weekStart,
           weekEnd,
           dailyStatus,
           message: 'Completed ALL mandatory tasks for 7 consecutive days!',
         };
       });
    },

    /** Live (uncached) mandatory-completion check for an arbitrary date. */
    async _checkMandatoryLive(date) {
        const db = await getDB();
    
        const mandatoryPlans = await db.getAllAsync(
          `SELECT dtp.task_id
           FROM daily_task_plan dtp
           JOIN tasks t ON t.id = dtp.task_id
           WHERE dtp.is_active = 1 AND t.task_type = 'mandatory';`
        );
    
        if (mandatoryPlans.length === 0) {
          return { completedAll: true, completedCount: 0, totalTasks: 0 }; // no maandatory tasks equals automatically completed
        }
    
        const taskIds = mandatoryPlans.map((p) => p.task_id);
        const placeholders = taskIds.map(() => '?').join(',');
    
        const row = await db.getFirstAsync(
          `SELECT COUNT(*) AS cnt
           FROM daily_task_completion
           WHERE task_id IN (${placeholders}) AND date = ? AND completed = 1;`,
          [...taskIds, date]
        );
    
        const completedCount = row?.cnt ?? 0;
        const totalTasks = mandatoryPlans.length;
    
        return {
          completedAll: completedCount === totalTasks,
          completedCount,
          totalTasks,
        };
    },

    /**
    * Offline replacement for the Django 11PM cron. Call once on app
    * launch (and optionally on app foreground). Walks every date from
    * the day after user_state.last_checked_date up through YESTERDAY
    * (today is never finalized -- it's still in progress), applying
    * penalties for incomplete days and checking weekly rewards along
    * the way. Then bumps last_checked_date to yesterday.
    *
    * If last_checked_date is NULL (first run ever), we just seed it to
    * yesterday without walking anything, since there's no prior day to
    * judge.
    *
    * Returns an array of results for days that had a penalty applied
    * or a reward earned, so the UI can surface "you lost 5 XP on
    * <date> while you were away" style notifications if desired.
    */
    async catchUpMissedDays() {
       const db = await getDB();
       const user = await db.getFirstAsync(`SELECT * FROM user_state WHERE id = 1;`);
       const yesterday = addDays(todayStr(), -1);
   
       if (!user.last_checked_date) {
         await db.runAsync(`UPDATE user_state SET last_checked_date = ? WHERE id = 1;`, [
           yesterday,
         ]);
         return [];
       }
   
       if (user.last_checked_date >= yesterday) {
         return []; // already caught up
       }
   
       const results = [];
       let cursor = addDays(user.last_checked_date, 1);
   
       while (cursor <= yesterday) {
         // Finalize this day's mandatory tracker (live count, in case
         // the app was closed before it ever ran for that date).
         const tracker = await PenaltyRewardService.checkAndUpdateDailyMandatory(cursor);
         const penaltyResult = await PenaltyRewardService._applyDailyPenaltyIfNeeded(
           cursor,
           tracker
         );
         if (penaltyResult) {
           results.push({ date: cursor, type: 'penalty', ...penaltyResult });
         }
   
         const rewardResult = await PenaltyRewardService.checkWeeklyReward(cursor);
         if (rewardResult) {
           results.push({ date: cursor, type: 'reward', ...rewardResult });
         }
   
         cursor = addDays(cursor, 1);
       }
   
       await db.runAsync(`UPDATE user_state SET last_checked_date = ? WHERE id = 1;`, [
         yesterday,
       ]);
   
       return results;
    },
}