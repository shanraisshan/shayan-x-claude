export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  image_url: string | null;
  stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductListResponse = {
  items: Product[];
  total: number;
};

export type OrderStatus = "pending" | "paid" | "shipped" | "cancelled";

export type OrderItem = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price_cents: number;
};

export type Order = {
  id: string;
  email: string;
  shipping_name: string;
  shipping_address: Record<string, unknown>;
  subtotal_cents: number;
  total_cents: number;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
};

export type OrderWithItems = Order & { items: OrderItem[] };

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  quantity: number;
  maxStock: number;
};

export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
