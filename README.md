# LevelUp Life — Android

Turn daily tasks into an RPG adventure — now on your phone, fully offline, with real notifications.

> [中文说明](./README_zh-CN.md) | [Web Version 🌐](https://github.com/m2dumpling/LevelUpLife)

---

## 📥 Download

Go to **[Releases](https://github.com/m2dumpling/LevelUpLife-App/releases)** → download the latest APK → install → done.

No sign-up. No cloud. No internet needed. Just install and play.

---

## 🎮 How to Play

You're a hero with a quest log. Every habit you keep = XP. Miss one = HP damage. It's an RPG where the boss is yourself.

### 📋 Two Quest Types

| | Habit 🔥 | Plan 📋 |
|------|---------|------|
| **What** | Your daily rituals: exercise, read, meditate, drink water... | One-shot mission: "Ship the feature by Friday" |
| **When** | Every day / week / month — pick specific weekdays | A date you choose |
| **Win** | Check in each cycle → XP + Gold pile up | Complete on the due date → big payout |

Tap **+ Create** → set difficulty → preview → confirm. Tap the circle ○ to check in and watch XP fly up with confetti.

### 📈 Level Up

> Trivial 5XP · Easy 10XP · Medium 20XP · Hard 40XP · Heroic 80XP

Formula: `xpToNext = 100 × level^1.5`. Level 1→2 is 100 XP. Level 50→51 is 35,000+. It gets harder — you get stronger.

### 💀 HP Penalty — Real Accountability

You start with **100 HP ❤️**. Miss a daily Habit → **-5 HP**. Hit zero → **-10% XP penalty** on everything.

Log in daily to heal **+20 HP**. The app rewards consistency, punishes excuses.

| HP | Status |
|----|--------|
| > 0 | Healthy — full XP earnings |
| 0 💀 | Weakened — **-10% XP** |

### ⚒️ Shop → Craft → Equip → Dominate

Gold isn't just decoration. Spend it strategically:

```
Shop 🏪 → buy ores → Craft ⚒️ → forge medals → Equip 🎒 → XP multiplier grows
```

| Ore | Price | Medal | Rarity | XP Bonus |
|-----|-------|-------|--------|----------|
| 🪨 Copper | 10G | 🥉 Copper Medal | Common | +2% |
| ⛏️ Iron | 30G | 🥈 Iron Medal | Uncommon | +5% |
| 🥇 Gold | 100G | 🥇 Gold Medal | Rare | +10% |
| 💠 Mithril | 300G | 💠 Mithril Medal | Epic | +15% |
| 💎 Adamantite | 1000G | 💎 Adamantite Medal | Legendary | +25% |

Medals **multiply**. Five Copper Medals = 1.02⁵ ≈ **+10.4% XP**. Combine rarities for exponential gains.

### 🏆 Achievements & Story
- **18 achievements** ⚔️ — unlock automatically, some hidden
- **6-chapter story** 📖 with NPCs and rewards, triggers as you level
- **Heatmap** 🟩 like GitHub contributions — never break the chain
- **Monthly view** 🗓️ preview the next 30 days

### 🔔 Native Notifications

Set a reminder time on any task. The app schedules a real Android alarm — not a flaky web notification. It fires even if the app is closed, even if the phone is locked.

### 🛡️ Strategy Tips
- Start with **Easy/Medium** habits — build momentum
- Stack **copper medals first** (cheap, fast +2%)
- Complete at least one Habit daily to **protect your HP**
- Use **Plan** for deadlines, **Habit** for rhythms
- Turn on battery optimization whitelist for reliable notifications

---

## 🔧 Battery Optimization

Chinese ROMs (Xiaomi/OPPO/vivo) aggressively kill background apps. Whitelist LevelUp Life so alarms fire on time:

- **Xiaomi**: Settings → Apps → LevelUp Life → Battery saver → **No restrictions**
- **OPPO**: Settings → App management → LevelUp Life → Power saver → **Allow background**
- **vivo**: Settings → Apps & permissions → LevelUp Life → Background power → **Allow**

All Android apps (including WeChat) need this. It's a system-level thing, not our bug.

---

## 🛠 Tech Stack

Vite + React 18 · TypeScript · Tailwind CSS v4 · shadcn/ui · Capacitor 8 · on-device SQLite · Android AlarmManager

---

## 💻 Development

```bash
npm install
npm run dev          # Browser dev mode
npm run build        # Production build

# Build APK
npx cap sync android
cd android && ./gradlew assembleDebug
```

APK is built automatically via GitHub Actions on every tag push.

Requires Java 17 + Android SDK.

---

## 📁 Project Structure

```
src/
├── db/                  # On-device storage layer
│   ├── connection.ts    # init + schema
│   ├── tasks.ts         # Task CRUD
│   ├── user.ts          # User + HP settlement
│   ├── shop.ts          # Ore shop + crafting
│   └── seed.ts          # First-run seed (achievements, story)
├── lib/                 # Shared logic (from web)
├── hooks/               # useTasks, useStats, useConfetti
├── components/          # TaskCard, ShopDialog, BackpackDialog, etc.
├── pages/               # Dashboard
├── notifications.ts     # Native alarm scheduling
└── main.tsx
```
