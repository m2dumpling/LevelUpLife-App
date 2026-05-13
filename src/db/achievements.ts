import { queryAll, execute } from "./connection";

export async function getAll(): Promise<Record<string, unknown>[]> {
  return queryAll("SELECT * FROM achievement ORDER BY id");
}

export async function unlock(key: string): Promise<void> {
  await execute("UPDATE achievement SET unlocked = 1, unlocked_at = ? WHERE key = ? AND unlocked = 0", [new Date().toISOString(), key]);
}
