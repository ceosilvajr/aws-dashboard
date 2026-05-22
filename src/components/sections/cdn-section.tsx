"use client";

import { SectionShell, RequireProfile, LoadingState, useProfileData, StatCard } from "@/components/section-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Globe } from "lucide-react";

export function CdnSection() {
  const { data, loading, refresh } = useProfileData<{ distributions: { id: string; domain: string; aliases: string[]; status: string; enabled: boolean; origins: string[] }[] }>(
    "/api/cdn",
    { distributions: [] }
  );

  return (
    <SectionShell title="CDN (CloudFront)" onRefresh={refresh} loading={loading}>
      <RequireProfile>
        <p className="text-sm text-muted-foreground mb-4">CloudFront distributions and origins</p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <StatCard label="Distributions" value={data.distributions.length} icon={Globe} />
          <StatCard label="Enabled" value={data.distributions.filter((d) => d.enabled).length} icon={Globe} />
        </div>

        {loading ? <LoadingState /> : (
          <Card>
            <CardHeader><CardTitle className="text-base">CloudFront Distributions</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Aliases</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Origins</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.distributions.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.id}</TableCell>
                      <TableCell className="font-mono text-xs">{d.domain}</TableCell>
                      <TableCell>{d.aliases.map((a) => <Badge key={a} variant="outline" className="mr-1">{a}</Badge>)}</TableCell>
                      <TableCell><Badge variant={d.enabled ? "default" : "secondary"}>{d.status}</Badge></TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{d.origins.join(", ")}</TableCell>
                    </TableRow>
                  ))}
                  {data.distributions.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No distributions found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </RequireProfile>
    </SectionShell>
  );
}
