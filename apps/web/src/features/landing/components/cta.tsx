import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export const CTA = () => {
  return (
    <section className="py-24">
      <div className="container mx-auto px-4">
        <div className="rounded-lg border bg-primary p-8 text-center text-primary-foreground md:p-14">
          <h2 className="mx-auto mb-5 max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
            Build the email platform around your own domains.
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-base leading-7 text-primary-foreground/75 md:text-lg">
            Start with DNS, API keys, Mailpit-backed sending, and logs. Keep the
            risky mail-server pieces on battle-tested infrastructure.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/login">
              <Button
                size="lg"
                variant="secondary"
                className="h-11 rounded-md px-6 font-semibold"
              >
                Open Mail Kit
              </Button>
            </Link>
            <a href="#features">
              <Button
                size="lg"
                variant="outline"
                className="h-11 rounded-md border-primary-foreground/25 bg-transparent px-6 font-semibold text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                Review platform <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
