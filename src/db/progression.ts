import { execute, queryAll, queryOne } from "./connection.ts";
import { unlock } from "./achievements.ts";

interface UserRow {
  level: number;
  gold: number;
  hp: number;
  streak_days: number;
}

interface TaskRow {
  difficulty: string;
  streak_count: number;
  best_streak: number;
  completed: number;
  status: string;
}

interface InventoryRow {
  item_key: string;
  quantity: number;
}

interface LedgerRow {
  gold_earned: number;
  reversed_at: string | null;
}

interface StoryEventRow {
  id: number;
  trigger_condition: string;
  is_triggered: number;
}

async function unlockIf(key: string, condition: boolean, unlocked: string[]): Promise<void> {
  if (!condition) return;
  await unlock(key);
  unlocked.push(key);
}

function conditionMet(condition: string, user: UserRow, bestStreak: number): boolean {
  const match = condition.match(/^(level|streak_days)\s*>=\s*(\d+)$/);
  if (!match) return false;
  const [, field, rawValue] = match;
  const value = Number(rawValue);
  if (field === "level") return user.level >= value;
  return Math.max(user.streak_days ?? 0, bestStreak) >= value;
}

export async function evaluateProgression(): Promise<string[]> {
  const user = await queryOne<UserRow>("SELECT * FROM user WHERE id = 1");
  if (!user) return [];

  const tasks = await queryAll<TaskRow>("SELECT * FROM task");
  const inventory = await queryAll<InventoryRow>("SELECT * FROM inventory");
  const ledger = await queryAll<LedgerRow>("SELECT * FROM reward_ledger");
  const activeLedger = ledger.filter((row) => !row.reversed_at);
  const totalEarnedGold = activeLedger.reduce((sum, row) => sum + Number(row.gold_earned ?? 0), 0);
  const bestStreak = tasks.reduce((max, task) => Math.max(max, Number(task.best_streak ?? task.streak_count ?? 0)), 0);
  const completedTasks = Math.max(
    activeLedger.length,
    tasks.filter((task) => task.completed || task.status === "completed").length,
  );
  const medalKeys = new Set(inventory.filter((item) => Number(item.quantity ?? 0) > 0 && item.item_key.startsWith("medal_")).map((item) => item.item_key));
  const completedDifficulties = new Set(
    tasks
      .filter((task) => task.completed || task.status === "completed")
      .map((task) => task.difficulty),
  );

  const unlocked: string[] = [];
  await unlockIf("first_quest", completedTasks >= 1, unlocked);
  await unlockIf("task_10", completedTasks >= 10, unlocked);
  await unlockIf("task_50", completedTasks >= 50, unlocked);
  await unlockIf("task_100", completedTasks >= 100, unlocked);
  await unlockIf("streak_3", bestStreak >= 3 || user.streak_days >= 3, unlocked);
  await unlockIf("streak_7", bestStreak >= 7 || user.streak_days >= 7, unlocked);
  await unlockIf("streak_10", bestStreak >= 10 || user.streak_days >= 10, unlocked);
  await unlockIf("streak_30", bestStreak >= 30 || user.streak_days >= 30, unlocked);
  await unlockIf("level_5", user.level >= 5, unlocked);
  await unlockIf("level_10", user.level >= 10, unlocked);
  await unlockIf("level_20", user.level >= 20, unlocked);
  await unlockIf("gold_100", totalEarnedGold >= 100 || user.gold >= 100, unlocked);
  await unlockIf("gold_500", totalEarnedGold >= 500 || user.gold >= 500, unlocked);
  await unlockIf("craft_first", medalKeys.size >= 1, unlocked);
  await unlockIf("craft_all", medalKeys.size >= 5, unlocked);
  await unlockIf("hp_zero", user.hp <= 0, unlocked);
  await unlockIf(
    "all_difficulty",
    ["trivial", "easy", "medium", "hard", "heroic"].every((difficulty) => completedDifficulties.has(difficulty)),
    unlocked,
  );

  const storyEvents = await queryAll<StoryEventRow>("SELECT * FROM story_event ORDER BY sort_order ASC");
  for (const event of storyEvents) {
    if (event.is_triggered) continue;
    if (!conditionMet(event.trigger_condition, user, bestStreak)) continue;
    await execute("UPDATE story_event SET is_triggered = ?, triggered_at = ? WHERE id = ?", [
      1,
      new Date().toISOString(),
      event.id,
    ]);
  }

  return unlocked;
}
