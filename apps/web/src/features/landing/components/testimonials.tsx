import { BadgeCheck, LifeBuoy, ReceiptText } from "lucide-react";

const useCases = [
  {
    title: "Product emails",
    description:
      "Send onboarding, login, notification, and billing emails from verified product domains.",
    icon: <ReceiptText className="h-5 w-5" />,
  },
  {
    title: "Support inboxes",
    description:
      "Receive messages for addresses like support@yourdomain.com and manage them from the dashboard.",
    icon: <LifeBuoy className="h-5 w-5" />,
  },
  {
    title: "Domain operations",
    description:
      "Keep DNS, delivery status, inbound mail, API keys, and webhooks visible in one operator console.",
    icon: <BadgeCheck className="h-5 w-5" />,
  },
];

export const Testimonials = () => {
  return (
    <section id="testimonials" className="border-b bg-muted/20 py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-semibold tracking-tight md:text-5xl">
            Start with practical email workflows
          </h2>
          <p className="text-lg leading-8 text-muted-foreground">
            Mail Kit focuses on the workflows a private SaaS operator needs
            before scaling into a public email provider.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {useCases.map((item) => (
            <div key={item.title} className="rounded-lg border bg-card p-6">
              <div className="mb-5 flex size-10 items-center justify-center rounded-md border bg-background">
                {item.icon}
              </div>
              <h3 className="mb-2 text-lg font-semibold">{item.title}</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
