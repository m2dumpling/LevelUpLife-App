/**
 * Task CRUD for the local mobile data store.
 */

import { queryAll, queryOne, execute, insert } from "./connection.ts";
import { getDaysAgoLocal, getTodayLocal, getYesterdayLocal } from "../lib/date-utils.ts";
import { fillTaskRewards } from "../lib/xp-calculator.ts";

export interface Task {
  id: number;
  mode: "habit" | "plan";
  title: string;
  description: string | null;
  difficulty: "trivial" | "easy" | "medium" | "hard" | "heroic";
  xpReward: number;
  goldReward: number;
  frequency?: "daily" | "weekly" | "monthly";
  timeOfDay?: "morning" | "afternoon" | "evening" | "anytime";
  frequencyDays?: string | null;
  reminderTime?: string | null;
  streakCount: number;
  bestStreak: number;
  startDate?: string | null;
  endDate?: string | null;
  targetDate: string | null;
  status?: "pending" | "in_progress" | "completed" | "failed";
  completed: boolean;
  completedAt: string | null;
  sortOrder: number;
  createdAt: string;
  newGold?: number;
  rewardReverted?: boolean;
  completedNow?: boolean;
}

function rowToTask(r: Record<string, unknown>): Task {
  return {
    id: r.id as number,
    mode: r.mode as "habit" | "plan",
    title: r.title as string,
    description: r.description as string | null,
    difficulty: (r.difficulty || "easy") as Task["difficulty"],
    xpReward: r.xp_reward as number,
    goldReward: r.gold_reward as number,
    frequency: (r.frequency || "daily") as Task["frequency"],
    timeOfDay: (r.time_of_day || "anytime") as Task["timeOfDay"],
    frequencyDays: r.frequency_days as string | null,
    reminderTime: r.reminder_time as string | null,
    streakCount: (r.streak_count as number) || 0,
    bestStreak: (r.best_streak as number) || 0,
    startDate: r.start_date as string | null,
    endDate: r.end_date as string | null,
    targetDate: r.target_date as string | null,
    status: (r.status || "pending") as Task["status"],
    completed: !!(r.completed as number),
    completedAt: r.completed_at as string | null,
    sortOrder: (r.sort_order as number) || 0,
    createdAt: r.created_at as string,
  };
}

function isTruthyDbValue(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function isDevEnv(): boolean {
  return Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
}

function debugTaskSnapshot(label: string, tasks: Task[]): void {
  if (!isDevEnv()) return;
  console.log(label, tasks.map((t) => ({
    id: t.id,
    title: t.title,
    mode: t.mode,
    targetDate: t.targetDate,
    reminderTime: t.reminderTime,
    status: t.status,
    completed: t.completed,
  })));
}

export const tasksDB = {
  async getAll(): Promise<Task[]> {
    const today = getTodayLocal();

    let rows = await queryAll<Record<string, unknown>>(
      `SELECT * FROM task ORDER BY sort_order ASC`,
    );

    const overduePlanIds = rows
      .filter((r) => {
        const targetDate = typeof r.target_date === "string" ? r.target_date : null;
        return (
          r.mode === "plan" &&
          !isTruthyDbValue(r.completed) &&
          r.status !== "failed" &&
          targetDate !== null &&
          targetDate < today
        );
      })
      .map((r) => r.id as number);

    for (const id of overduePlanIds) {
      await execute(`UPDATE task SET status = ? WHERE id = ?`, ["failed", id]);
    }

    if (overduePlanIds.length > 0) {
      rows = await queryAll<Record<string, unknown>>(
        `SELECT * FROM task ORDER BY sort_order ASC`,
      );
    }

    const todayLogs = await queryAll<{ task_id: number }>(
      `SELECT task_id FROM habit_log WHERE completed_at = ?`,
      [today],
    );
    const todayCompletedIds = new Set(todayLogs.map((l) => l.task_id));

    const tasks = rows.map((r) => {
      const task = rowToTask(r);
      if (task.mode === "habit") {
        task.completed = todayCompletedIds.has(task.id);
      }
      return task;
    });
    debugTaskSnapshot("[Task getAll]", tasks);
    return tasks;
  },

  async repairWronglyFailedPlans(): Promise<number> {
    const today = getTodayLocal();
    const rows = await queryAll<Record<string, unknown>>(
      `SELECT * FROM task ORDER BY sort_order ASC`,
    );
    let repaired = 0;

    for (const r of rows) {
      const targetDate = typeof r.target_date === "string" ? r.target_date : null;
      const shouldRestore =
        r.mode === "plan" &&
        !isTruthyDbValue(r.completed) &&
        r.status === "failed" &&
        (!targetDate || targetDate >= today);

      if (shouldRestore) {
        await execute(`UPDATE task SET status = ? WHERE id = ?`, ["pending", r.id]);
        repaired++;
      }
    }

    if (isDevEnv() && repaired > 0) {
      console.log("[Task repairWronglyFailedPlans]", { repaired });
    }

    return repaired;
  },

  async repairWronglyFailedPlansOnce(): Promise<void> {
    const key = "leveluplife_repair_failed_plans_v1";
    if (localStorage.getItem(key) === "done") return;
    await this.repairWronglyFailedPlans();
    localStorage.setItem(key, "done");
  },

  async create(data: {
    title: string;
    mode: "habit" | "plan";
    description?: string;
    difficulty?: string;
    frequency?: string;
    timeOfDay?: string;
    frequencyDays?: string;
    reminderTime?: string;
    targetDate?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Task> {
    const rewards = fillTaskRewards({ difficulty: data.difficulty || "easy" });
    const now = new Date().toISOString();

    const id = await insert(
      `INSERT INTO task (mode, title, description, difficulty, xp_reward, gold_reward,
        frequency, time_of_day, frequency_days, reminder_time, streak_count, best_streak,
        target_date, start_date, end_date, status, completed, sort_order, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,0,0,?,?,?,?,0,0,?)`,
      [
        data.mode,
        data.title,
        data.description || null,
        data.difficulty || "easy",
        rewards.xpReward,
        rewards.goldReward,
        data.frequency || "daily",
        data.timeOfDay || "anytime",
        data.frequencyDays || null,
        data.reminderTime || null,
        data.targetDate || null,
        data.startDate || null,
        data.endDate || null,
        data.mode === "plan" ? "pending" : "pending",
        now,
      ],
    );

    const task = (await this.getById(id))!;
    if (isDevEnv()) console.log("[Task create]", task);
    return { ...task };
  },

  async getById(id: number): Promise<Task | null> {
    const row = await queryOne<Record<string, unknown>>(`SELECT * FROM task WHERE id = ?`, [id]);
    if (!row) return null;
    const task = rowToTask(row);
    if (task.mode === "habit") {
      const today = getTodayLocal();
      const log = await queryOne(`SELECT id FROM habit_log WHERE task_id = ? AND completed_at = ?`, [id, today]);
      task.completed = !!log;
    }
    return task;
  },

  async update(id: number, data: Record<string, unknown>): Promise<Task | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const sets: string[] = [];
    const params: unknown[] = [];

    if (data.title !== undefined) { sets.push("title = ?"); params.push(data.title); }
    if (data.description !== undefined) { sets.push("description = ?"); params.push(data.description); }
    if (data.difficulty !== undefined) {
      sets.push("difficulty = ?"); params.push(data.difficulty);
      if (!existing.completed) {
        const rewards = fillTaskRewards({ difficulty: data.difficulty as string });
        sets.push("xp_reward = ?"); params.push(rewards.xpReward);
        sets.push("gold_reward = ?"); params.push(rewards.goldReward);
      }
    }
    if (data.frequency !== undefined) { sets.push("frequency = ?"); params.push(data.frequency); }
    if (data.timeOfDay !== undefined) { sets.push("time_of_day = ?"); params.push(data.timeOfDay); }
    if (data.frequencyDays !== undefined) { sets.push("frequency_days = ?"); params.push(data.frequencyDays || null); }
    if (data.reminderTime !== undefined) { sets.push("reminder_time = ?"); params.push(data.reminderTime || null); }
    if (data.startDate !== undefined) { sets.push("start_date = ?"); params.push(data.startDate); }
    if (data.endDate !== undefined) { sets.push("end_date = ?"); params.push(data.endDate); }
    if (data.targetDate !== undefined) { sets.push("target_date = ?"); params.push(data.targetDate); }
    if (data.status !== undefined) { sets.push("status = ?"); params.push(data.status); }
    else if (existing.mode === "plan" && !existing.completed) { sets.push("status = ?"); params.push("pending"); }
    if (data.sortOrder !== undefined) { sets.push("sort_order = ?"); params.push(data.sortOrder); }

    if (sets.length === 0) return this.getById(id);

    params.push(id);
    await execute(`UPDATE task SET ${sets.join(", ")} WHERE id = ?`, params);

    const result = await this.getById(id);
    if (isDevEnv()) console.log("[Task update]", result);
    return result;
  },

  async complete(taskId: number): Promise<Task | null> {
    const task = await this.getById(taskId);
    if (!task) return null;
    const today = getTodayLocal();

    if (task.mode === "habit") {
      const existing = await queryOne(`SELECT id FROM habit_log WHERE task_id = ? AND completed_at = ?`, [taskId, today]);
      if (existing) return { ...task, completedNow: false };

      await execute(`INSERT INTO habit_log (task_id, completed_at) VALUES (?, ?)`, [taskId, today]);

      const yesterday = getYesterdayLocal();
      const yesterdayLog = await queryOne(`SELECT id FROM habit_log WHERE task_id = ? AND completed_at = ?`, [taskId, yesterday]);
      const newStreak = yesterdayLog ? task.streakCount + 1 : 1;
      const newBest = Math.max(newStreak, task.bestStreak);

      await execute(`UPDATE task SET streak_count = ?, best_streak = ? WHERE id = ?`, [newStreak, newBest, taskId]);

      task.completed = true;
      task.streakCount = newStreak;
      task.bestStreak = newBest;
      task.completedNow = true;
      return task;
    }

    if (task.mode === "plan") {
      if (task.completed || task.status === "completed") return { ...task, completedNow: false };
      if (task.targetDate && task.targetDate !== today) return null;

      const now = new Date().toISOString();
      await execute(`UPDATE task SET completed = 1, completed_at = ?, status = 'completed' WHERE id = ?`, [now, taskId]);
      task.completed = true;
      task.completedAt = now;
      task.status = "completed";
      task.completedNow = true;
      return task;
    }

    return task;
  },

  async uncomplete(taskId: number): Promise<Task | null> {
    const task = await this.getById(taskId);
    if (!task) return null;
    const rewardReverted = task.completed;
    const today = getTodayLocal();

    if (task.mode === "habit") {
      if (!task.completed) return { ...task, rewardReverted: false };
      await execute(`DELETE FROM habit_log WHERE task_id = ? AND completed_at = ?`, [taskId, today]);

      const allLogs = await queryAll<{ completed_at: string }>(`SELECT completed_at FROM habit_log WHERE task_id = ?`, [taskId]);
      const dates = new Set(allLogs.map((l) => l.completed_at));
      let streak = 0;
      while (dates.has(getDaysAgoLocal(streak + 1))) streak++;
      await execute(`UPDATE task SET streak_count = ? WHERE id = ?`, [streak, taskId]);
      task.completed = false;
      task.streakCount = streak;
      task.rewardReverted = rewardReverted;
      return task;
    }

    if (task.mode === "plan") {
      if (!task.completed) return { ...task, rewardReverted: false };
      await execute(`UPDATE task SET completed = 0, completed_at = NULL, status = 'in_progress' WHERE id = ?`, [taskId]);
      task.completed = false;
      task.completedAt = null;
      task.status = "in_progress";
      task.rewardReverted = rewardReverted;
    }

    return task;
  },

  async remove(taskId: number): Promise<void> {
    await execute(`DELETE FROM habit_log WHERE task_id = ?`, [taskId]);
    await execute(`DELETE FROM task WHERE id = ?`, [taskId]);
  },
};
