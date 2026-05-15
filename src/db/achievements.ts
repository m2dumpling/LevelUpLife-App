import { queryAll, queryOne, execute } from "./connection.ts";

export async function getAll(): Promise<Record<string, unknown>[]> {
  return queryAll("SELECT * FROM achievement ORDER BY id");
}

export async function unlock(key: string): Promise<void> {
  const existing = await queryOne<{ unlocked: number }>("SELECT * FROM achievement WHERE key = ?", [key]);
  if (!existing || existing.unlocked) return;
  await execute("UPDATE achievement SET unlocked = ?, unlocked_at = ? WHERE key = ?", [1, new Date().toISOString(), key]);
}
