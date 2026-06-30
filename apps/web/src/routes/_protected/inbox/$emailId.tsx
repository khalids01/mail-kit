import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Reply } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { queryKeys } from "@/constants/query-keys";
import { useObject } from "@/hooks/use-object";
import { client } from "@/lib/client";

export const Route = createFileRoute("/_protected/inbox/$emailId")({
  component: InboundEmailDetailPage,
});

function InboundEmailDetailPage() {
  const { emailId } = Route.useParams();
  const { object, setObjectValue } = useObject({ from: "", text: "" });

  const { data: email, isLoading } = useQuery({
    queryKey: queryKeys.mail.inbox.detail(emailId),
    queryFn: async () => {
      const { data, error } = await client.inbox({ id: emailId }).get();
      if (error) throw new Error("Failed to load inbound email");
      return data as any;
    },
  });

  const reply = useMutation({
    mutationFn: async () => {
      const { error } = await client.inbox({ id: emailId }).reply.post({
        from: object.from,
        text: object.text,
      });
      if (error) throw new Error("Failed to send reply");
    },
    onSuccess: () => toast.success("Reply sent"),
    onError: (error) => toast.error(error.message),
  });

  if (isLoading || !email) {
    return <div className="text-sm text-muted-foreground">Loading inbound email...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight md:text-3xl">{email.subject}</h1>
          <Badge variant={email.status === "deleted" ? "destructive" : "outline"}>{email.status}</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {email.fromAddress} {"->"} {email.toAddress} · {formatDate(email.receivedAt)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Message</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-[520px] overflow-auto rounded-md border bg-muted/20 p-4">
            {email.html ? (
              <iframe
                title="Inbound email body"
                className="h-[420px] w-full rounded-md bg-background"
                sandbox=""
                srcDoc={email.html}
              />
            ) : (
              <pre className="whitespace-pre-wrap text-sm">{email.text || "No body stored"}</pre>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reply</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              reply.mutate();
            }}
          >
            <Input
              value={object.from}
              placeholder={email.mailbox?.address || "hello@example.com"}
              onChange={(event) => setObjectValue("from", event.target.value)}
            />
            <Textarea
              value={object.text}
              rows={8}
              placeholder="Write a reply"
              onChange={(event) => setObjectValue("text", event.target.value)}
            />
            <Button className="gap-2" disabled={reply.isPending || !object.from || !object.text}>
              <Reply className="h-4 w-4" />
              Send reply
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
