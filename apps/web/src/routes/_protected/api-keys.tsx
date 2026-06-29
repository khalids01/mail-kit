import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Plus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { queryKeys } from "@/constants/query-keys";
import { useObject } from "@/hooks/use-object";
import { client } from "@/lib/client";

export const Route = createFileRoute("/_protected/api-keys")({
  component: ApiKeysPage,
});

type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

function ApiKeysPage() {
  const queryClient = useQueryClient();
  const { object, setObjectValue } = useObject({ name: "Default" });
  const { object: created, setObjectValue: setCreatedValue } = useObject({ token: "" });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.mail.apiKeys(),
    queryFn: async () => {
      const { data, error } = await client["api-keys"].get();
      if (error) throw new Error("Failed to load API keys");
      return data as ApiKey[];
    },
  });

  const createKey = useMutation({
    mutationFn: async () => {
      const { data, error } = await client["api-keys"].post({ name: object.name });
      if (error) throw new Error("Failed to create API key");
      return data as ApiKey & { token: string };
    },
    onSuccess: async (data) => {
      setCreatedValue("token", data.token);
      await queryClient.invalidateQueries({ queryKey: queryKeys.mail.apiKeys() });
      toast.success("API key created");
    },
  });

  const revokeKey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client["api-keys"]({ id }).revoke.post();
      if (error) throw new Error("Failed to revoke API key");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.mail.apiKeys() });
      toast.success("API key revoked");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">API Keys</h1>
        <p className="text-sm text-muted-foreground">
          Create keys for the Mail Kit send API. Full secrets are shown once.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create API key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              createKey.mutate();
            }}
          >
            <Input value={object.name} onChange={(event) => setObjectValue("name", event.target.value)} />
            <Button className="gap-2" disabled={createKey.isPending || !object.name.trim()}>
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </form>
          {created.token ? (
            <div className="rounded-md border bg-muted/40 p-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">Copy this key now. You will not see it again.</div>
              <div className="flex gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md bg-background px-3 py-2 text-xs">{created.token}</code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => navigator.clipboard.writeText(created.token)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keys</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">Loading keys...</div>
          ) : data?.length ? (
            <div className="divide-y">
              {data.map((key) => (
                <div key={key.id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4" />
                      <span className="font-medium">{key.name}</span>
                      <Badge variant={key.revokedAt ? "destructive" : "outline"}>
                        {key.revokedAt ? "revoked" : "active"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {key.prefix}... · Last used {key.lastUsedAt ? formatDate(key.lastUsedAt) : "never"}
                    </p>
                  </div>
                  {!key.revokedAt ? (
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => revokeKey.mutate(key.id)}>
                      <XCircle className="h-4 w-4" />
                      Revoke
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">No API keys yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
