# LevelUp Life - Android

Turn daily tasks into an RPG adventure — now on your phone, offline.

> [中文说明](./README_zh-CN.md) | [Web Version](https://github.com/m2dumpling/LevelUpLife)

## Download

Go to **[Releases](https://github.com/m2dumpling/LevelUpLife-mobile/releases)** → download the latest APK → install.

Built automatically via GitHub Actions — always up to date.

## Features

- **Offline-first** — no internet needed, local on-device storage
- **Native notifications** — Android `AlarmManager` fires reminders even when app is closed
- **Habit & Plan** — daily/weekly/monthly habits with multi-select weekdays; one-time quests with target dates
- **XP & Leveling** — earn XP/Gold for completing tasks, level up with `100 × level^1.5` formula
- **HP Penalty** — miss a daily habit, lose 5 HP. 0 HP = -10% XP
- **Shop & Craft** — buy ores, craft medals, equip for stacked XP bonuses
- **Monthly View** — preview the next 30 days of Habits and Plans
- **Achievements & Story** — 18 achievements + 6-chapter storyline
- **Same UI as web** — Tailwind CSS v4 + shadcn/ui, dark theme

## First Run

1. Install APK → open
2. Create a Habit or Plan with a reminder time
3. Allow notification permission when prompted
4. Notification fires at the scheduled time — even if app is closed

## Battery Optimization (Chinese ROMs)

After install, whitelist the app so notifications work reliably:

- **Xiaomi**: Settings → Apps → LevelUp Life → Battery saver → No restrictions
- **OPPO**: Settings → App management → LevelUp Life → Power saver → Allow background
- **vivo**: Settings → Apps & permissions → LevelUp Life → Background power → Allow

## Tech Stack

- Vite + React 18 + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Capacitor 8 (WebView + native APIs)
- Local WebView storage data layer
- Android native notifications (`@capacitor/local-notifications`)

## Development

```bash
npm install
npm run dev        # Browser mode (in-memory storage for testing)
npm run build      # Production build

# Android
npx cap sync android
cd android && ./gradlew assembleDebug
```

Requires Java 17 + Android SDK.

## Project Structure

```
src/
├── db/                  # Local data layer
│   ├── connection.ts    # DB init + schema
│   ├── tasks.ts         # Task CRUD
│   ├── user.ts          # User + HP settlement
│   └── seed.ts          # First-run seed (achievements, story)
├── lib/                 # Shared utilities (from web)
├── hooks/               # React hooks
├── components/          # UI components
├── pages/               # Login, Dashboard
├── notifications.ts     # Native notification scheduling
└── main.tsx
```
