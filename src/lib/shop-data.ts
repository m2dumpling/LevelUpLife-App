/** 矿石 & 奖牌配置 — Stardew Valley 风格合成系统 */

export interface OreConfig {
  oreKey: string;
  oreName: string;
  oreEmoji: string;
  cost: number;       // 购买所需金币
}

export interface MedalConfig {
  medalKey: string;
  medalName: string;
  medalEmoji: string;
  oreKey: string;           // 合成所需矿石
  oreRequired: number;      // 需要多少个矿石
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  rarityOrder: number;      // 0-4 排序用
  xpBonusPercent: number;   // XP 加成百分比
}

export const SHOP_ORES: OreConfig[] = [
  { oreKey: "ore_copper",     oreName: "铜矿石",   oreEmoji: "🪨", cost: 10 },
  { oreKey: "ore_iron",       oreName: "铁矿石",   oreEmoji: "⛏️", cost: 30 },
  { oreKey: "ore_gold",       oreName: "金矿石",   oreEmoji: "✨", cost: 100 },
  { oreKey: "ore_mithril",    oreName: "秘银矿石", oreEmoji: "💎", cost: 300 },
  { oreKey: "ore_adamantite", oreName: "精金矿石", oreEmoji: "🔮", cost: 1000 },
];

export const MEDAL_RECIPES: MedalConfig[] = [
  { medalKey: "medal_copper",     medalName: "铜奖牌",   medalEmoji: "🥉", oreKey: "ore_copper",     oreRequired: 5, rarity: "common",    rarityOrder: 0, xpBonusPercent: 2 },
  { medalKey: "medal_iron",       medalName: "铁奖牌",   medalEmoji: "⚙️", oreKey: "ore_iron",       oreRequired: 5, rarity: "uncommon",  rarityOrder: 1, xpBonusPercent: 5 },
  { medalKey: "medal_gold",       medalName: "金奖牌",   medalEmoji: "🥇", oreKey: "ore_gold",       oreRequired: 5, rarity: "rare",      rarityOrder: 2, xpBonusPercent: 10 },
  { medalKey: "medal_mithril",    medalName: "秘银奖牌", medalEmoji: "💠", oreKey: "ore_mithril",    oreRequired: 3, rarity: "epic",      rarityOrder: 3, xpBonusPercent: 15 },
  { medalKey: "medal_adamantite", medalName: "精金奖牌", medalEmoji: "👑", oreKey: "ore_adamantite", oreRequired: 3, rarity: "legendary", rarityOrder: 4, xpBonusPercent: 25 },
];

/** 根据 rarityOrder 排序（高稀有度在前） */
export function sortByRarity(medals: MedalConfig[]): MedalConfig[] {
  return [...medals].sort((a, b) => b.rarityOrder - a.rarityOrder);
}
