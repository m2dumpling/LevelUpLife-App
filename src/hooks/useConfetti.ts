import { useCallback } from "react";
import confetti from "canvas-confetti";

/** 全屏撒花特效 hook */
export function useConfetti() {
  const fireConfetti = useCallback(() => {
    // 左侧撒花
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.1, y: 0.6 },
      colors: ["#4ade80", "#a78bfa", "#fbbf24", "#f472b6", "#60a5fa"],
    });

    // 右侧撒花
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { x: 0.9, y: 0.6 },
        colors: ["#4ade80", "#a78bfa", "#fbbf24", "#f472b6", "#60a5fa"],
      });
    }, 200);

    // 中间爆炸
    setTimeout(() => {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { x: 0.5, y: 0.4 },
        colors: ["#fbbf24", "#4ade80", "#a78bfa"],
      });
    }, 400);
  }, []);

  return { fireConfetti };
}
