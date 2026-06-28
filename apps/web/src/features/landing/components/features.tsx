import {
  Activity,
  Code2,
  Globe2,
  Inbox,
  KeyRound,
  ServerCog,
  ShieldCheck,
  Webhook,
} from "lucide-react";

const features = [
  {
    title: "Transactional sending",
    description:
      "Expose a clean POST /emails/send workflow that validates API keys, sender domains, and message payloads before SMTP handoff.",
    icon: <Code2 className="h-5 w-5" />,
  },
  {
    title: "SMTP relay layer",
    description:
      "Use Nodemailer locally with Mailpit today, then point the same app layer at your production mail infrastructure later.",
    icon: <ServerCog className="h-5 w-5" />,
  },
  {
    title: "Domain verification",
    description:
      "Guide operators through MX, SPF, DKIM, and DMARC records before production sending is enabled.",
    icon: <Globe2 className="h-5 w-5" />,
  },
  {
    title: "Inbound inbox",
    description:
      "Store received messages and surface them in a dashboard inbox with search, detail views, and reply workflows planned.",
    icon: <Inbox className="h-5 w-5" />,
  },
  {
    title: "Delivery logs",
    description:
      "Track queued, sent, delivered, failed, and inbound events so every message has a readable audit trail.",
    icon: <Activity className="h-5 w-5" />,
  },
  {
    title: "Developer keys",
    description:
      "Give each project scoped API keys for sending and future inbound/webhook operations.",
    icon: <KeyRound className="h-5 w-5" />,
  },
  {
    title: "Webhook events",
    description:
      "Prepare for delivery, bounce, open, click, and inbound notifications through configurable endpoints.",
    icon: <Webhook className="h-5 w-5" />,
  },
  {
    title: "Private by default",
    description:
      "Start with your own domains and infrastructure before accepting public customers or higher-risk traffic.",
    icon: <ShieldCheck className="h-5 w-5" />,
  },
];

export const Features = () => {
  return (
    <section id="features" className="border-b bg-muted/20 py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-semibold tracking-tight md:text-5xl">
            The SaaS layer around real mail infrastructure
          </h2>
          <p className="text-lg leading-8 text-muted-foreground">
            Mail Kit keeps the product experience in TypeScript while Postfix,
            Dovecot, Mailcow, Mailu, or Docker Mailserver handle the hard mail
            transport layer.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border bg-card p-5 transition-colors hover:border-foreground/30"
            >
              <div className="mb-4 flex size-9 items-center justify-center rounded-md border bg-background text-foreground">
                {feature.icon}
              </div>
              <h3 className="mb-2 font-semibold">{feature.title}</h3>
              <p className="text-sm leading-6 text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
