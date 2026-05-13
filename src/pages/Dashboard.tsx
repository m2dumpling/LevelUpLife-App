import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Package, Store, Monitor, Moon, Sun } from "lucide-react";
import {
  ensureNotificationPermissions,
  requestExactAlarmPermission,
  scheduleNotificationsQueued,
  scheduleTestNotificationIn,
} from "../notifications";
import { TaskCard } from "../components/TaskCard";
import { StatDashboard } from "../components/StatDashboard";
import { Heatmap } from "../components/Heatmap";
import { Timeline } from "../components/Timeline";
import { MonthlyView } from "../components/MonthlyView";
import { ShopDialog } from "../components/ShopDialog";
import { BackpackDialog } from "../components/BackpackDialog";
import { LevelUpModal } from "../components/LevelUpModal";
import { AchievementPopup } from "../components/AchievementPopup";
import { StoryDialog } from "../components/StoryDialog";
import { FloatingNumberContainer } from "../components/FloatingNumber";
import { Button } from "../components/ui/button";
import { Input, Label } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { useTasks, type Task } from "../hooks/useTasks";
import { useStats } from "../hooks/useStats";
import { getInventory } from "../db/shop";
import { getTodayLocal } from "../lib/date-utils";
import { syncStatusBar, type ThemeMode } from "../lib/native-ui";
import { Plus, Flame, CalendarDays, Search, ChevronDown, Clock, Target, AlertTriangle, Pencil } from "lucide-react";

type TabMode = "habit" | "plan";
type CompletionResult = Task & { leveledUp?: boolean; newLevel?: number; levelsGained?: number };

const DIFFICULTY_OPTIONS = [["trivial", "琐碎"], ["easy", "简单"], ["medium", "中等"], ["hard", "困难"], ["heroic", "史诗"]] as const;
const FREQUENCY_OPTIONS = [["daily", "每日"], ["weekly", "每周"], ["monthly", "每月"]] as const;
const TIMEOFDAY_OPTIONS = [["anytime", "随时"], ["morning", "早晨"], ["afternoon", "下午"], ["evening", "晚上"]] as const;
const WEEKDAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

const difficultyLabels: Record<string, string> = { trivial: "琐碎", easy: "简单", medium: "中等", hard: "困难", heroic: "史诗" };
const difficultyColors: Record<string, string> = { trivial: "text-muted-foreground", easy: "text-emerald-400", medium: "text-amber-400", hard: "text-orange-400", heroic: "text-purple-400" };
const xpRewards: Record<string, number> = { trivial: 5, easy: 10, medium: 20, hard: 40, heroic: 80 };
const goldRewards: Record<string, number> = { trivial: 1, easy: 3, medium: 5, hard: 10, heroic: 20 };
const frequencyLabels: Record<string, string> = { daily: "每日", weekly: "每周", monthly: "每月" };
const timeOfDayLabels: Record<string, string> = { morning: "早晨", afternoon: "下午", evening: "晚上", anytime: "随时" };

const themeOptions: Array<{ value: ThemeMode; label: string; Icon: typeof Monitor }> = [
  { value: "system", label: "跟随系统", Icon: Monitor },
  { value: "light", label: "白天", Icon: Sun },
  { value: "dark", label: "黑夜", Icon: Moon },
];

function groupPlansByDate(plans: Task[]) {
  const today = getTodayLocal();
  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, "0")}-${String(weekEnd.getDate()).padStart(2, "0")}`;

  const groups = { overdue: [] as Task[], dueToday: [] as Task[], dueTomorrow: [] as Task[], dueThisWeek: [] as Task[], dueFuture: [] as Task[], noTargetDate: [] as Task[] };
  for (const p of plans) {
    if (p.completed || p.status === "completed") continue;
    if (p.status === "failed") groups.overdue.push(p);
    else if (!p.targetDate) groups.noTargetDate.push(p);
    else if (p.targetDate < today) groups.overdue.push(p);
    else if (p.targetDate === today) groups.dueToday.push(p);
    else if (p.targetDate === tomorrowStr) groups.dueTomorrow.push(p);
    else if (p.targetDate <= weekEndStr) groups.dueThisWeek.push(p);
    else groups.dueFuture.push(p);
  }
  return groups;
}

export function Dashboard() {
  const { habits, plans, completed, loading: tasksLoading, addTask, editTask, completeTask, uncompleteTask, deleteTask } = useTasks();
  const { stats, refreshStats } = useStats();
  const [inventory, setInventory] = useState<Record<string, { quantity: number; equipped: boolean }>>({});
  const [shopOpen, setShopOpen] = useState(false);
  const [backpackOpen, setBackpackOpen] = useState(false);
  const [exactAlarmNeeded, setExactAlarmNeeded] = useState(false);

  useEffect(() => {
    void ensureNotificationPermissions().then((result) => {
      setExactAlarmNeeded(result.exactAlarm !== "not-android" && result.exactAlarm !== "unsupported" && !result.exactAlarmGranted);
    });
    void scheduleNotificationsQueued("dashboard-mount");

    const handler = () => setExactAlarmNeeded(true);
    window.addEventListener("leveluplife-exact-alarm-needed", handler);
    return () => window.removeEventListener("leveluplife-exact-alarm-needed", handler);
  }, []);
  useEffect(() => { getInventory().then(setInventory).catch(() => {}); }, []);
  useEffect(() => {
    const h = () => { getInventory().then(setInventory); refreshStats(); };
    window.addEventListener("inventory-changed", h);
    return () => window.removeEventListener("inventory-changed", h);
  }, [refreshStats]);

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("leveluplife-theme");
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    localStorage.setItem("leveluplife-theme", themeMode);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncNativeUi = () => {
      void syncStatusBar(themeMode);
    };

    syncNativeUi();
    if (themeMode !== "system") return;
    media.addEventListener("change", syncNativeUi);
    return () => media.removeEventListener("change", syncNativeUi);
  }, [themeMode]);

  const [activeTab, setActiveTab] = useState<TabMode>("habit");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogStep, setDialogStep] = useState<"form" | "confirm">("form");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDiff, setNewDiff] = useState("easy");
  const [newFreq, setNewFreq] = useState("daily");
  const [newTod, setNewTod] = useState("anytime");
  const [newFreqDays, setNewFreqDays] = useState<string[]>([]);
  const [newTarget, setNewTarget] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newReminderTime, setNewReminderTime] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterDiff, setFilterDiff] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "incomplete" | "completed">("all");

  const [levelUpData, setLevelUpData] = useState<{ open: boolean; level: number; gained: number }>({ open: false, level: 0, gained: 0 });
  const [storyEvent, setStoryEvent] = useState<{ id: number; chapterKey: string; title: string; dialogue: string; npcName: string; reward: string | null } | null>(null);
  const resetForm = () => {
    setNewTitle(""); setNewDesc(""); setNewDiff("easy"); setNewFreq("daily"); setNewTod("anytime");
    setNewFreqDays([]); setNewTarget(""); setNewStart(""); setNewEnd(""); setNewReminderTime("");
    setFormError(""); setDialogStep("form");
  };

  const prefillEdit = (task: Task) => {
    setNewTitle(task.title); setNewDesc(task.description || ""); setNewDiff(task.difficulty);
    if (task.mode === "habit") {
      setNewFreq(task.frequency || "daily"); setNewTod(task.timeOfDay || "anytime");
      setNewFreqDays(task.frequencyDays ? task.frequencyDays.split(",") : []);
      setNewStart(task.startDate || ""); setNewEnd(task.endDate || "");
      setNewReminderTime(task.reminderTime || ""); setNewTarget("");
    } else {
      setNewTarget(task.targetDate || ""); setNewReminderTime(task.reminderTime || "");
      setNewFreq("daily"); setNewTod("anytime"); setNewFreqDays([]); setNewStart(""); setNewEnd("");
    }
    setEditingTask(task); setDialogMode("edit"); setDialogStep("form"); setDialogOpen(true);
  };

  const [formError, setFormError] = useState("");

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setFormError("");
    const fd = newFreqDays.length > 0 && newFreqDays.length < 7 ? newFreqDays.join(",") : undefined;
    try {
      const task = await addTask({
        title: newTitle.trim(), mode: activeTab, description: newDesc.trim() || undefined,
        difficulty: newDiff, frequency: activeTab === "habit" ? newFreq : undefined,
        timeOfDay: activeTab === "habit" ? newTod : undefined, frequencyDays: activeTab === "habit" ? fd : undefined,
        targetDate: activeTab === "plan" && newTarget ? newTarget : undefined,
        startDate: activeTab === "habit" && newStart ? newStart : undefined,
        endDate: activeTab === "habit" && newEnd ? newEnd : undefined,
        reminderTime: newReminderTime || undefined,
      });
      if (!task) { setFormError("创建失败，请重试"); return; }
      resetForm(); setDialogOpen(false);
    } catch (e) {
      setFormError("创建失败: " + String(e));
    }
  };

  const handleEdit = async () => {
    if (!editingTask || !newTitle.trim()) return;
    setFormError("");
    const fd = newFreqDays.length > 0 && newFreqDays.length < 7 ? newFreqDays.join(",") : "";
    const data: Record<string, unknown> = { title: newTitle.trim(), description: newDesc.trim() || null, difficulty: newDiff };
    if (editingTask.mode === "habit") {
      data.frequency = newFreq; data.timeOfDay = newTod; data.frequencyDays = fd;
      data.startDate = newStart || null; data.endDate = newEnd || null; data.reminderTime = newReminderTime || null;
    } else {
      data.targetDate = newTarget || null; data.reminderTime = newReminderTime || null;
    }
    try {
      const result = await editTask(editingTask.id, data);
      if (!result) { setFormError("保存失败，请重试"); return; }
      resetForm(); setEditingTask(null); setDialogOpen(false);
    } catch (e) {
      setFormError("保存失败: " + String(e));
    }
  };

  const handleComplete = useCallback(async (id: number) => {
    const result = (await completeTask(id)) as CompletionResult | null;
    if (result?.leveledUp) {
      setLevelUpData({ open: true, level: result.newLevel!, gained: result.levelsGained! });
    }
    refreshStats();
  }, [completeTask, refreshStats]);

  const handleUndo = useCallback(async (id: number) => {
    await uncompleteTask(id);
    refreshStats();
  }, [uncompleteTask, refreshStats]);

  const filterTasks = (list: Task[]) => list.filter((t) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q)) return false;
    }
    if (filterDiff !== "all" && t.difficulty !== filterDiff) return false;
    if (filterStatus === "completed" && !t.completed) return false;
    if (filterStatus === "incomplete" && t.completed) return false;
    return true;
  });

  const habitList = filterTasks(habits).sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.sortOrder - b.sortOrder;
  });
  const activeHabitList = habitList.filter((t) => !t.completed);
  const completedHabits = filterTasks(completed.filter((t) => t.mode === "habit"));

  const planGroups = groupPlansByDate(filterTasks(plans.filter((p) => !p.completed && p.status !== "completed")));
  const completedPlans = filterTasks(completed.filter((t) => t.mode === "plan"));
  const visiblePlanCount = Object.values(planGroups).reduce((sum, group) => sum + group.length, 0);

  const tabLabel = activeTab === "habit" ? "Habit" : "Plan";
  const tabIcon = activeTab === "habit" ? <Flame className="w-4 h-4" /> : <CalendarDays className="w-4 h-4" />;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-status-spacer" />
        <div className="app-header-inner max-w-4xl mx-auto flex-wrap">
          <div className="flex min-w-0 items-center gap-2">
            <Swords className="w-5 h-5 text-primary" />
            <span className="truncate text-sm font-bold text-foreground">LevelUp Life</span>
          </div>
          {stats && (
            <div className="ml-auto flex shrink-0 items-center gap-3">
              <div><span className="text-[10px] text-muted-foreground uppercase">Lv</span> <span className="text-sm font-bold text-primary">{stats.level}</span></div>
              <div><span className="text-[10px] text-muted-foreground uppercase">XP</span> <span className="text-sm font-bold text-emerald-400">{stats.xp}</span></div>
              <div><span className="text-[10px] text-muted-foreground uppercase">G</span> <span className="text-sm font-bold text-amber-400">{stats.gold}</span></div>
            </div>
          )}
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button onClick={() => setShopOpen(true)} className="inline-flex shrink-0 items-center justify-center gap-1 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-card hover:border-primary/40 transition-colors">
              <Store className="w-3.5 h-3.5" />商店
            </button>
            <button onClick={() => setBackpackOpen(true)} className="inline-flex shrink-0 items-center justify-center gap-1 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-card hover:border-primary/40 transition-colors">
              <Package className="w-3.5 h-3.5" />背包
            </button>
            <div className="ml-auto inline-flex rounded-md border border-border bg-card/70 p-0.5 sm:ml-0">
              {themeOptions.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  title={label}
                  aria-label={label}
                  onClick={() => setThemeMode(value)}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors ${
                    themeMode === value ? "bg-background text-primary shadow-sm" : "hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="app-main max-w-4xl mx-auto space-y-4">
        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <MonthlyView habits={habits} plans={plans} />
          {import.meta.env.DEV && (
            <Button variant="outline" size="sm" onClick={() => void scheduleTestNotificationIn(10)}>
              10s test notification
            </Button>
          )}
        </div>

        {exactAlarmNeeded && (
          <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            <div className="flex flex-wrap items-center gap-2">
              <span>Exact alarm permission is off. Reminders may be delayed on Android 12+.</span>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const status = await requestExactAlarmPermission();
                  setExactAlarmNeeded(status !== "granted" && status !== "not-android" && status !== "unsupported");
                  await scheduleNotificationsQueued("exact-alarm-setting");
                }}
              >
                Open alarm settings
              </Button>
            </div>
          </div>
        )}

        <ShopDialog open={shopOpen} onOpenChange={setShopOpen} gold={stats?.gold ?? 0} inventory={inventory} onBuy={() => { getInventory().then(setInventory); refreshStats(); }} />
        <BackpackDialog open={backpackOpen} onOpenChange={setBackpackOpen} inventory={inventory} onUpdate={() => { getInventory().then(setInventory); refreshStats(); }} />

        {/* Stats */}
        <StatDashboard stats={stats} loading={tasksLoading} />

        {/* Tab bar + search */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            {(["habit", "plan"] as TabMode[]).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`relative px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {activeTab === tab && <motion.div layoutId="tabBg" className="absolute inset-0 bg-card rounded-md border border-border" transition={{ duration: 0.2 }} />}
                <span className="relative z-10 flex items-center gap-1.5">{tab === "habit" ? <Flame className="w-3.5 h-3.5" /> : <CalendarDays className="w-3.5 h-3.5" />}{tab === "habit" ? "Habit" : "Plan"}</span>
              </button>
            ))}
          </div>

          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setDialogStep("form"); setEditingTask(null); } }}>
            <DialogTrigger onClick={() => { resetForm(); setDialogMode("create"); setEditingTask(null); }}>
              <button type="button" className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-transparent px-3 py-1.5 text-sm font-medium text-foreground hover:bg-card hover:border-primary/40 transition-colors">
                <Plus className="w-4 h-4" />新建{tabLabel}
              </button>
            </DialogTrigger>
            <DialogContent onOpenAutoFocus={(event) => event.preventDefault()}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">{tabIcon}{dialogMode === "edit" ? "编辑" : "新建"}{tabLabel}</DialogTitle>
              </DialogHeader>
              {dialogStep === "confirm" ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
                    <div className="mb-3 flex items-center gap-2 text-base font-medium">
                      {activeTab === "habit" ? <Flame className="h-4 w-4 text-orange-400" /> : <Target className="h-4 w-4 text-amber-400" />}
                      确认{activeTab === "habit" ? "Habit" : "Plan"}
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                      <span className="text-muted-foreground">名称</span><span className="font-medium">{newTitle}</span>
                      <span className="text-muted-foreground">难度</span><span className={difficultyColors[newDiff] || ""}>{difficultyLabels[newDiff]} (+{xpRewards[newDiff]} XP, +{goldRewards[newDiff]} G)</span>
                      {activeTab === "habit" && (<><span className="text-muted-foreground">频次</span><span>{frequencyLabels[newFreq]}</span>{newTod !== "anytime" && (<><span className="text-muted-foreground">时段</span><span>{timeOfDayLabels[newTod]}</span></>)}{newStart && <><span className="text-muted-foreground">开始</span><span>{newStart}</span></>}{newEnd && <><span className="text-muted-foreground">结束</span><span>{newEnd}</span></>}{newReminderTime && <><span className="text-muted-foreground">时间</span><span>{newReminderTime}</span></>}</>)}
                      {activeTab === "plan" && (<>{newTarget && <><span className="text-muted-foreground">日期</span><span>{newTarget}</span></>}{newReminderTime && <><span className="text-muted-foreground">时间</span><span>{newReminderTime}</span></>}</>)}
                      {newDesc && <><span className="text-muted-foreground">描述</span><span className="text-muted-foreground">{newDesc}</span></>}
                    </div>
                  </div>
                  {formError && <p className="rounded-md bg-red-400/5 px-3 py-2 text-xs text-red-400">{formError}</p>}
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setDialogStep("form")} className="flex-1">返回修改</Button>
                    <Button onClick={handleCreate} className="flex-1"><Plus className="mr-1.5 h-4 w-4" />确认创建</Button>
                  </div>
                </div>
              ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>名称</Label>
                  <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={activeTab === "habit" ? "例如：每天运动 30 分钟" : "例如：周五前提交报告"} />
                </div>
                <div className="space-y-1.5">
                  <Label>描述（可选）</Label>
                  <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="补充说明..." />
                </div>
                <div className="space-y-1.5">
                  <Label>难度</Label>
                  <div className="flex gap-2 flex-wrap">
                    {DIFFICULTY_OPTIONS.map(([v, l]) => (
                      <button key={v} onClick={() => setNewDiff(v)} className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${newDiff === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>{l}</button>
                    ))}
                  </div>
                </div>
                {activeTab === "habit" && (
                  <>
                    <div className="space-y-1.5">
                      <Label>频次</Label>
                      <div className="flex gap-2">
                        {FREQUENCY_OPTIONS.map(([v, l]) => (
                          <button key={v} onClick={() => setNewFreq(v)} className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${newFreq === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>{l}</button>
                        ))}
                      </div>
                    </div>
                    {newFreq === "weekly" && (
                      <div className="space-y-1.5">
                        <Label>星期</Label>
                        <div className="flex gap-1.5">
                          {WEEKDAY_NAMES.map((n, i) => {
                            const d = String(i); const active = newFreqDays.includes(d);
                            return <button key={d} onClick={() => setNewFreqDays((p) => active ? p.filter((x) => x !== d) : [...p, d])}
                              className={`w-8 h-8 text-xs rounded-md border ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>{n}</button>;
                          })}
                        </div>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label>时间段</Label>
                      <div className="flex gap-2 flex-wrap">
                        {TIMEOFDAY_OPTIONS.map(([v, l]) => (
                          <button key={v} onClick={() => setNewTod(v)} className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${newTod === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>{l}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>时间（可选）</Label>
                      <Input type="time" value={newReminderTime} onChange={(e) => setNewReminderTime(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>开始日期（可选）</Label>
                      <Input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>结束日期（可选）</Label>
                      <Input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
                    </div>
                  </>
                )}
                {activeTab === "plan" && (
                  <>
                    <div className="space-y-1.5">
                      <Label>执行日期</Label>
                      <Input type="date" value={newTarget} onChange={(e) => setNewTarget(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>时间（可选）</Label>
                      <Input type="time" value={newReminderTime} onChange={(e) => setNewReminderTime(e.target.value)} />
                    </div>
                  </>
                )}

                {formError && <p className="text-xs text-red-400 bg-red-400/5 rounded-md px-3 py-2">{formError}</p>}

                {dialogStep === "form" && dialogMode === "edit" ? (
                  <Button onClick={handleEdit} className="w-full" disabled={!newTitle.trim()}><Pencil className="w-4 h-4 mr-1.5" />保存修改</Button>
                ) : dialogStep === "form" ? (
                  <Button onClick={() => setDialogStep("confirm")} className="w-full" disabled={!newTitle.trim()}>预览</Button>
                ) : (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 text-sm">
                      <div className="flex items-center gap-2 text-base font-medium">
                        {activeTab === "habit" ? <Flame className="w-4 h-4 text-orange-400" /> : <Target className="w-4 h-4 text-amber-400" />}
                        确认{activeTab === "habit" ? "Habit" : "Plan"}
                      </div>
                      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                        <span className="text-muted-foreground">名称</span><span className="font-medium">{newTitle}</span>
                        <span className="text-muted-foreground">难度</span><span className={difficultyColors[newDiff] || ""}>{difficultyLabels[newDiff]} (+{xpRewards[newDiff]} XP, +{goldRewards[newDiff]} G)</span>
                        {activeTab === "habit" && (<><span className="text-muted-foreground">频次</span><span>{frequencyLabels[newFreq]}</span>{newTod !== "anytime" && (<><span className="text-muted-foreground">时段</span><span>{timeOfDayLabels[newTod]}</span></>)}{newStart && <><span className="text-muted-foreground">开始</span><span>{newStart}</span></>}{newEnd && <><span className="text-muted-foreground">结束</span><span>{newEnd}</span></>}{newReminderTime && <><span className="text-muted-foreground">时间</span><span>{newReminderTime}</span></>}</>)}
                        {activeTab === "plan" && (<>{newTarget && <><span className="text-muted-foreground">日期</span><span>{newTarget}</span></>}{newReminderTime && <><span className="text-muted-foreground">时间</span><span>{newReminderTime}</span></>}</>)}
                        {newDesc && <><span className="text-muted-foreground">描述</span><span className="text-muted-foreground">{newDesc}</span></>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setDialogStep("form")} className="flex-1">返回修改</Button>
                      <Button onClick={handleCreate} className="flex-1"><Plus className="w-4 h-4 mr-1.5" />确认创建</Button>
                    </div>
                  </div>
                )}
              </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Search & filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="搜索任务..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-9 text-sm" />
          </div>
          <select value={filterDiff} onChange={(e) => setFilterDiff(e.target.value)} className="h-9 px-2 text-xs rounded-md border border-border bg-card text-foreground">
            <option value="all">全部难度</option>
            {DIFFICULTY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => {
              const value = e.target.value;
              if (value === "all" || value === "incomplete" || value === "completed") setFilterStatus(value);
            }}
            className="h-9 px-2 text-xs rounded-md border border-border bg-card text-foreground"
          >
            <option value="all">全部状态</option>
            <option value="incomplete">未完成</option>
            <option value="completed">已完成</option>
          </select>
        </div>

        {/* Task lists */}
        {activeTab === "habit" && (
          tasksLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-card animate-pulse rounded-lg" />)}</div>
          ) : habitList.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Flame className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-lg mb-2">暂无 Habit</p>
              <p className="text-sm">点击「新建 Habit」创建每日修行！</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 mb-1.5 text-xs text-muted-foreground">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <span className="font-medium uppercase tracking-wide">待完成</span>
                  <span className="opacity-50">{activeHabitList.length}</span>
                </div>
                <AnimatePresence mode="popLayout">
                  {activeHabitList.map((task) => (
                    <TaskCard key={task.id} task={task} onComplete={handleComplete} onDelete={deleteTask} onEdit={prefillEdit} onUncomplete={handleUndo} />
                  ))}
                </AnimatePresence>
              </div>

              {completedHabits.length > 0 && (
                <div className="mt-4">
                  <button onClick={() => setShowCompleted(!showCompleted)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2">
                    <motion.span animate={{ rotate: showCompleted ? 180 : 0 }}><ChevronDown className="w-4 h-4" /></motion.span>
                    已完成 ({completedHabits.length})
                  </button>
                  <AnimatePresence>
                    {showCompleted && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-1.5 overflow-hidden">
                        {completedHabits.map((task) => (
                          <TaskCard key={task.id} task={task} onComplete={handleComplete} onDelete={deleteTask} onEdit={prefillEdit} onUncomplete={handleUndo} />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )
        )}

        {activeTab === "plan" && (
          tasksLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-card animate-pulse rounded-lg" />)}</div>
          ) : plans.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-lg mb-2">暂无 Plan</p>
              <p className="text-sm">点击「新建 Plan」开启新的冒险！</p>
            </div>
          ) : (
            <div className="space-y-4">
              {visiblePlanCount === 0 && (
                <div className="rounded-lg border border-border bg-card px-3 py-4 text-center text-sm text-muted-foreground">
                  没有待办 Plan，可能都已完成或已过期。
                </div>
              )}
              {([
                { label: "已过期", icon: <AlertTriangle className="w-4 h-4 text-red-400" />, tasks: planGroups.overdue },
                { label: "今天", icon: <Clock className="w-4 h-4 text-amber-400" />, tasks: planGroups.dueToday },
                { label: "明天", icon: null, tasks: planGroups.dueTomorrow },
                { label: "本周", icon: null, tasks: planGroups.dueThisWeek },
                { label: "未来", icon: null, tasks: planGroups.dueFuture },
                { label: "未设日期", icon: null, tasks: planGroups.noTargetDate },
              ] as const).filter((g) => g.tasks.length > 0).map((g) => (
                <div key={g.label}>
                  <div className="flex items-center gap-2 mb-1.5 text-xs text-muted-foreground">
                    {g.icon}<span className="font-medium uppercase tracking-wide">{g.label}</span>
                    <span className="opacity-50">{g.tasks.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {g.tasks.map((t) => (
                      <TaskCard key={t.id} task={t} onComplete={handleComplete} onDelete={deleteTask} onEdit={prefillEdit} onUncomplete={handleUndo} />
                    ))}
                  </div>
                </div>
              ))}

              {completedPlans.length > 0 && (
                <div className="mt-4">
                  <button onClick={() => setShowCompleted(!showCompleted)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-2">
                    <motion.span animate={{ rotate: showCompleted ? 180 : 0 }}><ChevronDown className="w-4 h-4" /></motion.span>
                    已完成 ({completedPlans.length})
                  </button>
                  <AnimatePresence>
                    {showCompleted && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-1.5 overflow-hidden">
                        {completedPlans.map((t) => <TaskCard key={t.id} task={t} onComplete={handleComplete} onDelete={deleteTask} onEdit={prefillEdit} onUncomplete={handleUndo} />)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )
        )}
        <Heatmap />
        <Timeline />
      </main>

      <LevelUpModal
        open={levelUpData.open}
        level={levelUpData.level}
        levelsGained={levelUpData.gained}
        onClose={() => setLevelUpData({ open: false, level: 0, gained: 0 })}
      />
      <AchievementPopup />
      {storyEvent && <StoryDialog event={storyEvent} onClose={() => setStoryEvent(null)} />}
      <FloatingNumberContainer />
    </div>
  );
}
