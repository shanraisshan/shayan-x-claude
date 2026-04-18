import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shop",
  description: "An example ecommerce app",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
