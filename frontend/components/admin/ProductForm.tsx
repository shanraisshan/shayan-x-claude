"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  adminCreateProduct,
  adminUpdateProduct,
  adminUploadImage,
} from "@/lib/api";
import type { Product } from "@/lib/types";
import { useAdminToken } from "./useAdminToken";

type Mode = { kind: "create" } | { kind: "edit"; product: Product };

export function ProductForm({ mode }: { mode: Mode }) {
  const token = useAdminToken();
  const router = useRouter();
  const initial = mode.kind === "edit" ? mode.product : undefined;

  const [imageUrl, setImageUrl] = useState<string>(initial?.image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpload(file: File) {
    if (!token) return;
    setUploading(true);
    setError(null);
    try {
      const { url } = await adminUploadImage(token, file);
      setImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload: Partial<Product> = {
      slug: String(fd.get("slug") ?? ""),
      name: String(fd.get("name") ?? ""),
      description: String(fd.get("description") ?? ""),
      price_cents: Math.round(Number(fd.get("price_dollars") ?? 0) * 100),
      currency: String(fd.get("currency") ?? "USD"),
      stock: Number(fd.get("stock") ?? 0),
      is_active: fd.get("is_active") === "on",
      image_url: imageUrl || null,
    };
    try {
      if (mode.kind === "create") {
        await adminCreateProduct(token, payload);
      } else {
        await adminUpdateProduct(token, mode.product.id, payload);
      }
      router.push("/admin/products");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Slug" name="slug" defaultValue={initial?.slug} required />
        <Field label="Name" name="name" defaultValue={initial?.name} required />
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-neutral-700">Description</span>
        <textarea
          name="description"
          rows={4}
          defaultValue={initial?.description}
          className="w-full rounded border border-neutral-300 px-3 py-2"
        />
      </label>
      <div className="grid grid-cols-3 gap-4">
        <Field
          label="Price (USD)"
          name="price_dollars"
          type="number"
          step="0.01"
          defaultValue={initial ? (initial.price_cents / 100).toFixed(2) : "0.00"}
          required
        />
        <Field label="Currency" name="currency" defaultValue={initial?.currency ?? "USD"} />
        <Field
          label="Stock"
          name="stock"
          type="number"
          defaultValue={initial?.stock?.toString() ?? "0"}
          required
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={initial?.is_active ?? true}
          className="h-4 w-4"
        />
        Active (visible on storefront)
      </label>

      <div>
        <span className="mb-1 block text-sm font-medium text-neutral-700">Image</span>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="preview"
            className="mb-2 h-32 w-32 rounded border border-neutral-200 object-cover"
          />
        ) : null}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onUpload(f);
          }}
        />
        {uploading && <p className="mt-1 text-sm text-neutral-500">Uploading…</p>}
      </div>

      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || !token}
          className="rounded bg-neutral-900 px-4 py-2 text-white disabled:bg-neutral-400"
        >
          {submitting ? "Saving…" : mode.kind === "create" ? "Create product" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/products")}
          className="rounded border border-neutral-300 px-4 py-2"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  step,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      <input
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue}
        required={required}
        className="w-full rounded border border-neutral-300 px-3 py-2"
      />
    </label>
  );
}
