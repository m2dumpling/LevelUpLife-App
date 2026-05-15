import { execute, insert, queryAll } from "./connection.ts";
import { userDB } from "./user.ts";
import type { Task } from "./tasks.ts";
import { applyRewards, levelStateFromTotalXp, totalXpFromLevelState } from "../lib/xp-calculator.ts";
import { getTodayLocal } from "../lib/date-utils.ts";

export interface RewardGrantResult {
  awarded: boolean;
  xpEarned: number;
  goldEarned: number;
  level: number;
  xp: number;
  xpToNext: number;
  gold: number;
  leveledUp: boolean;
  levelsGained: number;
}

export interface RewardRevertResult {
  reverted: boolean;
  xpReverted: number;
  goldReverted: number;
  level: number;
  xp: number;
  xpToNext: number;
  gold: number;
}

interface RewardLedgerRow {
  id: number;
  task_id: number;
  completion_key: string;
  mode: string;
  xp_earned: number;
  gold_earned: number;
  reversed_at: string | null;
}

function completionKeyFor(task: Task, date = getTodayLocal()): string {
  return task.mode === "habit" ? `${task.id}:${date}` : `${task.id}:plan`;
}

async function getOpenLedger(task: Task): Promise<RewardLedgerRow | null> {
  const rows = await queryAll<RewardLedgerRow>(
    "SELECT * FROM reward_ledger WHERE task_id = ? ORDER BY id DESC",
    [task.id],
  );
  const key = completionKeyFor(task);
  return rows.find((row) => !row.reversed_at && (row.completion_key === key || task.mode === "plan")) ?? null;
}

export async function grantTaskReward(task: Task): Promise<RewardGrantResult> {
  const completionKey = completionKeyFor(task);
  const existing = await getOpenLedger(task);
  const user = await userDB.get();
  if (!user) throw new Error("User not found");

  if (existing) {
    return {
      awarded: false,
      xpEarned: existing.xp_earned,
      goldEarned: existing.gold_earned,
      level: user.level,
      xp: user.xp,
      xpToNext: user.xpToNext,
      gold: user.gold,
      leveledUp: false,
      levelsGained: 0,
    };
  }

  const inventory = await queryAll<{ item_key: string; equipped: number }>(
    "SELECT item_key, equipped FROM inventory",
  );
  const equippedKeys = inventory.filter((item) => !!item.equipped).map((item) => item.item_key);
  const result = applyRewards(user, task.xpReward, task.goldReward, equippedKeys);
  await userDB.update({
    xp: result.xp,
    xpToNext: result.xpToNext,
    level: result.level,
    gold: result.gold,
    hp: result.hp,
  });

  await insert(
    `INSERT INTO reward_ledger (
      task_id, completion_key, mode, task_title, base_xp, base_gold,
      xp_earned, gold_earned, level_before, xp_before, xp_to_next_before, gold_before,
      level_after, xp_after, xp_to_next_after, gold_after, completed_date, created_at, reversed_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      task.id,
      completionKey,
      task.mode,
      task.title,
      task.xpReward,
      task.goldReward,
      result.xpEarned,
      task.goldReward,
      user.level,
      user.xp,
      user.xpToNext,
      user.gold,
      result.level,
      result.xp,
      result.xpToNext,
      result.gold,
      getTodayLocal(),
      new Date().toISOString(),
      null,
    ],
  );
  await import("./progression.ts").then((module) => module.evaluateProgression()).catch(() => []);

  return {
    awarded: true,
    xpEarned: result.xpEarned,
    goldEarned: task.goldReward,
    level: result.level,
    xp: result.xp,
    xpToNext: result.xpToNext,
    gold: result.gold,
    leveledUp: result.leveledUp,
    levelsGained: result.levelsGained,
  };
}

export async function revertTaskReward(task: Task): Promise<RewardRevertResult | null> {
  const ledger = await getOpenLedger(task);
  if (!ledger) return null;

  const user = await userDB.get();
  if (!user) throw new Error("User not found");

  const totalXp = totalXpFromLevelState(user.level, user.xp);
  const nextXpState = levelStateFromTotalXp(totalXp - ledger.xp_earned);
  const nextGold = Math.max(0, user.gold - ledger.gold_earned);

  await userDB.update({
    level: nextXpState.level,
    xp: nextXpState.xp,
    xpToNext: nextXpState.xpToNext,
    gold: nextGold,
  });
  await execute("UPDATE reward_ledger SET reversed_at = ? WHERE id = ?", [
    new Date().toISOString(),
    ledger.id,
  ]);
  await import("./progression.ts").then((module) => module.evaluateProgression()).catch(() => []);

  return {
    reverted: true,
    xpReverted: ledger.xp_earned,
    goldReverted: ledger.gold_earned,
    level: nextXpState.level,
    xp: nextXpState.xp,
    xpToNext: nextXpState.xpToNext,
    gold: nextGold,
  };
}
