"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import { checkout } from "@/lib/api";
import { formatMoney } from "@/lib/types";

export default function CheckoutPage() {
  const { lines, subtotalCents, clear } = useCart();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (lines.length === 0) {
    return (
      <p className="text-neutral-500">
        Your cart is empty. Add something first.
      </p>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await checkout({
        email: String(fd.get("email") ?? ""),
        shipping_name: String(fd.get("name") ?? ""),
        shipping_address: {
          line1: String(fd.get("line1") ?? ""),
          line2: String(fd.get("line2") ?? "") || undefined,
          city: String(fd.get("city") ?? ""),
          region: String(fd.get("region") ?? "") || undefined,
          postal_code: String(fd.get("postal_code") ?? ""),
          country: String(fd.get("country") ?? "US"),
        },
        items: lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
      });
      clear();
      router.push(`/thank-you/${res.order_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
      <form onSubmit={onSubmit} className="space-y-4">
        <h1 className="text-2xl font-semibold">Checkout</h1>
        <Field label="Email" name="email" type="email" required />
        <Field label="Full name" name="name" required />
        <Field label="Address line 1" name="line1" required />
        <Field label="Address line 2 (optional)" name="line2" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="City" name="city" required />
          <Field label="Region / State" name="region" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Postal code" name="postal_code" required />
          <Field label="Country" name="country" defaultValue="US" required />
        </div>
        {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-neutral-900 px-5 py-2 text-white disabled:bg-neutral-400"
        >
          {submitting ? "Placing order…" : `Place order (${formatMoney(subtotalCents)})`}
        </button>
        <p className="text-xs text-neutral-500">
          Payments are mocked in this MVP — no card is charged.
        </p>
      </form>
      <aside className="rounded-lg border border-neutral-200 p-4">
        <h2 className="mb-3 font-medium">Order summary</h2>
        <ul className="space-y-2 text-sm">
          {lines.map((l) => (
            <li key={l.productId} className="flex justify-between">
              <span>
                {l.name} × {l.quantity}
              </span>
              <span>{formatMoney(l.priceCents * l.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-neutral-200 pt-3 font-semibold">
          <span>Total</span>
          <span>{formatMoney(subtotalCents)}</span>
        </div>
      </aside>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded border border-neutral-300 px-3 py-2"
      />
    </label>
  );
}
