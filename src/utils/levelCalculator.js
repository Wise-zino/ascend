/**
 * levelCalculator.js
 *
 * Ported from level_calculator.py. Same exponential leveling curve,
 * same weighted scoring (category / activity / extra-curricular /
 * mastery / challenge bonus). Reads/writes go through expo-sqlite
 * against the single-user schema (see db/schema.js) -- every query
 * that had `user=user` in Django is now just unscoped, since there's
 * only ever one of everything.
 *
 * Bug fix applied vs. the original Python (flagging inline since it
 * matters for a mobile/SQLite port):
 *  - calculate_daily_mastery_score: the Python re-queried the DB in
 *    a `while True` loop to build the streak (N+1, one query per day
 *    of streak). Ported here as a single query into a JS Set of date
 *    strings, then a plain in-memory loop -- same result, no
 *    per-day DB hit.
 */

import { getDB } from "../../database/client";

const BASE_EXP = 100;
const GROWTH_RATE = 1.5;

/** 'YYYY-MM-DD' for `date`, defaults to today. */
function toDateStr(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function daysAgoStr(days, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return toDateStr(d);
}

function isoNow() {
  return new Date().toISOString();
}

// Level Calculator Object
export const LevelCalculator = {

    /** Calculates required experience for a given level. */
    experienceForLevel(level) {
        if (level <= 0) return 0;
        return Math.floor(BASE_EXP * Math.pow(GROWTH_RATE, level - 1));
    },

    /* Calculates level from experience */
    calculateLevel(experience) {
        let level = 0;
        while (experience >= LevelCalculator.experienceForLevel(level + 1)) {
            level += 1;
        }
        return level;
    },

    /**
    * Normalized category score with diminishing returns + a bonus
    * for balanced task-type distribution (mandatory/extra/challenge).
    *
    * @param {object} categoryStats - row from user_category_stats
    * @param {number} maxPointsAcrossCategories - precomputed max, passed
    *   in by the caller so we don't re-query per category (see
    *   updateUserExperience below).
    */
    calculateCategoryScore(categoryStats, maxPointsAcrossCategories) {
        /* calculate normalized category score with diminishing returns.
           One category shouldn't dominate
        */
        const maxPoints = maxPointsAcrossCategories > 0 ? maxPointsAcrossCategories : 1;

        // Logarithmic scaling for diminishing returns.
        const normalized = Math.log1p(categoryStats.total_points) / Math.log1p(maxPoints);

        const totalTasks = categoryStats.mandatory_completed + categoryStats.extra_completed + categoryStats.challenges_completed;

        let diversityScore = 0;
        if (totalTasks > 0) {
            const mandatoryRatio = categoryStats.mandatory_completed / totalTasks;
            const extraRatio = categoryStats.extra_completed / totalTasks;
            const challengeRatio = categoryStats.challenges_completed / totalTasks;

            diversityScore = 1 -
                (Math.abs(mandatoryRatio - 0.5) +
                Math.abs(extraRatio - 0.3) +
                Math.abs(challengeRatio - 0.2)) /
                3;
        }

        return normalized * (0.7 + 0.3 * diversityScore);
    },
  
    async calculateActivityScore(days = 30) {
        /** Calculates score based on activity patterns (specifically over the last `days` days) */
        const db = await getDB();
        const startDate = daysAgoStr(days);
        const endDate = toDateStr();
    
        // get daily activities over the past 30 days
        const activities = await db.getAllAsync(
            `SELECT * FROM daily_activity WHERE date BETWEEN ? AND ?;`,
            [startDate, endDate]
        );
    
        if (activities.length === 0) return 0;
    
        // 1. Consistency (streak and frequency)
        const totalDays = days + 1; // gets total days
        const activeDays = activities.length; // gets the total days which i performed those activities
        const consistency = activeDays / totalDays; // calculate consistency
    
        // creates a function for calculating averages
        const avg = (key) =>
            activities.reduce((sum, a) => sum + a[key], 0) / activities.length; 
    
        // 2. Engagement (tasks per active day)
        const avgTasks = avg('tasks_completed'); // calculates the average number of tasks completed over the last 30 days

        // 3. Session quality (points per session)
        const avgPoints = avg('total_points');

        // 4. Login frequency (system engagement)
        const avgLogins = avg('login_count');
    
        // Return the weighted activity score
        return (
            consistency * 0.3 +
            Math.min(avgTasks / 20, 1) * 0.25 + // cap at 20 tasks/day
            Math.min(avgPoints / 100, 1) * 0.25 + // cap at 100 points/day
            Math.min(avgLogins / 3, 1) * 0.2 // cap at 3 logins/day
        ); // 0.3 + 0.25 + 0.25 + 0.2
    },

    /** Reward for doing extra/challenge tasks beyond mandatory ones. */
    async calculateExtraCurricularScore(days = 30) {
        const db = await getDB();
        const startIso = new Date(Date.now() - days * 86400000).toISOString();
        const endIso = isoNow();
    
        const extraRow = await db.getFirstAsync(
            `SELECT COUNT(*) AS cnt
            FROM task_completions tc
            JOIN tasks t ON t.id = tc.task_id
            WHERE tc.completed_at BETWEEN ? AND ?
                AND t.task_type IN ('extra', 'challenge');`,
            [startIso, endIso]
        );
        const mandatoryRow = await db.getFirstAsync(
          `SELECT COUNT(*) AS cnt
           FROM task_completions tc
           JOIN tasks t ON t.id = tc.task_id
           WHERE tc.completed_at BETWEEN ? AND ?
             AND t.task_type = 'mandatory';`,
          [startIso, endIso]
        );
    
        const extraTasks = extraRow?.cnt ?? 0;
        const mandatoryTasks = mandatoryRow?.cnt ?? 0;
        const totalTasks = extraTasks + mandatoryTasks;
    
        if (totalTasks === 0) return 0;
    
        const extraRatio = extraTasks / totalTasks;
        const extraVolume = 1 - Math.exp(-extraTasks / 50); // 50 extra tasks ~= 63%
    
        return extraRatio * 0.6 + extraVolume * 0.4;
    },

    /**
    * Reward for daily consistency + current streak. Also updates
    * user_state.streak_days and consistency_score as a side effect,
    * same as the Python version mutating `user` in place.
    */
    async calculateDailyMasteryScore(days = 30) {
        const db = await getDB();
        const startDate = daysAgoStr(days);
        const endDate = toDateStr();
    
        const rows = await db.getAllAsync(
          `SELECT DISTINCT date(completed_at) AS d
           FROM task_completions
           WHERE date(completed_at) BETWEEN ? AND ?;`,
          [startDate, endDate]
        );
    
        if (rows.length === 0) return 0;
    
        // Fixed vs. the Python original: build a Set once instead of
        // re-querying the DB on every iteration of the streak walk-back.
        const activeDates = new Set(rows.map((r) => r.d));
    
        let currentStreak = 0;
        let cursor = new Date();
        while (true) {
          const cursorStr = toDateStr(cursor);
          if (activeDates.has(cursorStr)) {
            currentStreak += 1;
            cursor.setDate(cursor.getDate() - 1);
          } else {
            break;
          }
        }
    
        const streakScore = 1 - Math.exp(-currentStreak / 14); // 14-day streak ~= 63%
    
        const totalDays = days + 1;
        const activeDaysCount = activeDates.size;
        const consistency = activeDaysCount / totalDays;
    
        await db.runAsync(
          `UPDATE user_state SET streak_days = ?, consistency_score = ? WHERE id = 1;`,
          [currentStreak, consistency]
        );
    
        return streakScore * 0.6 + consistency * 0.4;
    },

    /**
    * Main entry point: recalculates experience gain from the last 30
    * days of activity and applies it, checking for a level-up.
    *
    * Returns { leveledUp, experienceGain, newLevel }.
    */
    async updateUserExperience() {
        const db = await getDB();
    
        // 1. Category contribution (30%)
        const categoryStatsRows = await db.getAllAsync(
          `SELECT * FROM user_category_stats;`
        );
        const maxPoints = categoryStatsRows.reduce(
          (max, s) => Math.max(max, s.total_points),
          0
        );
        let categoryScoreSum = 0;
        for (const stats of categoryStatsRows) {
          categoryScoreSum += LevelCalculator.calculateCategoryScore(stats, maxPoints);
        }
        // Normalize assuming ~3-4 categories, same divisor the Python used.
        const categoryContribution = Math.min(categoryScoreSum / 3, 1.0) * 0.3;
    
        // 2. Activity score (20%)
        const activityContribution = (await LevelCalculator.calculateActivityScore()) * 0.2;
    
        // 3. Extra curricular score (25%)
        const extraContribution =
          (await LevelCalculator.calculateExtraCurricularScore()) * 0.25;
    
        // 4. Daily mastery score (10%)
        const masteryContribution =
          (await LevelCalculator.calculateDailyMasteryScore()) * 0.1;
    
        // 5. Challenge bonus (15%)
        const challengeRow = await db.getFirstAsync(
          `SELECT COALESCE(SUM(challenges_completed), 0) AS total
           FROM user_category_stats;`
        );
        const challengesCompleted = challengeRow?.total ?? 0;
        const challengeBonus = Math.min(challengesCompleted / 100, 0.15); // 100 challenges = max
    
        const experienceMultiplier =
          categoryContribution +
          activityContribution +
          extraContribution +
          masteryContribution +
          challengeBonus;
    
        // Base experience from points earned in the last 30 days.
        const thirtyDaysAgoIso = new Date(Date.now() - 30 * 86400000).toISOString();
        const pointsRow = await db.getFirstAsync(
          `SELECT COALESCE(SUM(points_earned), 0) AS total
           FROM task_completions
           WHERE completed_at >= ?;`,
          [thirtyDaysAgoIso]
        );
        const recentPoints = pointsRow?.total ?? 0;
    
        const baseExperience = recentPoints / 10; // 10 points = 1 base experience
        const experienceGain = baseExperience * experienceMultiplier;
    
        const userRow = await db.getFirstAsync(`SELECT * FROM user_state WHERE id = 1;`);
        const newExperience = userRow.experience + Math.floor(experienceGain);
        const newLevel = LevelCalculator.calculateLevel(newExperience);
        const leveledUp = newLevel > userRow.level;
    
        await db.runAsync(
          `UPDATE user_state SET experience = ?, level = ?, last_active = ? WHERE id = 1;`,
          [newExperience, leveledUp ? newLevel : userRow.level, isoNow()]
        );
    
        return {
          leveledUp,
          experienceGain,
          newLevel: leveledUp ? newLevel : userRow.level,
        };
    },
}