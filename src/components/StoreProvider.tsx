"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type BagLine = { variantId: string; quantity: number };

type StoreState = {
  bag: BagLine[];
  bagCount: number;
  addToBag: (variantId: string, quantity: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  removeFromBag: (variantId: string) => void;
  clearBag: () => void;
  wishlist: string[]; // product slugs
  toggleWishlist: (slug: string) => void;
  ready: boolean;
};

const StoreContext = createContext<StoreState | null>(null);
const BAG_KEY = "fr_bag_v1";
const WISH_KEY = "fr_wishlist_v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode) — the bag still works for this page view
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [bag, setBag] = useState<BagLine[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = read<BagLine[]>(BAG_KEY, []);
    setBag(Array.isArray(stored) ? stored.filter((l) => typeof l.variantId === "string" && l.quantity > 0) : []);
    const w = read<string[]>(WISH_KEY, []);
    setWishlist(Array.isArray(w) ? w : []);
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === BAG_KEY) setBag(read(BAG_KEY, []));
      if (e.key === WISH_KEY) setWishlist(read(WISH_KEY, []));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const updateBag = useCallback((fn: (b: BagLine[]) => BagLine[]) => {
    setBag((prev) => {
      const next = fn(prev).filter((l) => l.quantity > 0);
      write(BAG_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo<StoreState>(
    () => ({
      bag,
      bagCount: bag.reduce((s, l) => s + l.quantity, 0),
      addToBag: (variantId, quantity) =>
        updateBag((b) => {
          const existing = b.find((l) => l.variantId === variantId);
          if (existing) return b.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(10, l.quantity + quantity) } : l));
          return [...b, { variantId, quantity: Math.min(10, quantity) }];
        }),
      setQuantity: (variantId, quantity) =>
        updateBag((b) => b.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.max(0, Math.min(10, quantity)) } : l))),
      removeFromBag: (variantId) => updateBag((b) => b.filter((l) => l.variantId !== variantId)),
      clearBag: () => updateBag(() => []),
      wishlist,
      toggleWishlist: (slug) =>
        setWishlist((prev) => {
          const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
          write(WISH_KEY, next);
          return next;
        }),
      ready,
    }),
    [bag, wishlist, ready, updateBag],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
