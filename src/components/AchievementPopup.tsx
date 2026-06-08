import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star } from "lucide-react";
import {
  ACHIEVEMENT_POPUP_EVENT,
  type AchievementPopupDetail,
} from "../lib/achievement-popup";

export function AchievementPopup() {
  const [achievement, setAchievement] = useState<AchievementPopupDetail | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      setAchievement((event as CustomEvent<AchievementPopupDetail>).detail);
      setVisible(true);
    };
    window.addEventListener(ACHIEVEMENT_POPUP_EVENT, handler);
    return () => window.removeEventListener(ACHIEVEMENT_POPUP_EVENT, handler);
  }, []);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleAnimationComplete = () => {
    if (!visible) {
      setAchievement(null);
    }
  };

  return (
    <AnimatePresence onExitComplete={handleAnimationComplete}>
      {visible && achievement && (
        <motion.div
          initial={{ x: 300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 300, opacity: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 18 }}
          className="fixed top-20 right-4 z-[9997] pointer-events-none"
        >
          <div className="bg-gradient-to-r from-[oklch(0.2_0.04_55)] to-[oklch(0.17_0.02_260)] border-2 border-amber-500/50 rounded-xl p-4 shadow-2xl shadow-amber-500/10 min-w-[280px]">
            <div className="flex items-start gap-3">
              <motion.span
                className="text-3xl"
                animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 0.9, 1] }}
                transition={{ duration: 0.6, repeat: 1 }}
              >
                {achievement.icon}
              </motion.span>
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Star className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    成就解锁
                  </span>
                </div>
                <h4 className="text-sm font-bold text-foreground">{achievement.title}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {achievement.description}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
