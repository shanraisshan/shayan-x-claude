"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "./CartProvider";
import type { Product } from "@/lib/types";

export function AddToCartButton({ product }: { product: Product }) {
  const { add } = useCart();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const maxStock = Math.max(0, product.stock);
  const disabled = maxStock === 0;

  return (
    <div className="flex items-center gap-3">
      <input
        type="number"
        min={1}
        max={maxStock || 1}
        value={qty}
        onChange={(e) => setQty(Math.max(1, Math.min(maxStock, Number(e.target.value) || 1)))}
        className="w-20 rounded border border-neutral-300 px-2 py-2"
        disabled={disabled}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          add(product, qty);
          router.push("/cart");
        }}
        className="rounded bg-neutral-900 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-neutral-400"
      >
        {disabled ? "Out of stock" : "Add to cart"}
      </button>
    </div>
  );
}
