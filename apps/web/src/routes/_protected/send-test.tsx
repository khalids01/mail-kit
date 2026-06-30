import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { queryKeys } from "@/constants/query-keys";
import { useObject } from "@/hooks/use-object";
import { client } from "@/lib/client";
import { env } from "@env/client";

export const Route = createFileRoute("/_protected/send-test")({
  component: SendTestPage,
});

function SendTestPage() {
  const { object, setObjectValue } = useObject({
    apiKey: "",
    domainId: "",
    from: "",
    to: "",
    subject: "Hello from Mail Kit",
    html: "<p>Hello world</p>",
  });
  const { data: domains } = useQuery({
    queryKey: queryKeys.mail.domains.all(),
    queryFn: async () => {
      const { data, error } = await client.domains.get();
      if (error) throw new Error("Failed to load domains");
      return data as Array<{ id: string; name: string; status: string; sendingEnabled: boolean }>;
    },
  });
  const verifiedDomains = domains?.filter((domain) => domain.status === "verified" && domain.sendingEnabled) ?? [];

  async function sendTest() {
    const response = await fetch(`${env.VITE_SERVER_URL}/emails/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${object.apiKey}`,
      },
      credentials: "include",
      body: JSON.stringify({
        from: object.from,
        to: object.to,
        subject: object.subject,
        html: object.html,
      }),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(result?.message || "Failed to send email");
    }
    return result;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Send Test</h1>
        <p className="text-sm text-muted-foreground">
          Send through the real API-key endpoint. Local mail appears in Mailpit.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test message</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await sendTest();
                toast.success("Email accepted");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Send failed");
              }
            }}
          >
            <Input placeholder="mk_live_..." value={object.apiKey} onChange={(event) => setObjectValue("apiKey", event.target.value)} />
            <Select
              value={object.domainId}
              onValueChange={(value) => {
                setObjectValue("domainId", value);
                const domain = verifiedDomains.find((item) => item.id === value);
                if (domain && !object.from) {
                  setObjectValue("from", `hello@${domain.name}`);
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Verified sender domain" />
              </SelectTrigger>
              <SelectContent>
                {verifiedDomains.map((domain) => (
                  <SelectItem key={domain.id} value={domain.id}>
                    {domain.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="hello@example.com" value={object.from} onChange={(event) => setObjectValue("from", event.target.value)} />
            <Input placeholder="recipient@example.com" value={object.to} onChange={(event) => setObjectValue("to", event.target.value)} />
            <Input value={object.subject} onChange={(event) => setObjectValue("subject", event.target.value)} />
            <Textarea value={object.html} onChange={(event) => setObjectValue("html", event.target.value)} />
            <Button>Send email</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
