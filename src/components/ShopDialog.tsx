import { useState } from "react";
import { motion } from "framer-motion";
import { Store, Coins } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { SHOP_ORES, type OreConfig } from "../lib/shop-data";
import { buyOre } from "../db/shop";

interface ShopDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  gold: number;
  inventory: Record<string, { quantity: number; equipped: boolean }>;
  onBuy: () => void;
}

export function ShopDialog({ open, onOpenChange, gold, inventory, onBuy }: ShopDialogProps) {
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleBuy = async (ore: OreConfig) => {
    setError("");
    setBuying(ore.oreKey);
    try {
      const result = await buyOre(ore.oreKey);
      if (!result) {
        setError("金币不足或购买失败");
        return;
      }
      onBuy();
      window.dispatchEvent(new Event("inventory-changed"));
    } catch {
      setError("购买失败，请重试");
    } finally {
      setBuying(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setError(""); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-4 h-4" />
            矿石商店
          </DialogTitle>
          <div className="flex items-center gap-1.5 text-sm">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-400 font-semibold">{gold}</span>
            <span className="text-muted-foreground">金币</span>
          </div>
        </DialogHeader>

        {error && (
          <p className="text-xs text-red-400 bg-red-400/5 rounded-md px-3 py-2">{error}</p>
        )}

        <div className="grid grid-cols-2 gap-2">
          {SHOP_ORES.map((ore) => {
            const owned = inventory[ore.oreKey]?.quantity ?? 0;
            const canBuy = gold >= ore.cost;
            const isBuying = buying === ore.oreKey;

            return (
              <motion.div
                key={ore.oreKey}
                whileHover={{ scale: 1.02 }}
                className="bg-card rounded-lg p-3 border border-border flex flex-col items-center gap-2"
              >
                <span className="text-2xl">{ore.oreEmoji}</span>
                <span className="text-sm font-medium">{ore.oreName}</span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Coins className="w-3 h-3 text-amber-400" />
                  <span className="text-amber-400 font-semibold">{ore.cost}</span>
                  G
                </div>
                {owned > 0 && (
                  <span className="text-[10px] text-muted-foreground">拥有: {owned}</span>
                )}
                <button
                  type="button"
                  disabled={!canBuy || !!isBuying}
                  onClick={() => handleBuy(ore)}
                  className={`
                    w-full mt-1 px-3 py-1.5 text-xs rounded-md font-medium transition-colors
                    ${canBuy
                      ? "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30"
                      : "bg-muted text-muted-foreground cursor-not-allowed border border-border"
                    }
                  `}
                >
                  {isBuying ? "购买中..." : canBuy ? "购买" : "金币不足"}
                </button>
              </motion.div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
