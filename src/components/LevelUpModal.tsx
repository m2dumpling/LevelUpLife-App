import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useConfetti } from "../hooks/useConfetti";

interface LevelUpModalProps {
  open: boolean;
  level: number;
  levelsGained: number;
  onClose: () => void;
  title?: string;
}

export function LevelUpModal({ open, level, levelsGained, onClose, title }: LevelUpModalProps) {
  const { fireConfetti } = useConfetti();
  const hasFired = useRef(false);

  useEffect(() => {
    if (open && !hasFired.current) {
      hasFired.current = true;
      fireConfetti();
    }
    if (!open) {
      hasFired.current = false;
    }
  }, [open, fireConfetti]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.3, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="relative bg-gradient-to-br from-[oklch(0.2_0.05_142)] to-[oklch(0.17_0.03_260)] border-2 border-primary rounded-2xl p-8 text-center max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 背景光晕 */}
            <motion.div
              className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 to-transparent"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />

            <div className="relative z-10 space-y-4">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 0.9, 1] }}
                transition={{ duration: 0.8, repeat: 3 }}
                className="text-6xl"
              >
                ⬆️
              </motion.div>

              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-3xl font-black text-primary"
              >
                {title ?? "升级！"}
              </motion.h2>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="space-y-1"
              >
                <p className="text-lg text-foreground">
                  恭喜你升到了{" "}
                  <span className="text-primary font-black text-2xl">Lv.{level}</span>
                </p>
                {levelsGained > 1 && (
                  <p className="text-sm text-amber-400 flex items-center justify-center gap-1">
                    <Sparkles className="w-4 h-4" />
                    连升 {levelsGained} 级！
                    <Sparkles className="w-4 h-4" />
                  </p>
                )}
              </motion.div>

              <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                onClick={onClose}
                className="px-8 py-2.5 bg-primary text-primary-foreground rounded-full font-bold
                           hover:shadow-[0_0_30px_oklch(0.65_0.2_142_/_0.5)]
                           transition-shadow duration-300"
              >
                继续冒险！
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
