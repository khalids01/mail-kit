import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { queryKeys } from "@/constants/query-keys";
import { useObject } from "@/hooks/use-object";
import { client } from "@/lib/client";

export const Route = createFileRoute("/_protected/emails")({
  component: EmailsPage,
});

type EmailItem = {
  id: string;
  fromAddress: string;
  toAddress: string;
  subject: string;
  status: "queued" | "sent" | "failed";
  errorMessage: string | null;
  createdAt: string;
  domain?: { name: string } | null;
};

type EmailsResponse = {
  items: EmailItem[];
  page: number;
  pages: number;
};

function EmailsPage() {
  const { object: filters, setObjectValue } = useObject({
    page: 1,
    status: "",
    domainId: "",
    search: "",
  });

  const queryParams = {
    page: filters.page,
    status: filters.status,
    domainId: filters.domainId,
    search: filters.search,
  };

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.mail.emails.list(queryParams),
    queryFn: async () => {
      const { data, error } = await client.emails.get({
        query: {
          page: filters.page,
          status: filters.status || undefined,
          domainId: filters.domainId || undefined,
          search: filters.search || undefined,
        },
      });
      if (error) throw new Error("Failed to load emails");
      return data as EmailsResponse;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Email Logs</h1>
          <p className="text-sm text-muted-foreground">Message history and delivery outcomes.</p>
        </div>
        <Button render={<Link to="/send-test" />}>Send test</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={filters.search}
            placeholder="Search subject or address"
            onChange={(event) => {
              setObjectValue("search", event.target.value);
              setObjectValue("page", 1);
            }}
          />
          <div className="divide-y rounded-md border">
            {isLoading ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">Loading emails...</div>
            ) : data?.items.length ? (
              data.items.map((email) => (
                <Link
                  key={email.id}
                  to="/emails/$emailId"
                  params={{ emailId: email.id }}
                  className="flex flex-col gap-2 px-4 py-3 hover:bg-muted/50 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{email.subject}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {email.fromAddress} {"->"} {email.toAddress}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={email.status === "failed" ? "destructive" : "outline"}>{email.status}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(email.createdAt)}</span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">No email logs yet.</div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={filters.page <= 1} onClick={() => setObjectValue("page", filters.page - 1)}>
              Previous
            </Button>
            <Button variant="outline" disabled={filters.page >= (data?.pages ?? 1)} onClick={() => setObjectValue("page", filters.page + 1)}>
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
