import { createFileRoute, useSearch } from "@tanstack/react-router";

import { redirect } from "@tanstack/react-router";
import { getRootSession } from "@/features/user/lib/get-root-session";

export const Route = createFileRoute("/payment/success")({
  beforeLoad: async ({ context }) => {
    const session = context.session ?? (await getRootSession());
    if (!session) {
      throw redirect({
        to: "/login",
      });
    }
  },
  component: SuccessPage,
  validateSearch: (search) => ({
    checkout_id: search.checkout_id as string,
  }),
});

function SuccessPage() {
  const { checkout_id } = useSearch({ from: "/payment/success" });

  return (
    <div className="container mx-auto px-4 py-8">
      <h1>Payment Successful!</h1>
      {checkout_id && <p>Checkout ID: {checkout_id}</p>}
    </div>
  );
}
