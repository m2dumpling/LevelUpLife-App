import { useEffect, useState, useCallback, useMemo } from "react";
import { getLogs } from "../db/logs";
import type { LogEntry } from "../db/logs";

// GitHub 风格 5 级绿色热力图
const COLORS = [
  "var(--heatmap-0)",
  "var(--heatmap-1)",
  "var(--heatmap-2)",
  "var(--heatmap-3)",
  "var(--heatmap-4)",
];
const MONTH_NAMES = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
const DAY_LABELS_FULL = ["日", "一", "二", "三", "四", "五", "六"];
const DAY_LABELS_YEAR = ["", "一", "", "三", "", "五", ""];

type ViewMode = "week" | "month" | "year";

function xpToLevel(xp: number): number {
  if (xp === 0)  return 0;
  if (xp <= 10)  return 1;
  if (xp <= 30)  return 2;
  if (xp <= 60)  return 3;
  return 4;
}

// 扁平 cell 数据结构
interface FlatCell {
  date: string;
  xp: number;
  isToday: boolean;
  colIdx: number;
  rowIdx: number;
  dayLabel?: string;
}

// Cell 生成 —— 周
function generateWeekCells(data: Map<string, number>, today: Date, todayStr: string): FlatCell[] {
  const dayOfWeek = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek);

  const cells: FlatCell[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const dateStr = formatLocalDate(d);
    const xp = data.get(dateStr) ?? 0;
    cells.push({
      date: dateStr,
      xp,
      isToday: dateStr === todayStr,
      colIdx: i,
      rowIdx: 0,
      dayLabel: String(d.getDate()),
    });
  }
  return cells;
}

// Cell 生成 —— 月（日历布局）
function generateMonthCells(data: Map<string, number>, today: Date, todayStr: string): FlatCell[] {
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const cells: FlatCell[] = [];
  let currentDate = 1;

  for (let week = 0; week < 6; week++) {
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      if ((week === 0 && dayOfWeek < startDayOfWeek) || currentDate > totalDays) {
        cells.push({ date: "", xp: 0, isToday: false, colIdx: dayOfWeek, rowIdx: week });
      } else {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(currentDate).padStart(2, "0")}`;
        const xp = data.get(dateStr) ?? 0;
        cells.push({
          date: dateStr,
          xp,
          isToday: dateStr === todayStr,
          colIdx: dayOfWeek,
          rowIdx: week,
          dayLabel: String(currentDate),
        });
        currentDate++;
      }
    }
  }

  return cells;
}

// Cell 生成 —— 年（GitHub 风格 53 列）
function generateYearCells(
  data: Map<string, number>,
  today: Date,
  todayStr: string,
): { cells: FlatCell[]; monthLabels: { colIdx: number; label: string }[] } {
  const start = new Date(today);
  start.setDate(start.getDate() - 370);
  while (start.getDay() !== 0) start.setDate(start.getDate() - 1);

  const rawCells: { date: string; dayOfWeek: number; isToday: boolean }[] = [];
  const cursor = new Date(start);
  while (cursor <= today) {
    const ds = formatLocalDate(cursor);
    rawCells.push({ date: ds, dayOfWeek: cursor.getDay(), isToday: ds === todayStr });
    cursor.setDate(cursor.getDate() + 1);
  }

  const cols: { date: string; dayOfWeek: number; isToday: boolean }[][] = [];
  let col: typeof rawCells = [];
  for (const c of rawCells) {
    col.push(c);
    if (c.dayOfWeek === 6) { cols.push(col); col = []; }
  }
  if (col.length > 0) cols.push(col);

  const recentCols = cols.slice(-53);

  const monthLabels: { colIdx: number; label: string }[] = [];
  recentCols.forEach((c, ci) => {
    if (c.length === 0) return;
    const month = new Date(c[0].date + "T12:00:00").getMonth();
    const label = MONTH_NAMES[month];
    if (monthLabels.length === 0 || monthLabels[monthLabels.length - 1].label !== label) {
      monthLabels.push({ colIdx: ci, label });
    }
  });

  const cells: FlatCell[] = [];
  recentCols.forEach((c, ci) => {
    for (let r = 0; r < 7; r++) {
      const day = c.find(d => d.dayOfWeek === r);
      const xp = day ? data.get(day.date) ?? 0 : 0;
      cells.push({
        date: day?.date ?? "",
        xp,
        isToday: day?.isToday ?? false,
        colIdx: ci,
        rowIdx: r,
      });
    }
  });

  return { cells, monthLabels };
}

// 主组件
export function Heatmap() {
  const [data, setData] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; xp: number } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("month");

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const todayStr = useMemo(() => formatLocalDate(today), [today]);

  const fetchData = useCallback(async () => {
    try {
      const logs: LogEntry[] = await getLogs(366);
      const m = new Map<string, number>();
      for (const l of logs) m.set(l.date, (m.get(l.date) ?? 0) + l.xpEarned);
      setData(m);
    } catch {
      // 静默失败
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(fetchData);
  }, [fetchData]);

  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("task-completed", handler);
    return () => window.removeEventListener("task-completed", handler);
  }, [fetchData]);

  // 滚动时关闭 tooltip（移动端适配）
  useEffect(() => {
    const dismiss = () => setTooltip(null);
    window.addEventListener("scroll", dismiss, { passive: true });
    return () => window.removeEventListener("scroll", dismiss);
  }, []);

  // 按视图模式生成 cell
  const weekCells = useMemo(() => generateWeekCells(data, today, todayStr), [data, today, todayStr]);
  const monthCells = useMemo(() => generateMonthCells(data, today, todayStr), [data, today, todayStr]);
  const { cells: yearCells, monthLabels } = useMemo(() => generateYearCells(data, today, todayStr), [data, today, todayStr]);

  // 当前视图的标题
  const viewTitle = useMemo(() => {
    if (viewMode === "week") {
      const sun = new Date(today);
      sun.setDate(today.getDate() - today.getDay());
      const sat = new Date(sun);
      sat.setDate(sun.getDate() + 6);
      return `${sun.getMonth() + 1}/${sun.getDate()} - ${sat.getMonth() + 1}/${sat.getDate()}`;
    }
    if (viewMode === "month") {
      return `${today.getFullYear()}年${today.getMonth() + 1}月`;
    }
    return "最近一年";
  }, [viewMode, today]);

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">活跃度热力图</h3>
        </div>
        <div className="h-28 bg-card animate-pulse rounded-xl" />
      </div>
    );
  }

  const cellSize = viewMode === "year" ? 12 : viewMode === "month" ? 30 : 40;
  const cellGap = viewMode === "year" ? 3 : 4;

  return (
    <div className="space-y-2" onMouseLeave={() => setTooltip(null)}>
      {/* 顶栏：切换按钮 + 标题 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-0.5 bg-muted rounded-lg p-0.5">
          {(["week", "month", "year"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`relative px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === mode
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {viewMode === mode && (
                <div className="absolute inset-0 bg-card rounded-md border border-border" />
              )}
              <span className="relative z-10">
                {mode === "week" ? "周" : mode === "month" ? "月" : "年"}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{viewTitle}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        {/* 年视图 —— GitHub 风格 */}
        {viewMode === "year" && (
          <div className="inline-flex" style={{ gap: 0 }}>
            {/* 左侧星期标签 */}
            <div className="flex flex-col shrink-0" style={{ gap: cellGap, paddingTop: 18, marginRight: 4 }}>
              {DAY_LABELS_YEAR.map((label, i) => (
                <div key={i} className="flex items-center justify-end" style={{ width: 22, height: cellSize }}>
                  <span className="text-[9px] text-muted-foreground/60">{label}</span>
                </div>
              ))}
            </div>

            <div>
              {/* 月份标签 */}
              <div className="relative" style={{ height: 18 }}>
                {monthLabels.map((m, i) => (
                  <span
                    key={i}
                    className="absolute text-[9px] text-muted-foreground/60"
                    style={{ left: m.colIdx * (cellSize + cellGap) }}
                  >
                    {m.label}
                  </span>
                ))}
              </div>

              {/* 网格 */}
              <div
                style={{
                  display: "grid",
                  gridTemplateRows: `repeat(7, ${cellSize}px)`,
                  gridAutoFlow: "column",
                  gridAutoColumns: `${cellSize}px`,
                  gap: cellGap,
                }}
              >
                {yearCells.map((cell, i) => {
                  const level = xpToLevel(cell.xp);
                  return (
                    <CellBlock
                      key={i}
                      cell={cell}
                      level={level}
                      size={cellSize}
                      onHover={setTooltip}
                    />
                  );
                })}
              </div>

              {/* 图例 */}
              <Legend cellSize={cellSize} />
            </div>
          </div>
        )}

        {/* 月视图 —— 日历布局 */}
        {viewMode === "month" && (
          <div className="inline-flex flex-col">
            {/* 列头 */}
            <div
              className="grid mb-1"
              style={{
                gridTemplateColumns: `repeat(7, ${cellSize}px)`,
                gap: cellGap,
              }}
            >
              {DAY_LABELS_FULL.map((label, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center"
                  style={{ width: cellSize, height: 16 }}
                >
                  <span className="text-[10px] text-muted-foreground/60">{label}</span>
                </div>
              ))}
            </div>

            {/* 日期网格 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(7, ${cellSize}px)`,
                gap: cellGap,
              }}
            >
              {monthCells.map((cell, i) => {
                const level = xpToLevel(cell.xp);
                return (
                  <CellBlock
                    key={i}
                    cell={cell}
                    level={level}
                    size={cellSize}
                    showLabel
                    onHover={setTooltip}
                  />
                );
              })}
            </div>

            <Legend cellSize={cellSize} />
          </div>
        )}

        {/* 周视图 —— 单行 7 天 */}
        {viewMode === "week" && (
          <div className="inline-flex flex-col">
            {/* 列头 */}
            <div
              className="grid mb-1"
              style={{
                gridTemplateColumns: `repeat(7, ${cellSize}px)`,
                gap: cellGap,
              }}
            >
              {DAY_LABELS_FULL.map((label, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center"
                  style={{ width: cellSize, height: 16 }}
                >
                  <span className="text-[10px] text-muted-foreground/60">{label}</span>
                </div>
              ))}
            </div>

            {/* 单行 7 格 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(7, ${cellSize}px)`,
                gap: cellGap,
              }}
            >
              {weekCells.map((cell, i) => {
                const level = xpToLevel(cell.xp);
                return (
                  <CellBlock
                    key={i}
                    cell={cell}
                    level={level}
                    size={cellSize}
                    showLabel
                    onHover={setTooltip}
                  />
                );
              })}
            </div>

            <Legend cellSize={cellSize} />
          </div>
        )}
      </div>

      {/* 悬浮提示 */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-popover border border-border rounded-md px-2.5 py-1.5 shadow-lg"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="text-xs font-medium whitespace-nowrap">{formatDateCN(tooltip.date)}</p>
          <p className="text-xs text-muted-foreground">
            <span className="text-emerald-400 font-semibold">{tooltip.xp}</span> XP
          </p>
        </div>
      )}
    </div>
  );
}

// 单元格渲染
function CellBlock({
  cell,
  level,
  size,
  showLabel,
  onHover,
}: {
  cell: FlatCell;
  level: number;
  size: number;
  showLabel?: boolean;
  onHover: (t: { x: number; y: number; date: string; xp: number } | null) => void;
}) {
  const isEmpty = !cell.date;
  if (isEmpty) {
    return <div style={{ width: size, height: size }} />;
  }

  return (
    <div
      className="relative rounded-[2px] cursor-pointer transition-transform hover:scale-125 hover:z-10 flex items-center justify-center"
      style={{ width: size, height: size, backgroundColor: COLORS[level] ?? COLORS[0] }}
      onMouseEnter={(e) => {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        onHover({ x: rect.left + rect.width / 2, y: rect.top - 8, date: cell.date, xp: cell.xp });
      }}
      onMouseLeave={() => onHover(null)}
    >
      {/* 今日高亮 */}
      {cell.isToday && (
        <div className="absolute inset-0 rounded-[2px] border-2 border-foreground/60 pointer-events-none" />
      )}
      {/* 0 XP 格子的细边框 */}
      {level === 0 && !cell.isToday && (
        <div className="absolute inset-0 rounded-[2px] border border-border/20 pointer-events-none" />
      )}
      {/* 日期数字（月/周视图） */}
      {showLabel && cell.dayLabel && (
        <span
          className={`relative z-10 pointer-events-none ${
            size >= 30 ? "text-[11px]" : "text-[7px]"
          } font-medium ${
            level >= 3 ? "text-white/90" : "text-foreground/70"
          }`}
        >
          {cell.dayLabel}
        </span>
      )}
    </div>
  );
}

// 图例
function Legend({ cellSize }: { cellSize: number }) {
  const legendSize = Math.max(10, cellSize * 0.8);
  return (
    <div className="flex items-center gap-1 mt-2 justify-end">
      <span className="text-[10px] text-muted-foreground/60 mr-0.5">少</span>
      {[0, 1, 2, 3, 4].map((lv) => (
        <div
          key={lv}
          className="rounded-[2px]"
          style={{ width: legendSize, height: legendSize, backgroundColor: COLORS[lv] }}
        />
      ))}
      <span className="text-[10px] text-muted-foreground/60 ml-0.5">多</span>
    </div>
  );
}

// 工具函数
function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateCN(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
