import { CalendarDays, Clock, Flame, Target } from "lucide-react";
import type { Task } from "../db/tasks";
import {
  getDayOfMonth,
  getDayOfWeek,
  getDaysFromTodayLocal,
  getTodayLocal,
} from "../lib/date-utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

interface MonthlyViewProps {
  habits: Task[];
  plans: Task[];
}

const DAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function formatDateLabel(dateStr: string): string {
  if (dateStr === getTodayLocal()) return "今天";
  if (dateStr === getDaysFromTodayLocal(1)) return "明天";
  return `${Number(dateStr.slice(5, 7))}月${Number(dateStr.slice(8, 10))}日 ${DAY_NAMES[getDayOfWeek(dateStr)]}`;
}

function habitMatchesDate(habit: Task, dateStr: string, today: string): boolean {
  if (habit.startDate && habit.startDate > dateStr) return false;
  if (habit.endDate && habit.endDate < dateStr) return false;

  const frequency = habit.frequency || "daily";
  if (frequency === "daily") return true;
  if (frequency === "weekly") {
    if (!habit.frequencyDays) return getDayOfWeek(dateStr) === getDayOfWeek(today);
    return habit.frequencyDays.split(",").map(Number).includes(getDayOfWeek(dateStr));
  }
  if (frequency === "monthly") {
    return getDayOfMonth(dateStr) === getDayOfMonth(today);
  }
  return true;
}

export function MonthlyView({ habits, plans }: MonthlyViewProps) {
  const today = getTodayLocal();
  const groups = Array.from({ length: 30 }, (_, index) => {
    const dateStr = getDaysFromTodayLocal(index);
    const items: Array<{ task: Task; type: "habit" | "plan" }> = [];

    for (const habit of habits) {
      if (habitMatchesDate(habit, dateStr, today)) {
        items.push({ task: habit, type: "habit" });
      }
    }

    for (const plan of plans) {
      if (plan.completed || plan.status === "completed" || plan.status === "failed") continue;
      if (plan.targetDate === dateStr) {
        items.push({ task: plan, type: "plan" });
      }
    }

    return { dateStr, items };
  }).filter((group) => group.items.length > 0);

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="inline-flex shrink-0 items-center justify-center gap-1 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-card hover:border-primary/40 transition-colors">
          <CalendarDays className="w-3.5 h-3.5" />
          月度
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4" />
            未来 30 天
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {groups.length} 天 · {total} 项任务
          </p>
        </DialogHeader>

        {groups.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            未来 30 天暂无待办任务
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <section key={group.dateStr} className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      group.dateStr === today ? "bg-emerald-400" : "bg-border"
                    }`}
                  />
                  <span>{formatDateLabel(group.dateStr)}</span>
                  <span className="text-xs text-muted-foreground">
                    {group.items.length}
                  </span>
                </div>
                <div className="space-y-1.5 border-l border-border pl-3">
                  {group.items.map(({ task, type }) => {
                    const completed = type === "habit" && group.dateStr === today && task.completed;
                    return (
                      <div
                        key={`${group.dateStr}-${type}-${task.id}`}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                          completed ? "opacity-50 line-through" : ""
                        }`}
                      >
                        {type === "habit" ? (
                          <Flame className="h-3.5 w-3.5 shrink-0 text-orange-400" />
                        ) : (
                          <Target className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                        )}
                        <span className="min-w-0 flex-1 truncate">{task.title}</span>
                        {task.reminderTime && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                            <Clock className="h-3 w-3" />
                            {task.reminderTime}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
