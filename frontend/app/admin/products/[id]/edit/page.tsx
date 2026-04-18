"use client";

import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { adminListProducts } from "@/lib/api";
import type { Product } from "@/lib/types";
import { ProductForm } from "@/components/admin/ProductForm";
import { useAdminToken } from "@/components/admin/useAdminToken";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const token = useAdminToken();
  const [product, setProduct] = useState<Product | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      // Simple approach: list up to 200 and find. An /admin/products/{id} endpoint could replace this.
      const res = await adminListProducts(token, { limit: 200 });
      const found = res.items.find((p) => p.id === id);
      if (!found) setMissing(true);
      else setProduct(found);
    })();
  }, [token, id]);

  if (missing) notFound();
  if (!product) return <p className="text-neutral-500">Loading…</p>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Edit product</h1>
      <ProductForm mode={{ kind: "edit", product }} />
    </div>
  );
}
