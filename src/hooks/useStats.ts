import { useState, useCallback, useEffect } from "react";
import { userDB, type User } from "../db/user";
import { seedIfNeeded } from "../db/seed";
import { hashPassword } from "../db/auth";

export type { User };

export function useStats() {
  const [stats, setStats] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      // 首次安装：自动创建用户
      await seedIfNeeded();
      let u = await userDB.get();
      if (!u) {
        await userDB.create("勇者", hashPassword("levelup"));
      }
      await userDB.dailySettle();
      u = await userDB.get();
      setStats(u);
    } catch (e) {
      console.error("useStats:", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(fetch);
  }, [fetch]);

  return { stats, loading, refreshStats: fetch };
}
