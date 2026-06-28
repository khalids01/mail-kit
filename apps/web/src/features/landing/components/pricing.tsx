import { Button } from "@/components/ui/button";
import { Check, Server } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

const privateAlphaItems = [
  "Self-host on your own VPS",
  "Use Mailpit for local delivery testing",
  "Connect your own domains first",
  "Keep public signup and billing decisions for later",
];

export const Pricing = () => {
  const handleCheckout = async () => {
    try {
      const result = await authClient.checkout({
        slug: "pro_monthly",
      });

      if (result.error) {
        toast.error(result.error.message || "Something went wrong");
        return;
      }

      if (result.data?.url) {
        window.location.href = result.data.url;
      }
    } catch {
      toast.error("Failed to initiate checkout");
    }
  };

  return (
    <section id="pricing" className="border-b py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-semibold tracking-tight md:text-5xl">
            Built for private alpha first
          </h2>
          <p className="text-lg leading-8 text-muted-foreground">
            The first version is for operating your own email domains. Billing
            can stay behind the existing billing integration until the product
            is ready for public customers.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-xl rounded-lg border bg-card p-6 shadow-sm">
          <div className="mb-6 flex items-start gap-4">
            <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Self-hosted operator</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Start with your own VPS, DNS, and domains.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {privateAlphaItems.map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm">
                <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <Check className="h-3.5 w-3.5" />
                </span>
                {item}
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="lg"
            className="mt-8 h-11 w-full rounded-md font-semibold"
            onClick={handleCheckout}
          >
            Keep billing integration ready
          </Button>
        </div>
      </div>
    </section>
  );
};
