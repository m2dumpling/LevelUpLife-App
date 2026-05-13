# LevelUp Life — Android

将日常任务变成 RPG 冒险 — 完全离线，原生通知，装好即用。

> [English](./README.md) | [Web 版 🌐](https://github.com/m2dumpling/LevelUpLife)

---

## 📥 下载

去 **[Releases](https://github.com/m2dumpling/LevelUpLife-App/releases)** → 下载最新 APK → 安装 → 开始。

无需注册。无需云端。无需网络。装了就能玩。

---

## 🎮 玩法指南

你是手持任务日志的勇者。每坚持一个习惯 = 赚 XP。漏掉一个 = 扣 HP。这是一场对抗自己的 RPG。

### 📋 两种任务

| | Habit 🔥 | Plan 📋 |
|------|---------|------|
| **干什么** | 每日修行：运动、阅读、冥想、喝水... | 一次性任务："周五前提交报告" |
| **何时** | 每天/每周/每月，可选指定星期几 | 你选的执行日期 |
| **奖励** | 每次打卡 ✅ 赚 XP + 金币 | 到期日完成 → 大额奖励 |

点 **+ 新建** → 选难度 → 预览 → 确认。点圆圈 ○ 打卡，XP 数字带彩带飘起。

### 📈 升级体系

> 琐碎 5XP · 简单 10XP · 中等 20XP · 困难 40XP · 史诗 80XP

公式：`xpToNext = 100 × 等级^1.5`。1→2 级 100 XP，50→51 级要 35000+。越来越难，越来越强。

### 💀 HP — 真正的惩罚

初始 **100 HP ❤️**。每天漏掉一个 Habit → **-5 HP**。归零 → **XP 收益 -10%**。

每天登录恢复 **+20 HP**。游戏奖励坚持，惩罚借口。

| HP | 状态 |
|----|------|
| > 0 | 健康 — 满额 XP |
| 0 💀 | 虚弱 — **XP -10%** |

### ⚒️ 商店 → 合成 → 佩戴 → 碾压

金币不是摆设：

```
商店 🏪 → 买矿石 → 合成 ⚒️ → 锻造奖牌 → 佩戴 🎒 → XP 加成层层叠加
```

| 矿石 | 价格 | 奖牌 | 稀有度 | XP 加成 |
|------|------|------|--------|---------|
| 🪨 铜矿石 | 10G | 🥉 铜奖牌 | 普通 | +2% |
| ⛏️ 铁矿石 | 30G | 🥈 铁奖牌 | 罕见 | +5% |
| 🥇 金矿石 | 100G | 🥇 金奖牌 | 稀有 | +10% |
| 💠 秘银矿石 | 300G | 💠 秘银奖牌 | 史诗 | +15% |
| 💎 金刚石 | 1000G | 💎 金刚石奖牌 | 传说 | +25% |

奖牌**乘算叠加**。五枚铜奖牌 = 1.02⁵ ≈ **+10.4% XP**。不同稀有度混搭，收益指数增长。

### 🏆 成就 & 剧情
- **18 个成就** ⚔️ — 自动解锁，部分隐藏
- **6 章剧情** 📖 带 NPC 和奖励，随等级触发
- **热力图** 🟩 GitHub 同款，一眼看出哪天断了连击
- **月度视图** 🗓️ 预览未来 30 天

### 🔔 原生通知

给任务设置提醒时间。App 用 Android 原生 `AlarmManager` 调度闹钟——不是那种关了浏览器就没了的网页通知。App 关了、手机锁屏了，照样准时弹。

### 🛡️ 策略
- 从**简单/中等**开始，别一上来就史诗
- **先合铜奖牌**，便宜量足 +2%
- 每天至少完成一个 Habit，**保护 HP 别归零**
- **Plan** 给截止日，**Habit** 给日常节奏
- 记得开电池优化白名单，通知才准时

---

## 🔧 电池优化白名单

中国大陆手机（小米/OPPO/vivo）会杀后台。手动放行才能准时提醒：

- **小米**: 设置 → 应用设置 → LevelUp Life → 省电策略 → **无限制**
- **OPPO**: 设置 → 应用管理 → LevelUp Life → 耗电保护 → **允许后台运行**
- **vivo**: 设置 → 应用与权限 → LevelUp Life → 后台耗电 → **允许后台高耗电**

这不是我们的 bug，微信也得这么设。Android 系统层面的限制。

---

## 🛠 技术栈

Vite + React 18 · TypeScript · Tailwind CSS v4 · shadcn/ui · Capacitor 8 · 本地 SQLite · Android AlarmManager

---

## 💻 开发

```bash
npm install
npm run dev          # 浏览器开发模式
npm run build        # 生产构建

# 构建 APK
npx cap sync android
cd android && ./gradlew assembleDebug
```

推送 tag 后 GitHub Actions 自动构建 APK 并发布到 Releases。

需要 Java 17 + Android SDK。

---

## 📁 项目结构

```
src/
├── db/                  # 本地数据层
│   ├── connection.ts    # 初始化 + 建表
│   ├── tasks.ts         # 任务 CRUD
│   ├── user.ts          # 用户 + HP 结算
│   ├── shop.ts          # 矿石商店 + 合成
│   └── seed.ts          # 首次播种（成就、剧情）
├── lib/                 # 工具函数（从 web 复用）
├── hooks/               # useTasks, useStats, useConfetti
├── components/          # TaskCard, ShopDialog, BackpackDialog...
├── pages/               # Dashboard 主面板
├── notifications.ts     # 原生通知调度
└── main.tsx
```
