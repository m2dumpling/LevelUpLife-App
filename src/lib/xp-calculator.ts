/**
 * XP/等级/金币计算引擎
 *
 * 等级曲线: xpToNextLevel = baseXP * level^1.5
 *   Lv 1→2:   100 XP
 *   Lv 2→3:   283 XP
 *   Lv 5→6:  1118 XP
 *   Lv 10→11: 3162 XP
 *   Lv 50→51: 35355 XP
 *
 * 难度奖励:
 *   trivial = 5 XP + 1 Gold
 *   easy    = 10 XP + 3 Gold
 *   medium  = 20 XP + 5 Gold
 *   hard    = 40 XP + 10 Gold
 *   heroic  = 80 XP + 20 Gold
 */

import { MEDAL_RECIPES } from "./shop-data.ts";

type Difficulty = "trivial" | "easy" | "medium" | "hard" | "heroic";

const DIFFICULTY_REWARDS: Record<Difficulty, { xp: number; gold: number }> = {
  trivial: { xp: 5, gold: 1 },
  easy: { xp: 10, gold: 3 },
  medium: { xp: 20, gold: 5 },
  hard: { xp: 40, gold: 10 },
  heroic: { xp: 80, gold: 20 },
};

const BASE_XP = 100;

/** 计算从当前等级升级到下一级所需的 XP */
export function xpForNextLevel(level: number): number {
  return Math.round(BASE_XP * Math.pow(level, 1.5));
}

export function totalXpFromLevelState(level: number, xp: number): number {
  let total = Math.max(0, xp);
  for (let currentLevel = 1; currentLevel < Math.max(1, level); currentLevel++) {
    total += xpForNextLevel(currentLevel);
  }
  return total;
}

export function levelStateFromTotalXp(totalXp: number): { level: number; xp: number; xpToNext: number } {
  let remaining = Math.max(0, Math.floor(totalXp));
  let level = 1;
  let xpToNext = xpForNextLevel(level);

  while (remaining >= xpToNext) {
    remaining -= xpToNext;
    level += 1;
    xpToNext = xpForNextLevel(level);
  }

  return { level, xp: remaining, xpToNext };
}

/** 根据难度获取奖励 */
export function getRewards(difficulty: Difficulty) {
  return DIFFICULTY_REWARDS[difficulty];
}

/** 为任务填充 XP 和金币奖励（创建任务时调用） */
export function fillTaskRewards(
  taskData: Partial<{ xpReward: number; goldReward: number; difficulty: string }>
) {
  const diff = (taskData.difficulty || "easy") as Difficulty;
  return {
    ...taskData,
    xpReward: taskData.xpReward ?? DIFFICULTY_REWARDS[diff].xp,
    goldReward: taskData.goldReward ?? DIFFICULTY_REWARDS[diff].gold,
  };
}

/** 计算已装备奖牌的总 XP 加成倍率（如 1.02 表示 +2%） */
export function getEquippedBonusMultiplier(equippedMedalKeys: string[]): number {
  let multiplier = 1.0;
  for (const key of equippedMedalKeys) {
    const medal = MEDAL_RECIPES.find((m) => m.medalKey === key);
    if (medal) {
      multiplier *= 1 + medal.xpBonusPercent / 100;
    }
  }
  return Math.round(multiplier * 1000) / 1000; // 保留三位小数
}

/** 应用任务完成奖励：计算新的用户状态 */
export function applyRewards(
  currentUser: { xp: number; xpToNext: number; level: number; gold: number; hp: number; hpPenaltyActive?: boolean },
  taskXp: number,
  taskGold: number,
  equippedMedalKeys: string[] = [],
): {
  xp: number;
  xpToNext: number;
  level: number;
  gold: number;
  hp: number;
  leveledUp: boolean;
  levelsGained: number;
  xpEarned: number;
} {
  let { xp, xpToNext, level, gold } = currentUser;
  let leveledUp = false;
  let levelsGained = 0;

  let multiplier = getEquippedBonusMultiplier(equippedMedalKeys);
  // HP 归零惩罚：XP 收益 × 0.9
  if (currentUser.hpPenaltyActive) {
    multiplier *= 0.9;
  }
  const rawXp = taskXp * multiplier;
  const effectiveXp = rawXp > taskXp ? Math.ceil(rawXp) : Math.round(rawXp);

  xp += effectiveXp;
  gold += taskGold;

  // 检查升级
  while (xp >= xpToNext) {
    xp -= xpToNext;
    level += 1;
    levelsGained += 1;
    xpToNext = xpForNextLevel(level);
    leveledUp = true;
  }

  return {
    xp,
    xpToNext,
    level,
    gold,
    hp: currentUser.hp,
    leveledUp,
    levelsGained,
    xpEarned: effectiveXp,
  };
}

/** 计算升级进度百分比 */
export function xpProgressPercent(xp: number, xpToNext: number): number {
  if (xpToNext <= 0) return 100;
  return Math.min(Math.round((xp / xpToNext) * 100), 100);
}
