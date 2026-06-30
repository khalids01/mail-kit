import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mailbox, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { queryKeys } from "@/constants/query-keys";
import { useObject } from "@/hooks/use-object";
import { client } from "@/lib/client";

export const Route = createFileRoute("/_protected/mailboxes")({
  component: MailboxesPage,
});

type Domain = {
  id: string;
  name: string;
  status: string;
};

type MailboxAddress = {
  id: string;
  address: string;
  displayName: string | null;
  status: string;
  engineStatus: string;
  engineLastSyncAt: string | null;
  engineError: string | null;
  imapUsername: string | null;
  imapCredentials: "configured" | "missing";
  lastSyncAt: string | null;
  syncError: string | null;
  domain: { name: string; status: string };
};

function MailboxesPage() {
  const queryClient = useQueryClient();
  const { object, setObjectValue } = useObject({
    domainId: "",
    localPart: "hello",
    displayName: "",
    imapUsername: "",
    imapPassword: "",
  });

  const { data: domains } = useQuery({
    queryKey: queryKeys.mail.domains.all(),
    queryFn: async () => {
      const { data, error } = await client.domains.get();
      if (error) throw new Error("Failed to load domains");
      return data as Domain[];
    },
  });

  const { data: mailboxes, isLoading } = useQuery({
    queryKey: queryKeys.mail.mailboxes(),
    queryFn: async () => {
      const { data, error } = await client.mailboxes.get();
      if (error) throw new Error("Failed to load mailboxes");
      return data as MailboxAddress[];
    },
  });

  const createMailbox = useMutation({
    mutationFn: async () => {
      const { error } = await client.mailboxes.post({
        domainId: object.domainId,
        localPart: object.localPart,
        displayName: object.displayName || undefined,
        imapUsername: object.imapUsername || undefined,
        imapPassword: object.imapPassword || undefined,
      });
      if (error) throw new Error("Failed to create mailbox");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.mail.mailboxes() });
      toast.success("Mailbox added");
    },
    onError: (error) => toast.error(error.message),
  });

  const syncMailbox = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await client.mailboxes({ id }).sync.post();
      if (error) throw new Error("Failed to sync mailbox");
      return data as { imported: number };
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.mail.mailboxes() });
      await queryClient.invalidateQueries({ queryKey: ["mail-inbox"] });
      toast.success(`Imported ${data.imported} message${data.imported === 1 ? "" : "s"}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const selectedDomain = domains?.find((domain) => domain.id === object.domainId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Mailboxes</h1>
        <p className="text-sm text-muted-foreground">
          Map Mail Kit addresses to hidden Mailu IMAP mailboxes for inbound sync.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add mailbox mapping</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 lg:grid-cols-[160px_1fr_1fr_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              createMailbox.mutate();
            }}
          >
            <Input
              value={object.localPart}
              placeholder="hello"
              onChange={(event) => setObjectValue("localPart", event.target.value)}
            />
            <Select value={object.domainId} onValueChange={(value) => setObjectValue("domainId", value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Domain" />
              </SelectTrigger>
              <SelectContent>
                {domains?.map((domain) => (
                  <SelectItem key={domain.id} value={domain.id}>
                    {domain.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={object.imapUsername}
              placeholder={selectedDomain ? `${object.localPart}@${selectedDomain.name}` : "IMAP username"}
              onChange={(event) => setObjectValue("imapUsername", event.target.value)}
            />
            <Input
              value={object.imapPassword}
              type="password"
              placeholder="IMAP password"
              onChange={(event) => setObjectValue("imapPassword", event.target.value)}
            />
            <Button className="gap-2" disabled={createMailbox.isPending || !object.domainId || !object.localPart}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Addresses</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">Loading mailboxes...</div>
          ) : mailboxes?.length ? (
            <div className="divide-y">
              {mailboxes.map((mailbox) => (
                <div key={mailbox.id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Mailbox className="h-4 w-4" />
                      <span className="font-medium">{mailbox.address}</span>
                      <Badge variant={mailbox.status === "sync_failed" || mailbox.status === "disabled" ? "destructive" : "outline"}>
                        {mailbox.status}
                      </Badge>
                      <Badge variant={mailbox.engineStatus === "failed" ? "destructive" : "outline"}>
                        {mailbox.engineStatus}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {mailbox.imapUsername || "No IMAP username"} · IMAP {mailbox.imapCredentials} · Last sync {mailbox.lastSyncAt ? formatDate(mailbox.lastSyncAt) : "never"}
                    </p>
                    {mailbox.engineError ? (
                      <p className="mt-1 text-xs text-destructive">{mailbox.engineError}</p>
                    ) : null}
                    {mailbox.syncError ? (
                      <p className="mt-1 text-xs text-destructive">{mailbox.syncError}</p>
                    ) : null}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={syncMailbox.isPending || mailbox.status === "disabled"}
                    onClick={() => syncMailbox.mutate(mailbox.id)}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Sync
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">No mailbox mappings yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
