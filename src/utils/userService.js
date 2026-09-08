/**
 * userService.js
 *
 * Small wrapper around the single user_state row. Exists mainly so
 * DetailEntry.jsx (and the Info screen) don't need to import
 * `getDB` directly and write raw SQL just to set/read a username.
 */
import { getDB } from "../../database/client";

export const UserService = {
    async getUser(){
        const db = await getDB();
        return db.getFirstAsync(`SELECT * FROM user_state WHERE id = 1;`);
    },

    /**
    * Sets the username in user_state. Called from DetailEntry.jsx
    * alongside the existing AsyncStorage.setItem call -- AsyncStorage
    * stays as the fast-path "have they onboarded at all" check used
    * by index.jsx / routing, while user_state.username becomes the
    * source of truth the rest of the app (Info screen, stats, etc.)
    * reads from.
    */
    async setUsername(username) {
       const trimmed = (username || '').trim();
       if (!trimmed) throw new Error('Username cannot be empty');
   
       const db = await getDB();
       await db.runAsync(`UPDATE user_state SET username = ? WHERE id = 1;`, [trimmed]);
       return db.getFirstAsync(`SELECT * FROM user_state WHERE id = 1;`);
     },

    /**
    * Full stats bundle for the Info screen -- mirrors what
    * info.html reads off `data.*` from UserSerializer.
    */
    async getInfoStats() {
        const db = await getDB();
        const { LevelCalculator } = await import('./levelCalculator');
   
        const user = await db.getFirstAsync(`SELECT * FROM user_state WHERE id = 1;`);
        const nextLevelExp = LevelCalculator.experienceForLevel(user.level + 1);
        const currentLevelExp = LevelCalculator.experienceForLevel(user.level);
        const progress =
            nextLevelExp === currentLevelExp
            ? 1.0
            : (user.experience - currentLevelExp) / (nextLevelExp - currentLevelExp);
   
        return {
            username: user.username,
            total_points: user.total_points,
            experience: user.experience,
            consistency_score: user.consistency_score,
            streak_days: user.streak_days,
            level: user.level,
            progress,
        };
    },
}