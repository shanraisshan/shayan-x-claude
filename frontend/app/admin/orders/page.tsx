"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminListOrders } from "@/lib/api";
import { formatMoney, type Order, type OrderStatus } from "@/lib/types";
import { useAdminToken } from "@/components/admin/useAdminToken";

const STATUSES: OrderStatus[] = ["pending", "paid", "shipped", "cancelled"];

export default function AdminOrdersPage() {
  const token = useAdminToken();
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "">("");
  const [items, setItems] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const res = await adminListOrders(token, {
      status: statusFilter || undefined,
      limit: 100,
    });
    setItems(res.items);
    setLoading(false);
  }, [token, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "")}
          className="rounded border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <p className="text-neutral-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-neutral-500">No orders.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="py-2">Placed</th>
              <th className="py-2">Email</th>
              <th className="py-2">Name</th>
              <th className="py-2">Total</th>
              <th className="py-2">Status</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id} className="border-b border-neutral-100">
                <td className="py-2 text-neutral-600">{new Date(o.created_at).toLocaleString()}</td>
                <td className="py-2">{o.email}</td>
                <td className="py-2">{o.shipping_name}</td>
                <td className="py-2">{formatMoney(o.total_cents)}</td>
                <td className="py-2">
                  <StatusBadge status={o.status} />
                </td>
                <td className="py-2 text-right">
                  <Link href={`/admin/orders/${o.id}`} className="hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    paid: "bg-blue-100 text-blue-800",
    shipped: "bg-green-100 text-green-800",
    cancelled: "bg-neutral-200 text-neutral-700",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs ${styles[status]}`}>{status}</span>
  );
}
