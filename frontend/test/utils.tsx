import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { CartProvider } from "@/components/CartProvider";
import type { ReactElement } from "react";

export function renderWithCart(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
): RenderResult {
  return render(ui, { wrapper: CartProvider, ...options });
}

export * from "@testing-library/react";
