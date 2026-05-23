import assert from "node:assert/strict";
import { execute, queryOne, queryAll } from "../src/db/connection.ts";
import { tasksDB } from "../src/db/tasks.ts";
import { getTodayLocal, getYesterdayLocal } from "../src/lib/date-utils.ts";

class MemoryStorage {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }
}

Object.defineProperty(globalThis, "localStorage", {
  value: new MemoryStorage(),
  configurable: true,
});

async function run() {
  localStorage.clear();

  await execute(`INSERT INTO habit_log (task_id, completed_at) VALUES (?, ?)`, [101, "2026-05-23"]);

  const byTaskAndDate = await queryOne<{ task_id: number }>(
    `SELECT id FROM habit_log WHERE task_id = ? AND completed_at = ?`,
    [101, "2026-05-23"],
  );
  assert.equal(byTaskAndDate?.task_id, 101, "habit_log lookup must match task_id, not row id");

  const todayRows = await queryAll<{ task_id: number }>(
    `SELECT task_id FROM habit_log WHERE completed_at = ?`,
    ["2026-05-23"],
  );
  assert.deepEqual(todayRows.map((row) => row.task_id), [101]);

  localStorage.clear();
  const today = getTodayLocal();
  const yesterday = getYesterdayLocal();

  await execute(
    `INSERT INTO task (mode, title, description, difficulty, xp_reward, gold_reward,
      frequency, time_of_day, frequency_days, reminder_time, streak_count, best_streak,
      target_date, start_date, end_date, status, completed, completed_at, sort_order, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,0,0,?,?,?,?,?,?,0,?)`,
    [
      "habit",
      "Persisted habit",
      null,
      "easy",
      10,
      5,
      "daily",
      "anytime",
      null,
      null,
      null,
      null,
      "pending",
      1,
      `${today}T08:00:00.000Z`,
      new Date().toISOString(),
    ],
  );

  const [persistedToday] = await tasksDB.getAll();
  assert.equal(persistedToday.completed, true, "habit completed today must survive app restart");

  await execute(`UPDATE task SET completed_at = ? WHERE id = ?`, [`${yesterday}T08:00:00.000Z`, persistedToday.id]);
  const [persistedYesterday] = await tasksDB.getAll();
  assert.equal(persistedYesterday.completed, false, "habit completion must reset on the next Beijing day");
}

run().then(
  () => console.log("habit completion regression passed"),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
