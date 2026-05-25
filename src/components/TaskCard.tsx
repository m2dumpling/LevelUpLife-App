import { useRef } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Calendar, Check, Clock, Flame, Pencil, RotateCcw, Star, Target, Trash2 } from "lucide-react";
import type { Task } from "../db/tasks";
import { compareDates, getTodayLocal } from "../lib/date-utils";

interface TaskCardProps {
  task: Task;
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (task: Task) => void;
  onUncomplete: (id: number) => void;
}

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

const difficultyLabels: Record<string, string> = {
  trivial: "琐碎",
  easy: "简单",
  medium: "中等",
  hard: "困难",
  heroic: "史诗",
};

const difficultyColors: Record<string, string> = {
  trivial: "text-muted-foreground",
  easy: "text-emerald-400",
  medium: "text-amber-400",
  hard: "text-orange-400",
  heroic: "text-purple-400",
};

const difficultyBorder: Record<string, string> = {
  trivial: "border-muted-foreground/20",
  easy: "border-emerald-500/20",
  medium: "border-amber-500/20",
  hard: "border-orange-500/20",
  heroic: "border-purple-500/20",
};

const frequencyLabels: Record<string, string> = {
  daily: "每日",
  weekly: "每周",
  monthly: "每月",
};

export function TaskCard({ task, onComplete, onDelete, onEdit, onUncomplete }: TaskCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const today = getTodayLocal();

  const handleComplete = (event: React.MouseEvent) => {
    event.stopPropagation();
    onComplete(task.id);
  };

  const isHabit = task.mode === "habit";
  const isPlan = task.mode === "plan";
  const diffColor = difficultyColors[task.difficulty] || "";

  let isToday = true;
  let isExpired = false;

  if (isHabit) {
    if (task.startDate && compareDates(task.startDate, today) > 0) isToday = false;
    if (task.endDate && compareDates(task.endDate, today) < 0) {
      isToday = false;
      isExpired = true;
    }
  }

  if (isPlan && task.targetDate) {
    const cmp = compareDates(task.targetDate, today);
    if (cmp < 0) {
      isToday = false;
      isExpired = true;
    } else if (cmp > 0) {
      isToday = false;
    }
  }

  const canComplete = isToday && !task.completed;

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100, height: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`group relative flex items-start gap-3 rounded-lg border p-3 select-none transition-colors duration-200 ${
        task.completed
          ? "bg-muted/50 border-border/30 opacity-60"
          : isExpired
            ? "bg-destructive/5 border-destructive/10 opacity-50"
            : canComplete
              ? `bg-card border-border hover:border-primary/40 hover:bg-muted/40 cursor-pointer ${difficultyBorder[task.difficulty]}`
              : "bg-card border-border opacity-70"
      }`}
      whileHover={canComplete ? { scale: 1.01 } : {}}
      onClick={canComplete ? handleComplete : undefined}
    >
      {canComplete ? (
        <button
          onClick={handleComplete}
          className="relative mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/40 transition-all duration-200 hover:border-primary hover:bg-primary/10"
        >
          {task.completed && <Check className="h-3.5 w-3.5" />}
        </button>
      ) : (
        <div
          className={`relative mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 ${
            task.completed ? "bg-primary border-primary" : "border-muted-foreground/20"
          }`}
        >
          {task.completed && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
          {isExpired && !task.completed && <AlertTriangle className="h-3 w-3 text-red-400/50" />}
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex min-w-0 items-start gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {isHabit ? (
              <Flame className="h-3.5 w-3.5 flex-shrink-0 text-orange-400" />
            ) : (
              <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-blue-400" />
            )}
            <span
              title={task.title}
              className={`min-w-0 flex-1 truncate text-base font-semibold leading-6 ${
                task.completed ? "line-through text-muted-foreground" : "text-foreground"
              }`}
            >
              {task.title}
            </span>
            {isHabit && task.streakCount > 0 && (
              <span className="flex flex-shrink-0 items-center gap-0.5 text-[10px] font-bold text-orange-400">
                <Star className="h-3 w-3" />
                {task.streakCount}天
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button onClick={(event) => { event.stopPropagation(); onEdit(task); }} className="rounded p-1.5 hover:bg-accent">
              <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
            {task.completed && (
              <button onClick={(event) => { event.stopPropagation(); onUncomplete(task.id); }} className="rounded p-1.5 hover:bg-amber-500/10">
                <RotateCcw className="h-4 w-4 text-amber-400" />
              </button>
            )}
            <button onClick={(event) => { event.stopPropagation(); onDelete(task.id); }} className="rounded p-1.5 hover:bg-destructive/10">
              <Trash2 className="h-4 w-4 text-destructive/60 hover:text-destructive" />
            </button>
          </div>
        </div>

        {task.description && <p className="truncate text-xs text-muted-foreground">{task.description}</p>}

        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${difficultyBorder[task.difficulty]} ${diffColor}`}>
            {difficultyLabels[task.difficulty]}
          </span>
          <span className="text-[10px] font-bold text-emerald-400">+{task.xpReward} XP</span>
          <span className="text-[10px] font-bold text-amber-400">+{task.goldReward} G</span>
          {isHabit && task.bestStreak > 0 && (
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 text-amber-400" />
              <span className="text-[10px] text-amber-400">{task.bestStreak}</span>
            </span>
          )}
        </div>

        {isHabit && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {frequencyLabels[task.frequency || "daily"]}
            </span>
            {task.frequency === "weekly" && task.frequencyDays && (
              <span className="text-[10px] text-muted-foreground">
                · {task.frequencyDays.split(",").map((day) => WEEKDAY_LABELS[parseInt(day)]).join("")}
              </span>
            )}
            {task.reminderTime && (
              <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                <Clock className="h-3 w-3" />
                {task.reminderTime}
              </span>
            )}
          </div>
        )}

        {isPlan && task.targetDate && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1">
              <Target className="h-3 w-3 text-muted-foreground" />
              <span className={`text-[10px] ${isExpired ? "text-red-400" : diffColor}`}>
                {task.targetDate}
                {isExpired && " · 已过期"}
              </span>
            </span>
            {task.reminderTime && (
              <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                <Clock className="h-3 w-3" />
                {task.reminderTime}
              </span>
            )}
          </div>
        )}
      </div>

      {task.completed && isHabit && (
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 -rotate-12">
          <span className="rounded border-2 border-emerald-400/20 px-2 py-1 text-[10px] font-black tracking-widest text-emerald-400/30 select-none">
            CLEAR
          </span>
        </div>
      )}
    </motion.div>
  );
}
