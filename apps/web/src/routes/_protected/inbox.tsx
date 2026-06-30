import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Mail, MailOpen, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { queryKeys } from "@/constants/query-keys";
import { useObject } from "@/hooks/use-object";
import { client } from "@/lib/client";

export const Route = createFileRoute("/_protected/inbox")({
  component: InboxPage,
});

type InboundEmail = {
  id: string;
  fromAddress: string;
  toAddress: string;
  subject: string;
  status: string;
  receivedAt: string;
  mailbox?: { address: string } | null;
};

function InboxPage() {
  const queryClient = useQueryClient();
  const { object: filters, setObjectValue } = useObject({
    page: 1,
    status: "",
    mailboxId: "",
    search: "",
  });
  const queryParams = {
    page: filters.page,
    status: filters.status,
    mailboxId: filters.mailboxId,
    search: filters.search,
  };

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.mail.inbox.list(queryParams),
    queryFn: async () => {
      const { data, error } = await client.inbox.get({
        query: {
          page: filters.page,
          status: filters.status || undefined,
          mailboxId: filters.mailboxId || undefined,
          search: filters.search || undefined,
        },
      });
      if (error) throw new Error("Failed to load inbox");
      return data as { items: InboundEmail[]; total: number };
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "read" | "archived" | "deleted" }) => {
      const { error } = await client.inbox({ id }).status.post({ status });
      if (error) throw new Error("Failed to update message");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["mail-inbox"] });
      toast.success("Message updated");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Inbox</h1>
        <p className="text-sm text-muted-foreground">
          Inbound mail imported from hidden Mailu mailboxes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={filters.search}
              placeholder="Search sender, recipient, or subject"
              onChange={(event) => {
                setObjectValue("search", event.target.value);
                setObjectValue("page", 1);
              }}
            />
          </div>

          {isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Loading inbox...</div>
          ) : data?.items?.length ? (
            <div className="divide-y rounded-md border">
              {data.items.map((email) => (
                <div key={email.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <Link to="/inbox/$emailId" params={{ emailId: email.id }} className="min-w-0">
                    <div className="flex items-center gap-2">
                      {email.status === "unread" ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
                      <span className={email.status === "unread" ? "truncate font-semibold" : "truncate font-medium"}>
                        {email.subject}
                      </span>
                      <Badge variant={email.status === "deleted" ? "destructive" : "outline"}>
                        {email.status}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {email.fromAddress} {"->"} {email.toAddress} · {formatDate(email.receivedAt)}
                    </p>
                  </Link>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="icon" onClick={() => updateStatus.mutate({ id: email.id, status: "read" })}>
                      <MailOpen className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => updateStatus.mutate({ id: email.id, status: "archived" })}>
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => updateStatus.mutate({ id: email.id, status: "deleted" })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No inbound messages yet. Sync a mailbox after Mailu receives mail.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
