"use client";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { formatMoney } from "@/lib/types";

export default function CartPage() {
  const { lines, subtotalCents, setQuantity, remove } = useCart();

  if (lines.length === 0) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold">Your cart</h1>
        <p className="text-neutral-500">
          Your cart is empty.{" "}
          <Link href="/" className="underline">
            Continue shopping
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Your cart</h1>
      <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
        {lines.map((line) => (
          <li key={line.productId} className="flex items-center gap-4 py-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-neutral-100">
              {line.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={line.imageUrl} alt={line.name} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="flex-1">
              <Link href={`/products/${line.slug}`} className="font-medium hover:underline">
                {line.name}
              </Link>
              <div className="text-sm text-neutral-600">{formatMoney(line.priceCents)}</div>
            </div>
            <input
              type="number"
              min={1}
              max={line.maxStock}
              value={line.quantity}
              onChange={(e) => setQuantity(line.productId, Number(e.target.value) || 1)}
              className="w-20 rounded border border-neutral-300 px-2 py-1"
            />
            <div className="w-24 text-right font-medium">
              {formatMoney(line.priceCents * line.quantity)}
            </div>
            <button
              type="button"
              onClick={() => remove(line.productId)}
              className="text-sm text-neutral-500 hover:text-red-600"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-between">
        <div className="text-lg">
          Subtotal: <span className="font-semibold">{formatMoney(subtotalCents)}</span>
        </div>
        <Link
          href="/checkout"
          className="rounded bg-neutral-900 px-5 py-2 text-white hover:bg-neutral-800"
        >
          Checkout
        </Link>
      </div>
    </div>
  );
}
