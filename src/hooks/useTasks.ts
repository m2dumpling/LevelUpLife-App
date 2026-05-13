/**
 * 任务 hook — 直接调用本地 SQLite，替代 web 端的 fetch('/api/tasks')
 */

import { useState, useEffect, useCallback } from "react";
import { tasksDB, type Task } from "../db/tasks";
import { userDB } from "../db/user";
import { seedIfNeeded } from "../db/seed";
import { cancelTaskNotification, scheduleNotificationsQueued } from "../notifications";
import { addLog } from "../db/logs";
import { getTodayLocal } from "../lib/date-utils";

export type { Task };

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      await seedIfNeeded();
      await tasksDB.repairWronglyFailedPlansOnce();
      const data = await tasksDB.getAll();
      setTasks(data);
    } catch (e) {
      console.error("Failed to load tasks:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = useCallback(
    async (data: {
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
    }) => {
      const task = await tasksDB.create(data);
      if (import.meta.env.DEV) console.log("[useTasks addTask]", task);
      if (task) setTasks((prev) => [...prev, task]);
      await scheduleNotificationsQueued("addTask");
      return task;
    },
    [],
  );

  const completeTask = useCallback(async (taskId: number) => {
    const task = await tasksDB.complete(taskId);
    if (task) {
      await cancelTaskNotification(task);
      const user = await userDB.get();
      if (user) {
        const result = await userDB.applyReward(user, task.xpReward, task.goldReward);
        await addLog({
          taskId: task.id,
          taskTitle: task.title,
          mode: task.mode,
          xpEarned: result.xpEarned,
          goldEarned: task.goldReward,
          completedAt: new Date().toISOString(),
          date: getTodayLocal(),
        });
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, ...task, leveledUp: result.leveledUp, levelsGained: result.levelsGained, newLevel: result.level, newXp: result.xp, newXpToNext: result.xpToNext, newGold: result.gold }
              : t,
          ),
        );
        window.dispatchEvent(new Event("task-completed"));
        await scheduleNotificationsQueued("completeTask");
        return { ...task, leveledUp: result.leveledUp, levelsGained: result.levelsGained, newLevel: result.level, newXp: result.xp, newXpToNext: result.xpToNext, newGold: result.gold };
      }
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...task } : t)));
    }
    await scheduleNotificationsQueued("completeTask");
    return task;
  }, []);

  const uncompleteTask = useCallback(async (taskId: number) => {
    const task = await tasksDB.uncomplete(taskId);
    if (task) {
      const user = await userDB.get();
      if (user && task.rewardReverted) {
        const newXp = Math.max(0, user.xp - task.xpReward);
        const newGold = Math.max(0, user.gold - task.goldReward);
        await userDB.update({ xp: newXp, gold: newGold });
        const updatedTask = { ...task, newGold, newXp };
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updatedTask } : t)));
        await scheduleNotificationsQueued("uncompleteTask");
        return updatedTask;
      }
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...task } : t)));
    }
    await scheduleNotificationsQueued("uncompleteTask");
    return task;
  }, []);

  const editTask = useCallback(async (taskId: number, data: Record<string, unknown>) => {
    const previousTask = tasks.find((t) => t.id === taskId);
    if (previousTask) await cancelTaskNotification(previousTask);
    const task = await tasksDB.update(taskId, data);
    if (import.meta.env.DEV) console.log("[useTasks editTask]", task);
    if (task) setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...task } : t)));
    await scheduleNotificationsQueued("editTask");
    return task;
  }, [tasks]);

  const deleteTask = useCallback(async (taskId: number) => {
    const previousTask = tasks.find((t) => t.id === taskId);
    if (previousTask) await cancelTaskNotification(previousTask);
    await tasksDB.remove(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await scheduleNotificationsQueued("deleteTask");
  }, [tasks]);

  const habits = tasks.filter((t) => t.mode === "habit");
  const plans = tasks.filter((t) => t.mode === "plan");
  const pending = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  return {
    tasks,
    habits,
    plans,
    pending,
    completed,
    loading,
    addTask,
    editTask,
    completeTask,
    uncompleteTask,
    deleteTask,
    refreshTasks: fetchTasks,
  };
}
