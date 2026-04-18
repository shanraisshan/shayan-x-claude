"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { adminGetOrder, adminSetOrderStatus } from "@/lib/api";
import { formatMoney, type OrderStatus, type OrderWithItems } from "@/lib/types";
import { useAdminToken } from "@/components/admin/useAdminToken";

const STATUSES: OrderStatus[] = ["pending", "paid", "shipped", "cancelled"];

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const token = useAdminToken();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setOrder(await adminGetOrder(token, id));
  }, [token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onChangeStatus(next: OrderStatus) {
    if (!token || !order) return;
    setSaving(true);
    await adminSetOrderStatus(token, order.id, next);
    setSaving(false);
    await load();
    router.refresh();
  }

  if (!order) return <p className="text-neutral-500">Loading…</p>;

  const address = order.shipping_address as {
    line1?: string;
    line2?: string;
    city?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };

  return (
    <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
      <div>
        <h1 className="text-2xl font-semibold">Order {order.id.slice(0, 8)}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Placed {new Date(order.created_at).toLocaleString()}
        </p>

        <h2 className="mt-6 font-medium">Items</h2>
        <ul className="mt-2 divide-y divide-neutral-200 border-y border-neutral-200">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between py-3 text-sm">
              <span>
                {item.quantity} × {item.product_id}
              </span>
              <span>{formatMoney(item.unit_price_cents * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between text-sm">
          <span>Subtotal</span>
          <span>{formatMoney(order.subtotal_cents)}</span>
        </div>
        <div className="mt-1 flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatMoney(order.total_cents)}</span>
        </div>
      </div>

      <aside className="space-y-6">
        <section className="rounded-lg border border-neutral-200 p-4">
          <h2 className="mb-2 font-medium">Status</h2>
          <p className="mb-3 text-sm text-neutral-600">
            Current: <span className="font-semibold">{order.status}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {STATUSES.filter((s) => s !== order.status).map((s) => (
              <button
                key={s}
                type="button"
                disabled={saving}
                onClick={() => void onChangeStatus(s)}
                className="rounded border border-neutral-300 px-3 py-1 text-sm hover:bg-neutral-100 disabled:opacity-50"
              >
                Mark {s}
              </button>
            ))}
          </div>
        </section>
        <section className="rounded-lg border border-neutral-200 p-4 text-sm">
          <h2 className="mb-2 font-medium">Customer</h2>
          <p>{order.shipping_name}</p>
          <p className="text-neutral-600">{order.email}</p>
          <div className="mt-3 text-neutral-700">
            <p>{address.line1}</p>
            {address.line2 && <p>{address.line2}</p>}
            <p>
              {address.city}
              {address.region ? `, ${address.region}` : ""} {address.postal_code}
            </p>
            <p>{address.country}</p>
          </div>
        </section>
      </aside>
    </div>
  );
}
