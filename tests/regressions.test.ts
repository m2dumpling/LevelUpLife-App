import assert from "node:assert/strict";
import fs from "node:fs";

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

Object.defineProperty(globalThis, "localStorage", {
  value: new MemoryStorage(),
  configurable: true,
});

{
  const configureScript = fs.readFileSync("scripts/configure-android.mjs", "utf8");
  assert.match(configureScript, /super\.onCreate\(savedInstanceState\);\s*WindowCompat\.enableEdgeToEdge\(getWindow\(\)\)/);
  assert.match(configureScript, /registerPlugin\(NativeUiPlugin\.class\)/);
  assert.match(configureScript, /class NativeUiPlugin extends Plugin/);
  assert.doesNotMatch(configureScript, /setDecorFitsSystemWindows/);
  assert.match(configureScript, /implementation "androidx\.core:core:\$androidxCoreVersion"/);
  const nativeUi = fs.readFileSync("src/lib/native-ui.ts", "utf8");
  assert.match(nativeUi, /registerPlugin<NativeUiPlugin>\("NativeUi"\)/);
  assert.match(nativeUi, /setSystemBarsBackground/);
  assert.match(nativeUi, /--app-native-safe-top/);
  assert.match(nativeUi, /Math\.min\(info\.height,\s*36\)/);
  const css = fs.readFileSync("src/index.css", "utf8");
  assert.match(css, /--app-native-safe-top:\s*0px/);
  assert.match(css, /height:\s*max\(env\(safe-area-inset-top,\s*0px\),\s*var\(--app-native-safe-top\)\)/);
}

const connection = await import("../src/db/connection.ts");
const shop = await import("../src/db/shop.ts");
const { tasksDB } = await import("../src/db/tasks.ts");
const { userDB } = await import("../src/db/user.ts");
const rewards = await import("../src/db/rewards.ts");
const achievements = await import("../src/db/achievements.ts");
const progression = await import("../src/db/progression.ts");
const { addLog, getLogs } = await import("../src/db/logs.ts");
const {
  buildTaskNotification,
  getNotificationId,
  getNotificationIdByTask,
  TASK_REMINDER_CHANNEL_ID,
} = await import("../src/notifications.ts");
const { getDaysFromTodayLocal, getTodayLocal } = await import("../src/lib/date-utils.ts");
const { execute, queryAll, queryOne, saveTable } = connection;

function resetTables(gold = 20): void {
  localStorage.clear();
  saveTable("user", [{
    id: 1,
    name: "Tester",
    password_hash: "hash",
    level: 1,
    xp: 0,
    xp_to_next: 100,
    gold,
    hp: 100,
    max_hp: 100,
    total_days: 1,
    streak_days: 0,
    best_streak: 0,
    story_progress: "chapter_0",
    hp_penalty_active: 0,
    last_settlement_date: null,
    last_login_date: null,
    created_at: "now",
    updated_at: "now",
  }]);
  saveTable("task", []);
  saveTable("habit_log", []);
  saveTable("inventory", []);
  saveTable("activity_log", []);
  saveTable("reward_ledger", []);
  saveTable("achievement", []);
  saveTable("story_event", []);
}

function taskFixture(overrides: Partial<Awaited<ReturnType<typeof tasksDB.create>>> = {}) {
  return {
    id: 7,
    mode: "plan" as const,
    title: "Reminder",
    description: null,
    difficulty: "easy" as const,
    xpReward: 10,
    goldReward: 3,
    frequency: "daily" as const,
    timeOfDay: "anytime" as const,
    frequencyDays: null,
    reminderTime: "17:30",
    streakCount: 0,
    bestStreak: 0,
    startDate: null,
    endDate: null,
    targetDate: "2026-05-13",
    status: "pending" as const,
    completed: false,
    completedAt: null,
    sortOrder: 0,
    createdAt: "now",
    ...overrides,
  };
}

{
  const plan = taskFixture({ id: 8, mode: "plan" });
  const habit = taskFixture({ id: 8, mode: "habit", targetDate: null });
  assert.equal(getNotificationId(plan), 10008);
  assert.equal(getNotificationId(habit), 8);
  assert.equal(getNotificationIdByTask(8, "plan"), 10008);
  assert.equal(getNotificationIdByTask(8, "habit"), 8);
}

{
  const decision = buildTaskNotification(taskFixture(), {
    now: new Date(2026, 4, 13, 17, 25, 20, 400),
    today: "2026-05-13",
  });

  assert.equal(decision.shouldSchedule, true);
  assert.equal(decision.notification?.id, 10007);
  assert.equal(decision.notification?.channelId, TASK_REMINDER_CHANNEL_ID);
  assert.equal(decision.notification?.schedule?.allowWhileIdle, true);
  assert.deepEqual(decision.notification?.extra, {
    taskId: 7,
    mode: "plan",
    targetDate: "2026-05-13",
    reminderTime: "17:30",
  });
  assert.equal(decision.computedAt?.getFullYear(), 2026);
  assert.equal(decision.computedAt?.getMonth(), 4);
  assert.equal(decision.computedAt?.getDate(), 13);
  assert.equal(decision.computedAt?.getHours(), 17);
  assert.equal(decision.computedAt?.getMinutes(), 30);
  assert.equal(decision.computedAt?.getSeconds(), 0);
  assert.equal(decision.computedAt?.getMilliseconds(), 0);
}

{
  const now = new Date(2026, 4, 13, 17, 31, 0, 0);
  const today = "2026-05-13";
  assert.equal(buildTaskNotification(taskFixture({ completed: true }), { now, today }).skipReason, "completed-plan");
  assert.equal(buildTaskNotification(taskFixture({ status: "failed" }), { now, today }).skipReason, "status-failed");
  assert.equal(buildTaskNotification(taskFixture({ targetDate: "2026-05-12" }), { now, today }).skipReason, "plan-overdue");
  assert.equal(buildTaskNotification(taskFixture({ reminderTime: "17:30" }), { now, today }).skipReason, "plan-time-past");
  assert.equal(buildTaskNotification(taskFixture({ targetDate: null }), { now, today }).skipReason, "plan-missing-target-date");
}

{
  const decision = buildTaskNotification(taskFixture({
    mode: "habit",
    completed: true,
    targetDate: null,
    reminderTime: "09:00",
  }), {
    now: new Date(2026, 4, 13, 10, 0, 0, 0),
    today: "2026-05-13",
  });

  assert.equal(decision.shouldSchedule, true);
  assert.equal(decision.skipReason, "habit-completed-today-scheduled-next");
  assert.equal(decision.computedAt?.getDate(), 14);
  assert.equal(decision.notification?.schedule?.repeats, true);
  assert.equal(decision.notification?.schedule?.every, "day");
}

{
  const decision = buildTaskNotification(taskFixture({
    mode: "habit",
    targetDate: null,
    frequency: "weekly",
    frequencyDays: "5",
    reminderTime: "08:00",
  }), {
    now: new Date(2026, 4, 13, 10, 0, 0, 0),
    today: "2026-05-13",
  });

  assert.equal(decision.shouldSchedule, true);
  assert.equal(decision.computedAt?.getDay(), 5);
  assert.equal(decision.notification?.schedule?.repeats, undefined);
}

{
  resetTables(20);

  await execute("UPDATE user SET gold = gold - ?, updated_at = ? WHERE id = 1", [
    10,
    "now",
  ]);

  const user = await queryOne<{ gold: number; updated_at: string }>(
    "SELECT * FROM user WHERE id = 1",
  );
  assert.equal(user?.gold, 10);
  assert.equal(user?.updated_at, "now");
}

{
  resetTables(20);

  const result = await shop.buyOre("ore_copper");
  const user = await queryOne<{ gold: number }>("SELECT * FROM user WHERE id = 1");
  const ore = await queryOne<{ quantity: number }>(
    "SELECT * FROM inventory WHERE item_key = ?",
    ["ore_copper"],
  );

  assert.equal(result?.gold, 10);
  assert.equal(user?.gold, 10);
  assert.equal(ore?.quantity, 1);
}

{
  resetTables(20);
  saveTable("task", [
    {
      id: 1,
      mode: "plan",
      title: "Today reminder",
      description: null,
      difficulty: "easy",
      xp_reward: 10,
      gold_reward: 3,
      frequency: "daily",
      time_of_day: "anytime",
      frequency_days: null,
      reminder_time: "23:59",
      streak_count: 0,
      best_streak: 0,
      target_date: getTodayLocal(),
      start_date: null,
      end_date: null,
      status: "pending",
      completed: 0,
      sort_order: 0,
      created_at: "now",
    },
  ]);

  await execute(
    "UPDATE task SET status = 'failed' WHERE mode = 'plan' AND completed = 0 AND target_date < ?",
    [getTodayLocal()],
  );

  const rows = await queryAll<{ status: string }>("SELECT * FROM task");
  assert.equal(rows[0].status, "pending");
}

{
  resetTables(20);

  const todayPlan = await tasksDB.create({
    title: "Today with reminder",
    mode: "plan",
    targetDate: getTodayLocal(),
    reminderTime: "23:59",
  });
  const tomorrowPlan = await tasksDB.create({
    title: "Tomorrow with reminder",
    mode: "plan",
    targetDate: getDaysFromTodayLocal(1),
    reminderTime: "08:30",
  });
  const yesterdayPlan = await tasksDB.create({
    title: "Yesterday",
    mode: "plan",
    targetDate: getDaysFromTodayLocal(-1),
  });
  await tasksDB.create({
    title: "Habit should not fail",
    mode: "habit",
    reminderTime: "09:00",
  });

  const tasks = await tasksDB.getAll();
  const byId = new Map(tasks.map((task) => [task.id, task]));
  assert.equal(byId.get(todayPlan.id)?.status, "pending");
  assert.equal(byId.get(tomorrowPlan.id)?.status, "pending");
  assert.equal(byId.get(yesterdayPlan.id)?.status, "failed");
  assert.equal(tasks.find((task) => task.mode === "habit")?.status, "pending");
}

{
  resetTables(20);
  const plan = await tasksDB.create({
    title: "Failed by old bug",
    mode: "plan",
    targetDate: getDaysFromTodayLocal(1),
    reminderTime: "08:30",
  });
  await execute("UPDATE task SET status = ? WHERE id = ?", ["failed", plan.id]);

  const edited = await tasksDB.update(plan.id, { reminderTime: "09:45", targetDate: getDaysFromTodayLocal(2) });
  assert.equal(edited?.status, "pending");
  assert.equal(edited?.targetDate, getDaysFromTodayLocal(2));
  assert.equal(edited?.reminderTime, "09:45");
}

{
  resetTables(20);
  const restore = await tasksDB.create({
    title: "Restore future",
    mode: "plan",
    targetDate: getDaysFromTodayLocal(1),
  });
  const keepFailed = await tasksDB.create({
    title: "Keep real overdue",
    mode: "plan",
    targetDate: getDaysFromTodayLocal(-1),
  });
  await execute("UPDATE task SET status = ? WHERE id = ?", ["failed", restore.id]);
  await execute("UPDATE task SET status = ? WHERE id = ?", ["failed", keepFailed.id]);

  const repaired = await tasksDB.repairWronglyFailedPlans();
  assert.equal(repaired, 1);
  assert.equal((await tasksDB.getById(restore.id))?.status, "pending");
  assert.equal((await tasksDB.getById(keepFailed.id))?.status, "failed");
}

{
  resetTables(20);

  const futurePlan = await tasksDB.create({
    title: "Future plan",
    mode: "plan",
    targetDate: getDaysFromTodayLocal(1),
  });
  assert.equal(await tasksDB.complete(futurePlan.id), null);

  const todayPlan = await tasksDB.create({
    title: "Today plan",
    mode: "plan",
    targetDate: getTodayLocal(),
    difficulty: "easy",
  });
  const completed = await tasksDB.complete(todayPlan.id);
  assert.equal(completed?.completed, true);
  assert.equal(completed?.status, "completed");

  const beforeReward = await userDB.get();
  const reward = await userDB.applyReward(beforeReward!, completed!.xpReward, completed!.goldReward);
  assert.equal(reward.gold, 23);

  const undone = await tasksDB.uncomplete(todayPlan.id);
  assert.equal(undone?.completed, false);
  assert.equal(undone?.rewardReverted, true);
  const userAfterUndo = await userDB.get();
  await userDB.update({ gold: Math.max(0, userAfterUndo!.gold - undone!.goldReward) });
  assert.equal((await userDB.get())?.gold, 20);
}

{
  resetTables(20);
  const habit = await tasksDB.create({
    title: "Read once",
    mode: "habit",
    difficulty: "easy",
  });

  const first = await tasksDB.complete(habit.id);
  assert.equal(first?.completedNow, true);
  const firstReward = await rewards.grantTaskReward(first!);
  assert.equal(firstReward.awarded, true);

  const second = await tasksDB.complete(habit.id);
  assert.equal(second?.completedNow, false);
  const secondReward = await rewards.grantTaskReward(second!);
  assert.equal(secondReward.awarded, false);

  const user = await userDB.get();
  assert.equal(user?.xp, 10);
  assert.equal(user?.gold, 23);
  const ledger = await queryAll("SELECT * FROM reward_ledger");
  assert.equal(ledger.length, 1);
}

{
  resetTables(20);
  saveTable("inventory", [{
    id: 1,
    item_key: "medal_copper",
    quantity: 1,
    equipped: 1,
    created_at: "now",
    updated_at: "now",
  }]);

  const plan = await tasksDB.create({
    title: "Bonus plan",
    mode: "plan",
    targetDate: getTodayLocal(),
    difficulty: "easy",
  });
  const completed = await tasksDB.complete(plan.id);
  const reward = await rewards.grantTaskReward(completed!);
  assert.equal(reward.xpEarned, 11);
  assert.equal((await userDB.get())?.xp, 11);

  const undone = await tasksDB.uncomplete(plan.id);
  const reverted = await rewards.revertTaskReward(undone!);
  assert.equal(reverted?.xpReverted, 11);
  assert.equal((await userDB.get())?.xp, 0);
  assert.equal((await userDB.get())?.gold, 20);
}

{
  resetTables(20);
  const plan = await tasksDB.create({
    title: "Difficulty edit",
    mode: "plan",
    targetDate: getTodayLocal(),
    difficulty: "easy",
  });
  const completed = await tasksDB.complete(plan.id);
  await rewards.grantTaskReward(completed!);

  const edited = await tasksDB.update(plan.id, { difficulty: "heroic" });
  assert.equal(edited?.difficulty, "heroic");
  assert.equal(edited?.xpReward, 10);
  assert.equal(edited?.goldReward, 3);

  const undone = await tasksDB.uncomplete(plan.id);
  await rewards.revertTaskReward(undone!);
  const user = await userDB.get();
  assert.equal(user?.xp, 0);
  assert.equal(user?.gold, 20);
}

{
  resetTables(20);
  const plan = await tasksDB.create({
    title: "Delete completed",
    mode: "plan",
    targetDate: getTodayLocal(),
  });
  const completed = await tasksDB.complete(plan.id);
  await rewards.grantTaskReward(completed!);
  assert.equal((await userDB.get())?.gold, 23);

  await rewards.revertTaskReward(completed!);
  await tasksDB.remove(plan.id);
  assert.equal((await userDB.get())?.gold, 20);
  assert.equal((await tasksDB.getById(plan.id)), null);
}

{
  resetTables(20);
  await Promise.all([
    shop.buyOre("ore_copper"),
    shop.buyOre("ore_copper"),
    shop.buyOre("ore_copper"),
  ]);

  const user = await userDB.get();
  const inventory = await shop.getInventory();
  assert.equal(user?.gold, 0);
  assert.equal(inventory.ore_copper.quantity, 2);
}

{
  resetTables(0);
  saveTable("inventory", [{
    id: 1,
    item_key: "ore_copper",
    quantity: 5,
    equipped: 0,
    created_at: "now",
    updated_at: "now",
  }]);

  const [first, second] = await Promise.allSettled([
    shop.craftMedal("medal_copper"),
    shop.craftMedal("medal_copper"),
  ]);
  assert.equal(first.status, "fulfilled");
  assert.equal(second.status, "rejected");
  const inventory = await shop.getInventory();
  assert.equal(inventory.ore_copper.quantity, 0);
  assert.equal(inventory.medal_copper.quantity, 1);
}

{
  resetTables(20);
  saveTable("achievement", [{
    id: 1,
    key: "first_quest",
    title: "First",
    description: "First task",
    icon: "*",
    is_hidden: 0,
    unlocked: 0,
    unlocked_at: null,
  }]);

  await achievements.unlock("first_quest");
  const row = await queryOne<{ unlocked: number; unlocked_at: string | null }>(
    "SELECT * FROM achievement WHERE key = ?",
    ["first_quest"],
  );
  assert.equal(row?.unlocked, 1);
  assert.ok(row?.unlocked_at);
}

{
  resetTables(20);
  saveTable("achievement", [
    { id: 1, key: "first_quest", title: "First", description: "", icon: "*", is_hidden: 0, unlocked: 0, unlocked_at: null },
    { id: 2, key: "level_5", title: "Level 5", description: "", icon: "*", is_hidden: 0, unlocked: 0, unlocked_at: null },
    { id: 3, key: "gold_100", title: "Gold 100", description: "", icon: "*", is_hidden: 0, unlocked: 0, unlocked_at: null },
  ]);
  await userDB.update({ level: 5 });
  saveTable("reward_ledger", [{
    id: 1,
    task_id: 1,
    completion_key: "1:plan",
    mode: "plan",
    task_title: "Done",
    base_xp: 10,
    base_gold: 3,
    xp_earned: 10,
    gold_earned: 100,
    level_before: 4,
    xp_before: 0,
    xp_to_next_before: 800,
    gold_before: 0,
    level_after: 5,
    xp_after: 0,
    xp_to_next_after: 1000,
    gold_after: 100,
    completed_date: getTodayLocal(),
    created_at: "now",
    reversed_at: null,
  }]);

  const unlocked = await progression.evaluateProgression();
  assert.deepEqual(new Set(unlocked), new Set(["first_quest", "level_5", "gold_100"]));
}

{
  resetTables(20);
  const user = await userDB.get();
  await userDB.update({
    hp: 50,
    maxHp: 100,
    lastLoginDate: getDaysFromTodayLocal(-2),
    lastSettlementDate: null,
  });
  await tasksDB.create({
    title: "Daily missed",
    mode: "habit",
    frequency: "daily",
    startDate: getDaysFromTodayLocal(-3),
  });

  await userDB.dailySettle();
  const settled = await userDB.get();
  assert.equal(user?.hp, 100);
  assert.equal(settled?.hp, 65);
}

{
  resetTables(20);
  await addLog({
    taskId: 1,
    taskTitle: "Read",
    mode: "habit",
    xpEarned: 10,
    goldEarned: 3,
    completedAt: "2026-05-13T10:00:00.000Z",
    date: getTodayLocal(),
  });

  const logs = await getLogs(20);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].taskTitle, "Read");
  assert.equal(logs[0].xpEarned, 10);
  assert.equal(logs[0].goldEarned, 3);
  assert.equal(logs[0].date, getTodayLocal());
}

{
  resetTables(20);
  saveTable("inventory", [{
    id: 1,
    item_key: "medal_copper",
    quantity: 1,
    equipped: 1,
    created_at: "now",
    updated_at: "now",
  }]);

  const beforeReward = await userDB.get();
  const reward = await userDB.applyReward(beforeReward!, 10, 3);
  assert.equal(reward.xpEarned, 11);
  assert.equal(reward.xp, 11);
  assert.equal(reward.gold, 23);
}

{
  resetTables(5);
  assert.equal(await shop.buyOre("ore_copper"), null);
  assert.equal((await userDB.get())?.gold, 5);
}

{
  resetTables(50);

  for (let i = 0; i < 5; i++) {
    assert.ok(await shop.buyOre("ore_copper"));
  }
  assert.equal((await userDB.get())?.gold, 0);

  const crafted = await shop.craftMedal("medal_copper");
  assert.equal(crafted.ore_copper.quantity, 0);
  assert.equal(crafted.medal_copper.quantity, 1);
  assert.equal(crafted.medal_copper.equipped, false);

  await shop.equipItem("medal_copper", true);
  const inventory = await shop.getInventory();
  assert.equal(inventory.medal_copper.equipped, true);
}

console.log("regressions ok");
