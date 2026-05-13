const BEIJING_TIME_ZONE = "Asia/Shanghai";
const DAY_MS = 24 * 60 * 60 * 1000;

export function formatLocalDate(d: Date): string {
  return formatBeijingDate(d);
}

export function formatBeijingDate(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BEIJING_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function getYesterdayLocal(): string {
  return getDaysAgoLocal(1);
}

export function getTodayLocal(): string {
  return formatBeijingDate(new Date());
}

export function getDaysAgoLocal(n: number): string {
  return formatBeijingDate(new Date(Date.now() - n * DAY_MS));
}

export function getDaysFromTodayLocal(n: number): string {
  return formatBeijingDate(new Date(Date.now() + n * DAY_MS));
}

export function getDayOfWeek(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00+08:00`).getUTCDay();
}

export function getDayOfMonth(dateStr: string): number {
  return Number(dateStr.slice(8, 10));
}

export function compareDates(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
