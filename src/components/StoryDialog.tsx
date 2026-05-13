import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

interface StoryEvent {
  id: number;
  chapterKey: string;
  title: string;
  dialogue: string;
  npcName: string;
  reward: string | null;
}

interface StoryDialogProps {
  event: StoryEvent | null;
  onClose: () => void;
}

export function StoryDialog({ event, onClose }: StoryDialogProps) {
  const [displayText, setDisplayText] = useState("");
  const [showFullText, setShowFullText] = useState(false);

  // 打字机效果
  useEffect(() => {
    if (!event) {
      setDisplayText("");
      setShowFullText(false);
      return;
    }

    setDisplayText("");
    setShowFullText(false);

    const lines = event.dialogue.split("\n");
    let currentCharIndex = 0;
    const fullText = lines.join("\n");
    const chars = [...fullText];

    const interval = setInterval(() => {
      currentCharIndex++;
      setDisplayText(chars.slice(0, currentCharIndex).join(""));

      if (currentCharIndex >= chars.length) {
        clearInterval(interval);
        setShowFullText(true);
      }
    }, 40);

    return () => clearInterval(interval);
  }, [event]);

  if (!event) return null;

  let reward: { xp: number; gold: number } | null = null;
  if (event.reward) {
    try {
      reward = JSON.parse(event.reward);
    } catch {
      // ignore
    }
  }

  return (
    <AnimatePresence>
      {event && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => showFullText && onClose()}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
            className="w-full max-w-lg bg-gradient-to-b from-[oklch(0.2_0.03_260)] to-[oklch(0.16_0.03_260)] border-2 border-primary/30 rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 标题栏 */}
            <div className="bg-[oklch(0.22_0.04_260)] border-b border-primary/20 px-5 py-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-primary">{event.title}</span>
            </div>

            {/* NPC 对话框 */}
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                {/* NPC 头像 */}
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-secondary/30 border border-primary/30 flex items-center justify-center text-2xl">
                  🧙
                </div>

                <div className="flex-1 min-h-[80px]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-primary">
                      {event.npcName}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>

                  <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                    {displayText}
                    {!showFullText && (
                      <motion.span
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                        className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-middle"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* 奖励 */}
              {reward && showFullText && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center gap-4 p-3 rounded-lg bg-[oklch(0.18_0.03_260)] border border-border"
                >
                  <span className="text-sm font-bold text-emerald-400">
                    +{reward.xp} XP
                  </span>
                  <span className="text-sm font-bold text-amber-400">
                    +{reward.gold} G
                  </span>
                </motion.div>
              )}
            </div>

            {/* 底部按钮 */}
            {showFullText && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="px-5 pb-5 flex justify-center"
              >
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-primary hover:bg-primary/80 text-primary-foreground rounded-full text-sm font-bold
                             transition-all duration-300 hover:shadow-[0_0_20px_oklch(0.65_0.2_142_/_0.5)]"
                >
                  明白了！
                </button>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
