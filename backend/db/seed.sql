-- Seed real apparel from DummyJSON. Idempotent: re-running refreshes existing slugs.
-- Regenerate with: uv run python backend/scripts/seed_shirts.py

insert into public.products (slug, name, description, price_cents, currency, image_url, stock, is_active) values
  ('blue-black-check-shirt', 'Blue & Black Check Shirt', 'The Blue & Black Check Shirt is a stylish and comfortable men''s shirt featuring a classic check pattern. Made from high-quality fabric, it''s suitable for both casual and semi-formal occasions.', 2999, 'USD', 'https://cdn.dummyjson.com/product-images/mens-shirts/blue-&-black-check-shirt/thumbnail.webp', 38, true),
  ('gigabyte-aorus-men-tshirt', 'Gigabyte Aorus Men Tshirt', 'The Gigabyte Aorus Men Tshirt is a cool and casual shirt for gaming enthusiasts. With the Aorus logo and sleek design, it''s perfect for expressing your gaming style.', 2499, 'USD', 'https://cdn.dummyjson.com/product-images/mens-shirts/gigabyte-aorus-men-tshirt/thumbnail.webp', 90, true),
  ('man-plaid-shirt', 'Man Plaid Shirt', 'The Man Plaid Shirt is a timeless and versatile men''s shirt with a classic plaid pattern. Its comfortable fit and casual style make it a wardrobe essential for various occasions.', 3499, 'USD', 'https://cdn.dummyjson.com/product-images/mens-shirts/man-plaid-shirt/thumbnail.webp', 82, true),
  ('man-short-sleeve-shirt', 'Man Short Sleeve Shirt', 'The Man Short Sleeve Shirt is a breezy and stylish option for warm days. With a comfortable fit and short sleeves, it''s perfect for a laid-back yet polished look.', 1999, 'USD', 'https://cdn.dummyjson.com/product-images/mens-shirts/man-short-sleeve-shirt/thumbnail.webp', 2, true),
  ('men-check-shirt', 'Men Check Shirt', 'The Men Check Shirt is a classic and versatile shirt featuring a stylish check pattern. Suitable for various occasions, it adds a smart and polished touch to your wardrobe.', 2799, 'USD', 'https://cdn.dummyjson.com/product-images/mens-shirts/men-check-shirt/thumbnail.webp', 95, true),
  ('blue-frock', 'Blue Frock', 'The Blue Frock is a charming and stylish dress for various occasions. With a vibrant blue color and a comfortable design, it adds a touch of elegance to your wardrobe.', 2999, 'USD', 'https://cdn.dummyjson.com/product-images/tops/blue-frock/thumbnail.webp', 52, true),
  ('girl-summer-dress', 'Girl Summer Dress', 'The Girl Summer Dress is a cute and breezy dress designed for warm weather. With playful patterns and lightweight fabric, it''s perfect for keeping cool and stylish during the summer.', 1999, 'USD', 'https://cdn.dummyjson.com/product-images/tops/girl-summer-dress/thumbnail.webp', 43, true),
  ('gray-dress', 'Gray Dress', 'The Gray Dress is a versatile and chic option for various occasions. With a neutral gray color, it can be dressed up or down, making it a wardrobe staple for any fashion-forward individual.', 3499, 'USD', 'https://cdn.dummyjson.com/product-images/tops/gray-dress/thumbnail.webp', 55, true),
  ('short-frock', 'Short Frock', 'The Short Frock is a playful and trendy dress with a shorter length. Ideal for casual outings or special occasions, it combines style and comfort for a fashionable look.', 2499, 'USD', 'https://cdn.dummyjson.com/product-images/tops/short-frock/thumbnail.webp', 22, true),
  ('tartan-dress', 'Tartan Dress', 'The Tartan Dress features a classic tartan pattern, bringing a timeless and sophisticated touch to your wardrobe. Perfect for fall and winter, it adds a hint of traditional charm.', 3999, 'USD', 'https://cdn.dummyjson.com/product-images/tops/tartan-dress/thumbnail.webp', 73, true)
on conflict (slug) do update set
  name        = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  currency    = excluded.currency,
  image_url   = excluded.image_url,
  stock       = excluded.stock,
  is_active   = excluded.is_active,
  updated_at  = now();
