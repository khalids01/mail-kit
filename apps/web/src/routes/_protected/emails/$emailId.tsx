import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { queryKeys } from "@/constants/query-keys";
import { client } from "@/lib/client";

export const Route = createFileRoute("/_protected/emails/$emailId")({
  component: EmailDetailPage,
});

function EmailDetailPage() {
  const { emailId } = Route.useParams();
  const { data: email, isLoading } = useQuery({
    queryKey: queryKeys.mail.emails.detail(emailId),
    queryFn: async () => {
      const { data, error } = await client.emails({ id: emailId }).get();
      if (error) throw new Error("Failed to load email");
      return data as any;
    },
  });

  if (isLoading || !email) {
    return <div className="text-sm text-muted-foreground">Loading email...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{email.subject}</h1>
          <Badge variant={email.status === "failed" ? "destructive" : "outline"}>{email.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {email.fromAddress} {"->"} {email.toAddress}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {email.errorMessage ? <p className="text-sm text-destructive">{email.errorMessage}</p> : null}
          <pre className="max-h-[420px] overflow-auto rounded-md border bg-muted/30 p-4 text-xs">
            {email.html || email.text || "No body stored"}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {email.events.map((event: any) => (
              <div key={event.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">{event.type}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm">{event.message}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
