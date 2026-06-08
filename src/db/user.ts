import { queryOne, queryAll, execute, insert } from "./connection.ts";
import { applyRewards } from "../lib/xp-calculator.ts";
import { getTodayLocal, getYesterdayLocal } from "../lib/date-utils.ts";
import { habitMatchesDate } from "../lib/habit-schedule.ts";
import { tasksDB } from "./tasks.ts";

export interface User {
  id: number;
  name: string;
  passwordHash: string;
  level: number;
  xp: number;
  xpToNext: number;
  gold: number;
  hp: number;
  maxHp: number;
  totalDays: number;
  streakDays: number;
  bestStreak: number;
  storyProgress: string;
  hpPenaltyActive: boolean;
  lastSettlementDate: string | null;
  lastLoginDate: string | null;
}

function rowToUser(r: Record<string, unknown>): User {
  return {
    id: r.id as number,
    name: r.name as string,
    passwordHash: r.password_hash as string,
    level: r.level as number,
    xp: r.xp as number,
    xpToNext: r.xp_to_next as number,
    gold: r.gold as number,
    hp: r.hp as number,
    maxHp: r.max_hp as number,
    totalDays: r.total_days as number,
    streakDays: r.streak_days as number,
    bestStreak: r.best_streak as number,
    storyProgress: r.story_progress as string,
    hpPenaltyActive: !!(r.hp_penalty_active as number),
    lastSettlementDate: r.last_settlement_date as string | null,
    lastLoginDate: r.last_login_date as string | null,
  };
}

export const userDB = {
  async get(): Promise<User | null> {
    const row = await queryOne<Record<string, unknown>>("SELECT * FROM user WHERE id = 1");
    return row ? rowToUser(row) : null;
  },

  async create(name: string, passwordHash: string): Promise<User> {
    const now = new Date().toISOString();
    await insert(
      `INSERT INTO user (id, name, password_hash, level, xp, xp_to_next, gold, hp, max_hp,
        total_days, streak_days, best_streak, story_progress, hp_penalty_active, created_at, updated_at)
       VALUES (1, ?, ?, 1, 0, 100, 0, 100, 100, 1, 0, 0, 'chapter_0', 0, ?, ?)`,
      [name, passwordHash, now, now],
    );
    return (await this.get())!;
  },

  async update(data: Partial<Record<string, unknown>>): Promise<void> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = {
      level: "level", xp: "xp", xpToNext: "xp_to_next", gold: "gold",
      hp: "hp", maxHp: "max_hp", totalDays: "total_days", streakDays: "streak_days",
      bestStreak: "best_streak", storyProgress: "story_progress",
      hpPenaltyActive: "hp_penalty_active", lastSettlementDate: "last_settlement_date",
      lastLoginDate: "last_login_date",
    };
    for (const [k, col] of Object.entries(map)) {
      if (data[k] !== undefined) { sets.push(`${col} = ?`); params.push(data[k]); }
    }
    sets.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(1);
    await execute(`UPDATE user SET ${sets.join(", ")} WHERE id = ?`, params);
  },

  async applyReward(user: User, taskXp: number, taskGold: number): Promise<{ leveledUp: boolean; levelsGained: number; level: number; xp: number; xpToNext: number; gold: number; hp: number; xpEarned: number }> {
    const inventory = await queryAll<{ item_key: string; equipped: number }>(
      "SELECT item_key, equipped FROM inventory",
    );
    const keys = inventory.filter((i) => !!i.equipped).map((i) => i.item_key);
    const result = applyRewards(user, taskXp, taskGold, keys);

    await this.update({
      xp: result.xp, xpToNext: result.xpToNext, level: result.level, gold: result.gold, hp: result.hp,
    });

    return result;
  },

  /** HP 每日结算 */
  async dailySettle(): Promise<{ hpLost: number; penaltyApplied: boolean }> {
    const user = await this.get();
    if (!user) return { hpLost: 0, penaltyApplied: false };

    const today = getTodayLocal();
    const yesterday = getYesterdayLocal();
    let currentHp = user.hp;

    if (user.lastLoginDate !== today) {
      currentHp = Math.min(user.maxHp, currentHp + 20);
      await this.update({
        hp: currentHp,
        hpPenaltyActive: currentHp <= 0,
        lastLoginDate: today,
        totalDays: user.totalDays + 1,
      });
    }

    if (!user.lastSettlementDate || user.lastSettlementDate >= yesterday) {
      if (!user.lastSettlementDate) {
        await this.update({ lastSettlementDate: yesterday });
      }
      await import("./progression.ts").then((module) => module.evaluateProgression()).catch(() => []);
      return { hpLost: 0, penaltyApplied: false };
    }

    // 查昨天该做但没做的 habit
    const allTasks = await tasksDB.getAll();
    const habits = allTasks.filter((t) => t.mode === "habit");
    const yesterdayLogs = await queryAll<{ task_id: number }>(
      "SELECT task_id FROM habit_log WHERE completed_at = ?", [yesterday],
    );
    const doneIds = new Set(yesterdayLogs.map((l) => l.task_id));

    const missed = habits.filter((h) => {
      if (h.endDate && h.endDate < yesterday) return false;
      if (h.startDate && h.startDate > yesterday) return false;
      if (!habitMatchesDate(h.frequency, yesterday, h.frequencyDays)) return false;
      return !doneIds.has(h.id);
    });

    const hpLost = Math.min(missed.length * 5, currentHp);
    currentHp -= hpLost;
    const penaltyActive = currentHp <= 0;

    if (hpLost > 0) {
      await this.update({ hp: currentHp, hpPenaltyActive: penaltyActive, lastSettlementDate: yesterday });
    } else {
      await this.update({ lastSettlementDate: yesterday });
    }
    await import("./progression.ts").then((module) => module.evaluateProgression()).catch(() => []);

    return { hpLost, penaltyApplied: penaltyActive };
  },
};
