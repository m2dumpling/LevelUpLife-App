import { Capacitor, type PermissionState } from "@capacitor/core";
import {
  LocalNotifications,
  type LocalNotificationSchema,
} from "@capacitor/local-notifications";
import { tasksDB, type Task } from "./db/tasks.ts";
import { getTodayLocal } from "./lib/date-utils.ts";

export const TASK_REMINDER_CHANNEL_ID = "task-reminders";
export const PLAN_NOTIFICATION_OFFSET = 10000;
export const TEST_NOTIFICATION_ID = 999999001;

type TaskMode = "habit" | "plan";

export interface ScheduleNotificationsOptions {
  reason?: string;
}

export interface NotificationPermissionResult {
  canSchedule: boolean;
  display: PermissionState | "unsupported";
  exactAlarm: PermissionState | "unsupported" | "not-android";
  exactAlarmGranted: boolean;
}

export interface NotificationDecision {
  id: number;
  taskId: number;
  title: string;
  mode: TaskMode;
  completed: boolean;
  status?: Task["status"];
  targetDate: string | null;
  reminderTime: string | null | undefined;
  computedAt: Date | null;
  shouldSchedule: boolean;
  skipReason: string | null;
  notification: LocalNotificationSchema | null;
}

let scheduleChain = Promise.resolve();

function isDevEnv(): boolean {
  return Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
}

function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

function isAndroid(): boolean {
  return Capacitor.getPlatform() === "android";
}

function parseTime(value: string | null | undefined): { hour: number; minute: number } | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function parseDateOnly(value: string | null | undefined): { year: number; month: number; day: number } | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function makeLocalDate(date: Date, hour: number, minute: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
}

function nextHabitDate(task: Task, now: Date, hour: number, minute: number): {
  at: Date;
  repeats?: boolean;
  every?: "day";
  skipReason?: string;
} | null {
  const selectedDays = (task.frequencyDays ?? "")
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);

  if (task.frequency === "weekly" && selectedDays.length > 0) {
    const selected = new Set(selectedDays);
    for (let offset = 0; offset <= 13; offset++) {
      const candidateDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 0, 0, 0, 0);
      if (!selected.has(candidateDay.getDay())) continue;
      const at = makeLocalDate(candidateDay, hour, minute);
      if (offset === 0 && (task.completed || at <= now)) continue;
      return {
        at,
        skipReason: task.completed && offset > 0 ? "habit-completed-today-scheduled-next" : undefined,
      };
    }
    return null;
  }

  const todayAt = makeLocalDate(now, hour, minute);
  if (!task.completed && todayAt > now) {
    return { at: todayAt, repeats: true, every: "day" };
  }

  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return {
    at: makeLocalDate(tomorrow, hour, minute),
    repeats: true,
    every: "day",
    skipReason: task.completed ? "habit-completed-today-scheduled-next" : undefined,
  };
}

function createNotification(task: Task, id: number, at: Date, schedule?: { repeats?: boolean; every?: "day" }): LocalNotificationSchema {
  const modeLabel = task.mode === "plan" ? "Plan" : "Habit";
  return {
    id,
    title: `LevelUp Life ${modeLabel}`,
    body: `Reminder: ${task.title}`,
    channelId: TASK_REMINDER_CHANNEL_ID,
    smallIcon: "ic_stat_leveluplife",
    iconColor: "#7c3aed",
    autoCancel: true,
    schedule: {
      at,
      allowWhileIdle: true,
      repeats: schedule?.repeats,
      every: schedule?.every,
    },
    extra: {
      taskId: task.id,
      mode: task.mode,
      targetDate: task.targetDate ?? null,
      reminderTime: task.reminderTime ?? null,
    },
  };
}

export function getNotificationId(task: Pick<Task, "id" | "mode">): number {
  return getNotificationIdByTask(task.id, task.mode);
}

export function getNotificationIdByTask(taskId: number, mode: TaskMode): number {
  return mode === "plan" ? taskId + PLAN_NOTIFICATION_OFFSET : taskId;
}

export function buildTaskNotification(
  task: Task,
  context: { now?: Date; today?: string } = {},
): NotificationDecision {
  const now = context.now ?? new Date();
  const today = context.today ?? getTodayLocal();
  const id = getNotificationId(task);
  const base = {
    id,
    taskId: task.id,
    title: task.title,
    mode: task.mode,
    completed: task.completed,
    status: task.status,
    targetDate: task.targetDate ?? null,
    reminderTime: task.reminderTime,
    computedAt: null,
    shouldSchedule: false,
    notification: null,
  };

  const skip = (skipReason: string): NotificationDecision => ({ ...base, skipReason });
  const time = parseTime(task.reminderTime);
  if (!time) return skip("missing-or-invalid-reminder-time");
  if (task.status === "completed") return skip("status-completed");
  if (task.status === "failed") return skip("status-failed");

  if (task.mode === "plan") {
    if (task.completed) return skip("completed-plan");
    if (!task.targetDate) return skip("plan-missing-target-date");
    if (task.targetDate < today) return skip("plan-overdue");

    const target = parseDateOnly(task.targetDate);
    if (!target) return skip("invalid-target-date");

    const at = new Date(target.year, target.month - 1, target.day, time.hour, time.minute, 0, 0);
    if (at <= now) return { ...base, computedAt: at, skipReason: "plan-time-past" };

    return {
      ...base,
      computedAt: at,
      shouldSchedule: true,
      skipReason: null,
      notification: createNotification(task, id, at),
    };
  }

  const next = nextHabitDate(task, now, time.hour, time.minute);
  if (!next) return skip("habit-no-valid-frequency-day");

  return {
    ...base,
    computedAt: next.at,
    shouldSchedule: true,
    skipReason: next.skipReason ?? null,
    notification: createNotification(task, id, next.at, { repeats: next.repeats, every: next.every }),
  };
}

export async function ensureNotificationChannel(): Promise<void> {
  if (!isNative() || !isAndroid()) return;

  try {
    await LocalNotifications.createChannel({
      id: TASK_REMINDER_CHANNEL_ID,
      name: "Task reminders",
      description: "Reminders for habits and plans",
      importance: 4,
      visibility: 1,
      lights: true,
      vibration: true,
    });
  } catch (error) {
    console.warn("[Notifications] create channel failed:", error);
  }
}

export async function ensureNotificationPermissions(): Promise<NotificationPermissionResult> {
  if (!isNative()) {
    return { canSchedule: false, display: "unsupported", exactAlarm: "unsupported", exactAlarmGranted: false };
  }

  try {
    const checked = await LocalNotifications.checkPermissions();
    const permission =
      checked.display === "granted" ? checked : await LocalNotifications.requestPermissions();

    if (permission.display !== "granted") {
      return { canSchedule: false, display: permission.display, exactAlarm: "unsupported", exactAlarmGranted: false };
    }

    let exactAlarm: NotificationPermissionResult["exactAlarm"] = "not-android";
    let exactAlarmGranted = !isAndroid();

    if (isAndroid()) {
      try {
        const exact = await LocalNotifications.checkExactNotificationSetting();
        exactAlarm = exact.exact_alarm;
        exactAlarmGranted = exact.exact_alarm === "granted";
        if (!exactAlarmGranted) {
          console.warn("[Notifications] Exact alarm is not granted; reminders may be delayed.", exact);
          window.dispatchEvent(new CustomEvent("leveluplife-exact-alarm-needed", { detail: exact }));
        }
      } catch (error) {
        exactAlarm = "unsupported";
        exactAlarmGranted = false;
        console.warn("[Notifications] Exact alarm check failed:", error);
      }
    }

    if (isDevEnv()) console.log("[Notifications] exact alarm:", exactAlarm);
    return { canSchedule: true, display: permission.display, exactAlarm, exactAlarmGranted };
  } catch (error) {
    console.error("[Notifications] Permission check failed:", error);
    return { canSchedule: false, display: "unsupported", exactAlarm: "unsupported", exactAlarmGranted: false };
  }
}

export async function requestExactAlarmPermission(): Promise<NotificationPermissionResult["exactAlarm"]> {
  if (!isNative() || !isAndroid()) return "not-android";

  try {
    const result = await LocalNotifications.changeExactNotificationSetting();
    if (isDevEnv()) console.log("[Notifications] exact alarm after request:", result.exact_alarm);
    return result.exact_alarm;
  } catch (error) {
    console.warn("[Notifications] Opening exact alarm settings failed:", error);
    return "unsupported";
  }
}

async function removeDeliveredById(id: number): Promise<void> {
  try {
    const delivered = await LocalNotifications.getDeliveredNotifications();
    const matches = delivered.notifications.filter((notification) => notification.id === id);
    if (matches.length > 0) {
      await LocalNotifications.removeDeliveredNotifications({ notifications: matches });
    }
  } catch (error) {
    console.warn("[Notifications] Remove delivered notification failed:", error);
  }
}

export async function cancelTaskNotification(task: Pick<Task, "id" | "mode">): Promise<void> {
  await cancelTaskNotificationById(task.id, task.mode);
}

export async function cancelTaskNotificationById(taskId: number, mode: TaskMode): Promise<void> {
  if (!isNative()) return;
  const id = getNotificationIdByTask(taskId, mode);

  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch (error) {
    console.warn("[Notifications] Cancel pending notification failed:", { id, error });
  }

  await removeDeliveredById(id);
}

function taskDebug(decision: NotificationDecision) {
  return {
    id: decision.taskId,
    notificationId: decision.id,
    title: decision.title,
    mode: decision.mode,
    completed: decision.completed,
    status: decision.status,
    targetDate: decision.targetDate,
    reminderTime: decision.reminderTime,
    computedAt: decision.computedAt?.toISOString() ?? null,
    shouldSchedule: decision.shouldSchedule,
    skipReason: decision.skipReason,
  };
}

export async function scheduleNotifications(options: ScheduleNotificationsOptions = {}): Promise<void> {
  if (!isNative()) return;

  const reason = options.reason ?? "manual";

  try {
    if (isDevEnv()) console.log("[Notifications] reason:", reason);
    const permission = await ensureNotificationPermissions();
    if (!permission.canSchedule) return;
    await ensureNotificationChannel();

    const pendingBefore = await LocalNotifications.getPending();
    if (isDevEnv()) console.log("[Notifications] pending before:", pendingBefore.notifications);
    if (pendingBefore.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pendingBefore.notifications.map((notification) => ({ id: notification.id })),
      });
    }

    const tasks = await tasksDB.getAll();
    const now = new Date();
    const today = getTodayLocal();
    const decisions = tasks.map((task) => buildTaskNotification(task, { now, today }));
    const pending = decisions
      .filter((decision): decision is NotificationDecision & { notification: LocalNotificationSchema } =>
        decision.shouldSchedule && decision.notification !== null,
      )
      .map((decision) => decision.notification);

    if (isDevEnv()) console.log("[Notifications] tasks considered:", decisions.map(taskDebug));
    if (pending.length > 0) {
      await LocalNotifications.schedule({ notifications: pending });
    }

    if (isDevEnv()) {
      console.log("[Notifications] scheduled:", pending.map((notification) => ({
        id: notification.id,
        title: notification.title,
        schedule: notification.schedule,
        extra: notification.extra,
      })));
      const pendingAfter = await LocalNotifications.getPending();
      console.log("[Notifications] pending after:", pendingAfter.notifications);
    }
  } catch (error) {
    console.error("[LevelUp] Notification scheduling failed:", error);
  }
}

export function scheduleNotificationsQueued(reason?: string): Promise<void> {
  scheduleChain = scheduleChain
    .catch(() => undefined)
    .then(() => scheduleNotifications({ reason }));
  return scheduleChain;
}

export async function scheduleTestNotificationIn(seconds: number): Promise<void> {
  if (!isNative()) return;
  const permission = await ensureNotificationPermissions();
  if (!permission.canSchedule) return;
  await ensureNotificationChannel();

  const at = new Date(Date.now() + Math.max(1, seconds) * 1000);
  try {
    await LocalNotifications.cancel({ notifications: [{ id: TEST_NOTIFICATION_ID }] });
    await removeDeliveredById(TEST_NOTIFICATION_ID);
    await LocalNotifications.schedule({
      notifications: [{
        id: TEST_NOTIFICATION_ID,
        title: "LevelUp Life test notification",
        body: `${seconds} seconds test reminder`,
        channelId: TASK_REMINDER_CHANNEL_ID,
        smallIcon: "ic_stat_leveluplife",
        iconColor: "#7c3aed",
        autoCancel: true,
        schedule: { at, allowWhileIdle: true },
        extra: { test: true },
      }],
    });
    if (isDevEnv()) console.log("[Notifications] test scheduled:", at.toISOString());
  } catch (error) {
    console.error("[Notifications] Test notification failed:", error);
  }
}
