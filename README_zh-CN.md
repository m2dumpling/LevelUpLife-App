# LevelUp Life - Android

将日常任务变成 RPG 冒险 — 离线运行，原生通知。

> [English](./README.md) | [Web 版](https://github.com/m2dumpling/LevelUpLife)

## 下载

去 **[Releases](https://github.com/m2dumpling/LevelUpLife-mobile/releases)** → 下载最新 APK → 安装。

GitHub Actions 自动构建，始终最新。

## 功能

- **完全离线** — 无需网络，设备本地存储
- **原生通知** — Android `AlarmManager` 定时提醒，App 关了也能弹
- **Habit & Plan** — 每日/每周/每月习惯 + 星期多选；一次性任务带截止日期
- **XP 升级** — 完成任务赚 XP/金币，`100 × 等级^1.5` 升级曲线
- **HP 惩罚** — 每日缺勤扣 5HP，0HP 后 XP 收益 -10%
- **商店合成** — 买矿石 → 合奖牌 → 佩戴叠加 XP 加成
- **月度视图** — 预览未来 30 天 Habit 和 Plan
- **成就剧情** — 18 个成就 + 6 章故事线
- **界面一致** — Tailwind CSS v4 + shadcn/ui 暗色主题

## 首次使用

1. 下载 APK → 安装
2. 打开 App → 创建 Habit 或 Plan，设置提醒时间
3. 按提示允许通知权限
4. 到时间通知栏弹出 — App 关了也提醒

## 电池优化白名单

安装后关闭电池优化，确保通知准时：

- **小米**: 设置 → 应用设置 → LevelUp Life → 省电策略 → 无限制
- **OPPO**: 设置 → 应用管理 → LevelUp Life → 耗电保护 → 允许后台运行
- **vivo**: 设置 → 应用与权限 → LevelUp Life → 后台耗电 → 允许后台高耗电

## 技术栈

- Vite + React 18 + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Capacitor 8（WebView + 原生 API）
- WebView 本地持久化数据层
- Android 原生通知（`@capacitor/local-notifications`）

## 开发

```bash
npm install
npm run dev        # 浏览器模式（内存存储）
npm run build      # 生产构建

# Android
npx cap sync android
cd android && ./gradlew assembleDebug
```

需要 Java 17 + Android SDK。

## 项目结构

```
src/
├── db/                  # 本地数据层
│   ├── connection.ts    # 建表 + 初始化
│   ├── tasks.ts         # 任务 CRUD
│   ├── user.ts          # 用户 + HP 结算
│   └── seed.ts          # 首次播种（成就、剧情）
├── lib/                 # 工具函数（从 web 复用）
├── hooks/               # React hooks
├── components/          # UI 组件
├── pages/               # 登录页、主面板
├── notifications.ts     # 原生通知调度
└── main.tsx
```
