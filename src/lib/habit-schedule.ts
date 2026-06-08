import { getDayOfMonth, getDayOfWeek } from "./date-utils.ts";

export function habitMatchesDate(
  frequency: string | null | undefined,
  dateStr: string,
  frequencyDays?: string | null,
): boolean {
  const freq = frequency || "daily";
  if (freq === "daily") return true;
  if (freq === "weekly") {
    if (frequencyDays) return frequencyDays.split(",").map(Number).includes(getDayOfWeek(dateStr));
    return true;
  }
  if (freq === "monthly") {
    if (frequencyDays) return frequencyDays.split(",").map(Number).includes(getDayOfMonth(dateStr));
    return true;
  }
  return true;
}
