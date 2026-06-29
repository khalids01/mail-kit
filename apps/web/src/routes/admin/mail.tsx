import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Globe2, KeyRound, MailCheck, PauseCircle, PlayCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Permissions } from "@rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { queryKeys } from "@/constants/query-keys";
import { useObject } from "@/hooks/use-object";
import { client } from "@/lib/client";
import { useSession } from "@/providers/session-provider";

export const Route = createFileRoute("/admin/mail")({
  component: AdminMailPage,
});

type AdminOverview = {
  totalDomains: number;
  verifiedDomains: number;
  suspendedDomains: number;
  sentEmails: number;
  failedEmails: number;
  apiKeys: number;
};

function AdminMailPage() {
  const { session } = useSession();
  const canManage = Boolean(
    session?.permissions.includes(Permissions.AdminMailManage) ||
      session?.primaryRoleSlug === "platform.owner",
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Mail</h1>
        <p className="text-sm text-muted-foreground">
          Monitor domains, delivery logs, and API key metadata across Mail Kit.
        </p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="domains">Domains</TabsTrigger>
          <TabsTrigger value="emails">Email Logs</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <AdminMailOverview />
        </TabsContent>
        <TabsContent value="domains">
          <AdminDomains canManage={canManage} />
        </TabsContent>
        <TabsContent value="emails">
          <AdminEmails />
        </TabsContent>
        <TabsContent value="api-keys">
          <AdminApiKeys />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AdminMailOverview() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admin.mail.overview(),
    queryFn: async () => {
      const { data, error } = await client.admin.mail.overview.get();
      if (error) throw new Error("Failed to load mail overview");
      return data as AdminOverview;
    },
  });

  const metrics = [
    { label: "Domains", value: data?.totalDomains ?? 0, icon: Globe2 },
    { label: "Verified", value: data?.verifiedDomains ?? 0, icon: MailCheck },
    { label: "Suspended", value: data?.suspendedDomains ?? 0, icon: PauseCircle },
    { label: "Failed", value: data?.failedEmails ?? 0, icon: AlertTriangle },
    { label: "Active Keys", value: data?.apiKeys ?? 0, icon: KeyRound },
  ];

  return (
    <div className="grid gap-4 pt-4 md:grid-cols-5">
      {metrics.map((metric) => (
        <Card key={metric.label}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{metric.label}</CardTitle>
            <metric.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{isLoading ? "..." : metric.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AdminDomains({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const { object: filters, setObjectValue } = useObject({ page: 1, status: "", search: "" });
  const queryParams = { page: filters.page, status: filters.status, search: filters.search };
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admin.mail.domains(queryParams),
    queryFn: async () => {
      const { data, error } = await client.admin.mail.domains.get({
        query: {
          page: filters.page,
          status: filters.status || undefined,
          search: filters.search || undefined,
        },
      });
      if (error) throw new Error("Failed to load domains");
      return data as any;
    },
  });

  const mutateDomain = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "verify" | "suspend" | "unsuspend" }) => {
      const request =
        action === "verify"
          ? client.admin.mail.domains({ id }).verify.post()
          : action === "suspend"
            ? client.admin.mail.domains({ id }).suspend.post()
            : client.admin.mail.domains({ id }).unsuspend.post();
      const { error } = await request;
      if (error) throw new Error("Domain action failed");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-mail-domains"] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.admin.mail.overview() });
      toast.success("Domain updated");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Domains</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          value={filters.search}
          placeholder="Search domain or owner"
          onChange={(event) => {
            setObjectValue("search", event.target.value);
            setObjectValue("page", 1);
          }}
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Domain</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sending</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5}>Loading domains...</TableCell></TableRow>
            ) : data?.items?.length ? (
              data.items.map((domain: any) => (
                <TableRow key={domain.id}>
                  <TableCell className="font-medium">{domain.name}</TableCell>
                  <TableCell>{domain.user.email}</TableCell>
                  <TableCell><StatusBadge status={domain.status} /></TableCell>
                  <TableCell>{domain.sendingEnabled ? "Enabled" : "Disabled"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" disabled={!canManage} onClick={() => mutateDomain.mutate({ id: domain.id, action: "verify" })}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      {domain.suspendedAt ? (
                        <Button variant="outline" size="sm" disabled={!canManage} onClick={() => mutateDomain.mutate({ id: domain.id, action: "unsuspend" })}>
                          <PlayCircle className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" disabled={!canManage} onClick={() => mutateDomain.mutate({ id: domain.id, action: "suspend" })}>
                          <PauseCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={5}>No domains found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AdminEmails() {
  const { object: filters, setObjectValue } = useObject({ page: 1, status: "", search: "" });
  const queryParams = { page: filters.page, status: filters.status, search: filters.search };
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admin.mail.emails(queryParams),
    queryFn: async () => {
      const { data, error } = await client.admin.mail.emails.get({
        query: {
          page: filters.page,
          status: filters.status || undefined,
          search: filters.search || undefined,
        },
      });
      if (error) throw new Error("Failed to load emails");
      return data as any;
    },
  });

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Email Logs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          value={filters.search}
          placeholder="Search subject, owner, or address"
          onChange={(event) => setObjectValue("search", event.target.value)}
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5}>Loading emails...</TableCell></TableRow>
            ) : data?.items?.length ? (
              data.items.map((email: any) => (
                <TableRow key={email.id}>
                  <TableCell className="max-w-[260px] truncate font-medium">{email.subject}</TableCell>
                  <TableCell>{email.user.email}</TableCell>
                  <TableCell className="max-w-[320px] truncate">{email.fromAddress} {"->"} {email.toAddress}</TableCell>
                  <TableCell><StatusBadge status={email.status} /></TableCell>
                  <TableCell>{formatDate(email.createdAt)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={5}>No emails found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AdminApiKeys() {
  const { object: filters, setObjectValue } = useObject({ page: 1, search: "" });
  const queryParams = { page: filters.page, search: filters.search };
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admin.mail.apiKeys(queryParams),
    queryFn: async () => {
      const { data, error } = await client.admin.mail["api-keys"].get({
        query: { page: filters.page, search: filters.search || undefined },
      });
      if (error) throw new Error("Failed to load API keys");
      return data as any;
    },
  });

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>API Key Metadata</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input value={filters.search} placeholder="Search owner, key name, or prefix" onChange={(event) => setObjectValue("search", event.target.value)} />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Prefix</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last used</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5}>Loading keys...</TableCell></TableRow>
            ) : data?.items?.length ? (
              data.items.map((key: any) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell>{key.prefix}...</TableCell>
                  <TableCell>{key.user.email}</TableCell>
                  <TableCell><StatusBadge status={key.revokedAt ? "revoked" : "active"} /></TableCell>
                  <TableCell>{key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow><TableCell colSpan={5}>No API keys found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === "failed" || status === "suspended" || status === "revoked" ? "destructive" : "outline"}>
      {status}
    </Badge>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
