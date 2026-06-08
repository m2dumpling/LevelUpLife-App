export interface AchievementPopupDetail {
  title: string;
  description: string;
  icon: string;
}

export const ACHIEVEMENT_POPUP_EVENT = "achievement-popup";

export function triggerAchievementPopup(achievement: AchievementPopupDetail): void {
  window.dispatchEvent(new CustomEvent(ACHIEVEMENT_POPUP_EVENT, { detail: achievement }));
}
