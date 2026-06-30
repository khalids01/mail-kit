import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { queryKeys } from "@/constants/query-keys";
import { client } from "@/lib/client";
import { StatusBadge } from "../domains";

export const Route = createFileRoute("/_protected/domains/$domainId")({
  component: DomainDetailPage,
});

function DomainDetailPage() {
  const { domainId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: domain, isLoading } = useQuery({
    queryKey: queryKeys.mail.domains.detail(domainId),
    queryFn: async () => {
      const { data, error } = await client.domains({ id: domainId }).get();
      if (error) throw new Error("Failed to load domain");
      return data as any;
    },
  });

  const verify = useMutation({
    mutationFn: async () => {
      const { error } = await client.domains({ id: domainId }).verify.post();
      if (error) throw new Error("Failed to verify domain");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.mail.domains.detail(domainId) });
      toast.success("DNS checked");
    },
  });

  if (isLoading || !domain) {
    return <div className="text-sm text-muted-foreground">Loading domain...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{domain.name}</h1>
            <StatusBadge status={domain.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {domain.sendingEnabled ? "Sending is enabled for this domain." : "Verify DNS records to enable sending."}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={domain.engineStatus === "failed" ? "destructive" : "outline"}>
              Engine: {domain.engineStatus || "manual"}
            </Badge>
            {domain.engineLastSyncAt ? (
              <Badge variant="outline">Engine sync: {formatDate(domain.engineLastSyncAt)}</Badge>
            ) : null}
          </div>
          {domain.engineError ? (
            <p className="mt-2 text-sm text-destructive">{domain.engineError}</p>
          ) : null}
        </div>
        <Button className="gap-2" disabled={verify.isPending} onClick={() => verify.mutate()}>
          <RefreshCw className="h-4 w-4" />
          Verify DNS
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>DNS setup</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Copy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domain.dnsRecords.map((record: any) => (
                <TableRow key={record.id}>
                  <TableCell>{record.type}</TableCell>
                  <TableCell>{record.name}</TableCell>
                  <TableCell className="max-w-[520px] truncate font-mono text-xs">{record.value}</TableCell>
                  <TableCell>
                    <Badge variant={record.status === "failed" ? "destructive" : "outline"}>
                      {record.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(record.value);
                        toast.success("DNS value copied");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
