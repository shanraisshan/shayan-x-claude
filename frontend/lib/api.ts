import type { Order, OrderWithItems, Product, ProductListResponse } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type FetchOpts = RequestInit & { token?: string };

async function api<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { token, headers, ...rest } = opts;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (!res.ok) {
    let detail: unknown;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export class ApiError extends Error {
  constructor(public status: number, public detail: unknown) {
    super(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
}

// ---------- public ----------
export function listProducts(params?: { q?: string; limit?: number; offset?: number }) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api<ProductListResponse>(`/api/products${suffix}`, { cache: "no-store" });
}

export function getProduct(slug: string) {
  return api<Product>(`/api/products/${encodeURIComponent(slug)}`, { cache: "no-store" });
}

export type CheckoutPayload = {
  email: string;
  shipping_name: string;
  shipping_address: {
    line1: string;
    line2?: string;
    city: string;
    region?: string;
    postal_code: string;
    country: string;
  };
  items: { product_id: string; quantity: number }[];
};

export function checkout(payload: CheckoutPayload) {
  return api<{ order_id: string; total_cents: number; status: "paid" }>(`/api/orders`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---------- admin ----------
export function adminListProducts(token: string, params?: { limit?: number; offset?: number }) {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api<ProductListResponse>(`/api/admin/products${suffix}`, { token, cache: "no-store" });
}

export function adminCreateProduct(token: string, data: Partial<Product>) {
  return api<Product>(`/api/admin/products`, {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}

export function adminUpdateProduct(token: string, id: string, data: Partial<Product>) {
  return api<Product>(`/api/admin/products/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(data),
  });
}

export function adminDeleteProduct(token: string, id: string) {
  return api<void>(`/api/admin/products/${id}`, { method: "DELETE", token });
}

export async function adminUploadImage(token: string, file: File): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_URL}/api/admin/products/upload-image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json();
}

export function adminListOrders(
  token: string,
  params?: { status?: string; limit?: number; offset?: number },
) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api<{ items: Order[]; total: number }>(`/api/admin/orders${suffix}`, {
    token,
    cache: "no-store",
  });
}

export function adminGetOrder(token: string, id: string) {
  return api<OrderWithItems>(`/api/admin/orders/${id}`, { token, cache: "no-store" });
}

export function adminSetOrderStatus(token: string, id: string, status: string) {
  return api<Order>(`/api/admin/orders/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ status }),
  });
}
