import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  Globe2,
  Inbox,
  Send,
} from "lucide-react";

const dnsRecords = [
  { type: "MX", name: "@", value: "mail.mailkit.local" },
  { type: "TXT", name: "@", value: "v=spf1 include:mailkit.local ~all" },
  { type: "TXT", name: "_dmarc", value: "v=DMARC1; p=quarantine" },
];

const logRows = [
  { event: "Delivered", address: "hello@acme.test", time: "2s" },
  { event: "Inbound", address: "support@acme.test", time: "14s" },
  { event: "Queued", address: "billing@acme.test", time: "now" },
];

export const Hero = () => {
  return (
    <section className="relative overflow-hidden border-b bg-background pt-28 pb-16 md:pt-36 md:pb-24">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:48px_48px] opacity-30" />

      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Private self-hosted alpha
          </div>

          <h1 className="mb-6 text-4xl font-semibold tracking-tight text-foreground md:text-7xl">
            Email sending and inbound mail for your own domains.
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
            Mail Kit is the TypeScript SaaS layer for a self-hosted email
            platform: connect domains, verify DNS, send transactional email,
            receive messages, and inspect every event from one dashboard.
          </p>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/login">
              <Button size="lg" className="h-11 rounded-md px-6 font-semibold">
                Open dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="#features">
              <Button
                size="lg"
                variant="outline"
                className="h-11 rounded-md px-6 font-semibold"
              >
                See platform
              </Button>
            </a>
          </div>
        </div>

        <div className="mx-auto mt-14 grid max-w-6xl gap-4 rounded-lg border bg-card p-3 shadow-sm md:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-md border bg-background">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Send className="h-4 w-4" />
                Send API
              </div>
              <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                202 Accepted
              </span>
            </div>
            <pre className="overflow-x-auto p-4 text-left text-xs leading-6 text-muted-foreground md:text-sm">
              <code>{`POST /emails/send
Authorization: Bearer mk_live_...

{
  "from": "hello@acme.test",
  "to": "customer@example.com",
  "subject": "Welcome to Acme",
  "html": "<p>Your account is ready.</p>"
}`}</code>
            </pre>
          </div>

          <div className="grid gap-4">
            <div className="rounded-md border bg-background p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Globe2 className="h-4 w-4" />
                DNS records
              </div>
              <div className="space-y-2">
                {dnsRecords.map((record) => (
                  <div
                    key={`${record.type}-${record.name}`}
                    className="grid grid-cols-[44px_1fr] gap-3 rounded-md border bg-muted/30 px-3 py-2 text-xs"
                  >
                    <span className="font-semibold">{record.type}</span>
                    <span className="truncate text-muted-foreground">
                      {record.name} {"->"} {record.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border bg-background p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <Inbox className="h-4 w-4" />
                Live message stream
              </div>
              <div className="space-y-2">
                {logRows.map((row) => (
                  <div
                    key={`${row.event}-${row.address}`}
                    className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="font-medium">{row.event}</p>
                      <p className="text-muted-foreground">{row.address}</p>
                    </div>
                    <span className="text-muted-foreground">{row.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Mailpit-ready local SMTP</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Domain and DNS workflow</span>
          </div>
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-emerald-500" />
            <span>API-first sending</span>
          </div>
        </div>
      </div>
    </section>
  );
};
