/**
 * 首次安装播种 — 成就 + 剧情事件
 * 与 web 端 drizzle/seed.ts 数据一致
 */

import { execute, queryOne } from "./connection";

const ACHIEVEMENTS = [
  { key: "first_quest", title: "初出茅庐", desc: "完成第一个任务", icon: "⚔️", hidden: 0 },
  { key: "streak_3", title: "坚持不懈", desc: "连续3天打卡", icon: "🔥", hidden: 0 },
  { key: "streak_7", title: "周常修行", desc: "连续7天打卡", icon: "🔥", hidden: 0 },
  { key: "streak_10", title: "十日谈", desc: "连续10天打卡", icon: "📖", hidden: 0 },
  { key: "streak_30", title: "月度勇士", desc: "连续30天打卡", icon: "🏆", hidden: 0 },
  { key: "level_5", title: "小有所成", desc: "达到5级", icon: "⬆️", hidden: 0 },
  { key: "level_10", title: "中流砥柱", desc: "达到10级", icon: "⬆️", hidden: 0 },
  { key: "level_20", title: "一代宗师", desc: "达到20级", icon: "👑", hidden: 0 },
  { key: "gold_100", title: "小富即安", desc: "累计获得100金币", icon: "💰", hidden: 0 },
  { key: "gold_500", title: "富甲一方", desc: "累计获得500金币", icon: "💎", hidden: 0 },
  { key: "task_10", title: "任务达人", desc: "完成10个任务", icon: "✅", hidden: 0 },
  { key: "task_50", title: "任务机器", desc: "完成50个任务", icon: "🤖", hidden: 0 },
  { key: "task_100", title: "任务之王", desc: "完成100个任务", icon: "👑", hidden: 0 },
  { key: "craft_first", title: "初次打造", desc: "合成第一个奖牌", icon: "⚒️", hidden: 0 },
  { key: "craft_all", title: "收藏家", desc: "拥有所有五种奖牌", icon: "🏅", hidden: 0 },
  { key: "hp_zero", title: "濒死体验", desc: "HP降到0", icon: "💀", hidden: 1 },
  { key: "all_difficulty", title: "全能勇士", desc: "完成过所有难度的任务", icon: "🌈", hidden: 0 },
  { key: "secret", title: "隐藏成就", desc: "发现了隐藏成就", icon: "❓", hidden: 1 },
];

const STORY_EVENTS = [
  { chapter: "chapter_0", trigger: "level >= 2", title: "冒险开始", dialogue: "勇者，你终于来了！这个世界需要你的帮助...", npc: "神秘老人", reward: "10 G", order: 1 },
  { chapter: "chapter_1", trigger: "level >= 5", title: "修行之路", dialogue: "你已经证明了自己的实力。但要面对更大的挑战，还需要继续修行。", npc: "武道大师", reward: "50 G", order: 2 },
  { chapter: "chapter_1", trigger: "streak_days >= 7", title: "坚持的力量", dialogue: "连续7天！你的毅力令人敬佩。", npc: "武道大师", reward: "30 G", order: 3 },
  { chapter: "chapter_2", trigger: "level >= 10", title: "龙之试炼", dialogue: "古老的龙穴中传来咆哮...只有真正的勇者才能通过试炼。", npc: "龙之守卫", reward: "200 G", order: 4 },
  { chapter: "chapter_3", trigger: "level >= 15", title: "黑暗降临", dialogue: "一股黑暗力量正在蔓延。你必须阻止它！", npc: "光明祭司", reward: "500 G", order: 5 },
  { chapter: "chapter_4", trigger: "level >= 20", title: "终局之战", dialogue: "这是最后的战斗。你准备好了吗？", npc: "国王", reward: "1000 G", order: 6 },
];

export async function seedIfNeeded(): Promise<void> {
  const existing = await queryOne("SELECT id FROM achievement LIMIT 1");
  if (existing) return;

  for (const a of ACHIEVEMENTS) {
    await execute(
      `INSERT OR IGNORE INTO achievement (key, title, description, icon, is_hidden, unlocked, unlocked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [a.key, a.title, a.desc, a.icon, a.hidden, 0, null],
    );
  }

  for (const s of STORY_EVENTS) {
    await execute(
      `INSERT OR IGNORE INTO story_event (chapter_key, trigger_condition, title, dialogue, npc_name, reward, is_triggered, triggered_at, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?)`,
      [s.chapter, s.trigger, s.title, s.dialogue, s.npc, s.reward, s.order],
    );
  }

  console.log("🎉 Seed data inserted!");
}
