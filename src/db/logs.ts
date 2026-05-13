import { queryAll } from "./connection.ts";

export interface LogEntry {
  id: number;
  taskId: number | null;
  taskTitle: string;
  mode: string;
  xpEarned: number;
  goldEarned: number;
  completedAt: string;
  date: string;
}

function rowToLogEntry(row: Record<string, unknown>): LogEntry {
  return {
    id: row.id as number,
    taskId: row.task_id as number | null,
    taskTitle: row.task_title as string,
    mode: row.mode as string,
    xpEarned: row.xp_earned as number,
    goldEarned: row.gold_earned as number,
    completedAt: row.completed_at as string,
    date: row.date as string,
  };
}

export async function getLogs(limit: number = 366): Promise<LogEntry[]> {
  const rows = await queryAll<Record<string, unknown>>(
    "SELECT * FROM activity_log ORDER BY completed_at DESC LIMIT ?",
    [limit],
  );
  return rows.map(rowToLogEntry);
}

export async function addLog(entry: {
  taskId?: number;
  taskTitle: string;
  mode: string;
  xpEarned: number;
  goldEarned: number;
  completedAt: string;
  date: string;
}): Promise<void> {
  const { execute } = await import("./connection.ts");
  await execute(
    "INSERT INTO activity_log (task_id, task_title, mode, xp_earned, gold_earned, completed_at, date) VALUES (?,?,?,?,?,?,?)",
    [entry.taskId ?? null, entry.taskTitle, entry.mode, entry.xpEarned, entry.goldEarned, entry.completedAt, entry.date],
  );
}
