import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe2, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { queryKeys } from "@/constants/query-keys";
import { client } from "@/lib/client";
import { useObject } from "@/hooks/use-object";

export const Route = createFileRoute("/_protected/domains")({
  component: DomainsPage,
});

type Domain = {
  id: string;
  name: string;
  status: string;
  verificationStatus: string;
  sendingEnabled: boolean;
  suspendedAt: string | null;
  createdAt: string;
  dnsRecords: Array<{ id: string; type: string; name: string; value: string; purpose: string; status: string }>;
};

function DomainsPage() {
  const queryClient = useQueryClient();
  const { object, setObjectValue } = useObject({ name: "" });
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.mail.domains.all(),
    queryFn: async () => {
      const { data, error } = await client.domains.get();
      if (error) throw new Error("Failed to load domains");
      return data as Domain[];
    },
  });

  const createDomain = useMutation({
    mutationFn: async () => {
      const { error } = await client.domains.post({ name: object.name });
      if (error) throw new Error("Failed to create domain");
    },
    onSuccess: async () => {
      setObjectValue("name", "");
      await queryClient.invalidateQueries({ queryKey: queryKeys.mail.domains.all() });
      toast.success("Domain added");
    },
    onError: (error) => toast.error(error.message),
  });

  const verifyDomain = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.domains({ id }).verify.post();
      if (error) throw new Error("Failed to verify domain");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.mail.domains.all() });
      toast.success("DNS checked");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Domains</h1>
        <p className="text-sm text-muted-foreground">
          Add sender domains and verify MX, SPF, and DMARC records.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add domain</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              createDomain.mutate();
            }}
          >
            <Input
              value={object.name}
              placeholder="example.com"
              onChange={(event) => setObjectValue("name", event.target.value)}
            />
            <Button className="gap-2" disabled={createDomain.isPending || !object.name.trim()}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your domains</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">Loading domains...</div>
          ) : data?.length ? (
            <div className="divide-y">
              {data.map((domain) => (
                <div key={domain.id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <Link to="/domains/$domainId" params={{ domainId: domain.id }} className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Globe2 className="h-4 w-4" />
                      <span className="font-medium">{domain.name}</span>
                      <StatusBadge status={domain.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {domain.sendingEnabled ? "Sending enabled" : "Sending disabled"}
                    </p>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={verifyDomain.isPending}
                    onClick={() => verifyDomain.mutate(domain.id)}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Verify
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">No domains yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === "failed" || status === "suspended" ? "destructive" : "outline"}>
      {status}
    </Badge>
  );
}
