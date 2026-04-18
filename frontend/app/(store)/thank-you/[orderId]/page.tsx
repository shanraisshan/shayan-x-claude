import Link from "next/link";

export default async function ThankYouPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return (
    <div className="mx-auto max-w-md text-center">
      <h1 className="text-2xl font-semibold">Thanks for your order!</h1>
      <p className="mt-2 text-neutral-600">
        Your order <span className="font-mono">{orderId}</span> has been placed.
      </p>
      <p className="mt-1 text-sm text-neutral-500">
        You&apos;ll get a confirmation email shortly.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded bg-neutral-900 px-5 py-2 text-white hover:bg-neutral-800"
      >
        Continue shopping
      </Link>
    </div>
  );
}
