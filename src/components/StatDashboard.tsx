import { motion } from "framer-motion";
import { Swords, Coins, Heart, Flame, Zap, Trophy } from "lucide-react";
import { XPBar } from "./XPBar";
import type { User } from "../hooks/useStats";

interface StatDashboardProps {
  stats: User | null;
  loading: boolean;
}

export function StatDashboard({ stats, loading }: StatDashboardProps) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-20 bg-card animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  const statCards = [
    {
      label: "等级",
      value: stats.level.toString(),
      icon: Swords,
      color: "text-emerald-400",
      bg: "from-emerald-500/10 to-emerald-500/5",
    },
    {
      label: "金币",
      value: stats.gold.toString(),
      icon: Coins,
      color: "text-amber-400",
      bg: "from-amber-500/10 to-amber-500/5",
    },
    {
      label: stats.hpPenaltyActive ? "生命值 ⚠️" : "生命值",
      value: `${stats.hp}/${stats.maxHp}`,
      icon: Heart,
      color: stats.hpPenaltyActive ? "text-red-500" : "text-red-400",
      bg: stats.hpPenaltyActive ? "from-red-500/20 to-red-500/10" : "from-red-500/10 to-red-500/5",
    },
    {
      label: "连续天数",
      value: stats.streakDays.toString(),
      icon: Flame,
      color: stats.streakDays > 0 ? "text-orange-400" : "text-muted-foreground",
      bg: "from-orange-500/10 to-orange-500/5",
    },
    {
      label: "最佳连续",
      value: stats.bestStreak.toString(),
      icon: Trophy,
      color: stats.bestStreak > 0 ? "text-amber-400" : "text-muted-foreground",
      bg: "from-amber-500/10 to-amber-500/5",
    },
    {
      label: "累计天数",
      value: stats.totalDays.toString(),
      icon: Zap,
      color: "text-blue-400",
      bg: "from-blue-500/10 to-blue-500/5",
    },
  ];

  return (
    <div className="space-y-4 mb-6">
      {/* 属性卡片 */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className={`
              relative overflow-hidden rounded-xl border border-border p-3
              bg-gradient-to-br ${card.bg}
            `}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {card.label}
              </span>
            </div>
            <motion.span
              key={`${card.label}-${card.value}`}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className={`text-lg font-bold ${card.color}`}
            >
              {card.value}
            </motion.span>
          </motion.div>
        ))}
      </div>

      {/* XP 进度条 */}
      <XPBar xp={stats.xp} xpToNext={stats.xpToNext} level={stats.level} />

      {/* 下一级提示 */}
      <p className="text-xs text-muted-foreground text-center">
        距离 Lv.{stats.level + 1} 还需 {stats.xpToNext - stats.xp} XP
      </p>
    </div>
  );
}
