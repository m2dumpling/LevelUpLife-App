import { queryOne, execute } from "./connection.ts";
import { SHOP_ORES } from "../lib/shop-data.ts";

export async function buyOre(oreKey: string): Promise<{ gold: number; quantity: number } | null> {
  const ore = SHOP_ORES.find((o) => o.oreKey === oreKey);
  if (!ore) return null;

  const user = await queryOne<{ gold: number }>("SELECT gold FROM user WHERE id = 1");
  if (!user || user.gold < ore.cost) return null;

  await execute("UPDATE user SET gold = gold - ?, updated_at = ? WHERE id = 1", [ore.cost, new Date().toISOString()]);

  const existing = await queryOne<{ quantity: number }>("SELECT quantity FROM inventory WHERE item_key = ?", [oreKey]);
  if (existing) {
    await execute("UPDATE inventory SET quantity = quantity + 1 WHERE item_key = ?", [oreKey]);
    return { gold: user.gold - ore.cost, quantity: existing.quantity + 1 };
  }
  await execute("INSERT INTO inventory (item_key, quantity, equipped) VALUES (?, 1, 0)", [oreKey]);
  return { gold: user.gold - ore.cost, quantity: 1 };
}

export async function getInventory(): Promise<Record<string, { quantity: number; equipped: boolean }>> {
  const rows = await import("./connection.ts").then((c) => c.queryAll<{ item_key: string; quantity: number; equipped: number }>("SELECT * FROM inventory"));
  const inv: Record<string, { quantity: number; equipped: boolean }> = {};
  for (const r of rows) inv[r.item_key] = { quantity: r.quantity, equipped: !!r.equipped };
  return inv;
}

export async function craftMedal(medalKey: string): Promise<Record<string, { quantity: number; equipped: boolean }>> {
  const { MEDAL_RECIPES } = await import("../lib/shop-data.ts");
  const recipe = MEDAL_RECIPES.find((m) => m.medalKey === medalKey);
  if (!recipe) throw new Error("Invalid medal");

  const inv = await getInventory();
  const oreQty = inv[recipe.oreKey]?.quantity ?? 0;
  if (oreQty < recipe.oreRequired) throw new Error("Not enough ore");

  await execute("UPDATE inventory SET quantity = quantity - ? WHERE item_key = ?", [recipe.oreRequired, recipe.oreKey]);
  const medal = inv[recipe.medalKey];
  if (medal) {
    await execute("UPDATE inventory SET quantity = quantity + 1 WHERE item_key = ?", [recipe.medalKey]);
  } else {
    await execute("INSERT INTO inventory (item_key, quantity, equipped) VALUES (?, 1, 0)", [recipe.medalKey]);
  }
  return getInventory();
}

export async function equipItem(itemKey: string, equipped: boolean): Promise<void> {
  await execute("UPDATE inventory SET equipped = ? WHERE item_key = ?", [equipped ? 1 : 0, itemKey]);
}
