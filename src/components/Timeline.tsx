import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Flame, CalendarDays } from "lucide-react";
import { getLogs } from "../db/logs";
import { getTodayLocal } from "../lib/date-utils";
import type { LogEntry } from "../db/logs";

export function Timeline() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      const logs = await getLogs(20);
      const today = getTodayLocal();
      const todayLogs = logs.filter((l) => l.date === today);
      setEntries(todayLogs);
    } catch {
      // 静默失败
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // 监听自定义事件刷新
  useEffect(() => {
    const handler = () => fetchLogs();
    window.addEventListener("task-completed", handler);
    return () => window.removeEventListener("task-completed", handler);
  }, [fetchLogs]);

  if (loading) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          今日日志
        </h3>
        <div className="space-y-1">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 bg-card animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          今日日志
        </h3>
        <p className="text-xs text-muted-foreground py-4 text-center">
          今天还没有任何记录，快去完成一个任务吧！
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
        <Clock className="w-3.5 h-3.5" />
        今日日志
      </h3>

      <div className="relative pl-6 border-l border-border space-y-3">
        <AnimatePresence mode="popLayout">
          {(expanded ? entries : entries.slice(0, 5)).map((entry, i) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.25 }}
              className="relative"
            >
              <div className="absolute -left-[25px] top-1.5 w-3 h-3 rounded-full border-2 border-primary bg-card" />

              <div className="bg-card rounded-lg p-3 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  {entry.mode === "habit" ? (
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                  ) : (
                    <CalendarDays className="w-3.5 h-3.5 text-blue-400" />
                  )}
                  <span className="text-sm font-medium">{entry.taskTitle}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="text-emerald-400 font-semibold">+{entry.xpEarned} XP</span>
                  <span className="text-amber-400 font-semibold">+{entry.goldEarned} G</span>
                  <span>
                    {new Date(entry.completedAt).toLocaleTimeString("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {entries.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="w-full rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-card hover:text-foreground"
        >
          {expanded ? "收起日志" : `展开 ${entries.length - 5} 条更多日志`}
        </button>
      )}
    </div>
  );
}
