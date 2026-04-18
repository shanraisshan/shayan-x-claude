"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { adminListProducts } from "@/lib/api";
import { formatMoney, type Product } from "@/lib/types";
import { useAdminToken } from "@/components/admin/useAdminToken";

export default function AdminProductsPage() {
  const token = useAdminToken();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await adminListProducts(token, { limit: 100 });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Link
          href="/admin/products/new"
          className="rounded bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-800"
        >
          New product
        </Link>
      </div>
      {loading ? (
        <p className="text-neutral-500">Loading…</p>
      ) : error ? (
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-neutral-500">No products yet.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="py-2">Name</th>
              <th className="py-2">Slug</th>
              <th className="py-2">Price</th>
              <th className="py-2">Stock</th>
              <th className="py-2">Active</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b border-neutral-100">
                <td className="py-2 font-medium">{p.name}</td>
                <td className="py-2 text-neutral-600">{p.slug}</td>
                <td className="py-2">{formatMoney(p.price_cents, p.currency)}</td>
                <td className="py-2">{p.stock}</td>
                <td className="py-2">{p.is_active ? "Yes" : "No"}</td>
                <td className="py-2 text-right">
                  <Link href={`/admin/products/${p.id}/edit`} className="hover:underline">
                    Edit
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
