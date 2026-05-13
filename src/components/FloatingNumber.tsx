import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface FloatingNumber {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
}

let nextId = 0;

/** 在指定位置触发一个浮动数值 */
export function spawnFloatingNumber(
  x: number,
  y: number,
  text: string,
  color: string
): number {
  const id = ++nextId;
  const event = new CustomEvent("floating-number", {
    detail: { id, x, y, text, color },
  });
  window.dispatchEvent(event);
  return id;
}

export function FloatingNumberContainer() {
  const [numbers, setNumbers] = useState<FloatingNumber[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { id, x, y, text, color } = (e as CustomEvent).detail;
      setNumbers((prev) => [...prev, { id, x, y, text, color }]);

      // 1.5 秒后自动移除
      setTimeout(() => {
        setNumbers((prev) => prev.filter((n) => n.id !== id));
      }, 1500);
    };

    window.addEventListener("floating-number", handler);
    return () => window.removeEventListener("floating-number", handler);
  }, []);

  return (
    <AnimatePresence>
      {numbers.map((n) => (
        <motion.div
          key={n.id}
          initial={{ opacity: 1, y: n.y, x: n.x, scale: 0.6 }}
          animate={{ opacity: 0, y: n.y - 80, scale: 1.2 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="fixed pointer-events-none z-[9999] select-none font-bold text-lg drop-shadow-lg"
          style={{
            left: 0,
            top: 0,
            color: n.color,
            textShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {n.text}
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
