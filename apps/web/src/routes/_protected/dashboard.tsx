import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Globe2, Inbox, KeyRound, MailCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { queryKeys } from "@/constants/query-keys";
import { client } from "@/lib/client";

export const Route = createFileRoute("/_protected/dashboard")({
  component: RouteComponent,
});

type Overview = {
  domains: number;
  verifiedDomains: number;
  apiKeys: number;
  sentEmails: number;
  failedEmails: number;
  unreadInbound: number;
  recentEmails: Array<{
    id: string;
    fromAddress: string;
    toAddress: string;
    subject: string;
    status: "queued" | "sent" | "failed";
    createdAt: string;
    domain?: { name: string } | null;
  }>;
  recentInboundEmails: Array<{
    id: string;
    fromAddress: string;
    toAddress: string;
    subject: string;
    status: "unread" | "read" | "archived" | "deleted";
    receivedAt: string;
    mailbox?: { address: string } | null;
  }>;
};

function RouteComponent() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.mail.overview(),
    queryFn: async () => {
      const { data, error } = await client.mail.overview.get();
      if (error) throw new Error("Failed to load overview");
      return data as Overview;
    },
  });

  const metrics = [
    { title: "Domains", value: data?.domains ?? 0, icon: Globe2 },
    { title: "Verified", value: data?.verifiedDomains ?? 0, icon: MailCheck },
    { title: "API Keys", value: data?.apiKeys ?? 0, icon: KeyRound },
    { title: "Unread", value: data?.unreadInbound ?? 0, icon: Inbox },
    { title: "Failed", value: data?.failedEmails ?? 0, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Email Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Domains, API keys, and delivery logs for your Mail Kit account.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link to="/domains" />}>
            Add domain
          </Button>
          <Button render={<Link to="/send-test" />}>Send test</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{metric.title}</CardTitle>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {isLoading ? "..." : metric.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent email activity</CardTitle>
          <Button variant="outline" size="sm" render={<Link to="/emails" />}>
            View all
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {data?.recentEmails?.length ? (
            <div className="divide-y">
              {data.recentEmails.map((email) => (
                <Link
                  key={email.id}
                  to="/emails/$emailId"
                  params={{ emailId: email.id }}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{email.subject}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {email.fromAddress} {"->"} {email.toAddress}
                    </div>
                  </div>
                  <Badge variant={email.status === "failed" ? "destructive" : "outline"}>
                    {email.status}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
              <Activity className="h-5 w-5" />
              No email activity yet.
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent inbound mail</CardTitle>
          <Button variant="outline" size="sm" render={<Link to="/inbox" />}>
            Open inbox
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {data?.recentInboundEmails?.length ? (
            <div className="divide-y">
              {data.recentInboundEmails.map((email) => (
                <Link
                  key={email.id}
                  to="/inbox/$emailId"
                  params={{ emailId: email.id }}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{email.subject}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {email.fromAddress} {"->"} {email.toAddress}
                    </div>
                  </div>
                  <Badge variant={email.status === "unread" ? "default" : "outline"}>
                    {email.status}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
              <Inbox className="h-5 w-5" />
              No inbound mail yet.
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
