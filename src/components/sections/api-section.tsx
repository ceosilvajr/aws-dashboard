"use client";

import { SectionShell, RequireProfile, LoadingState, useProfileData, StatusBadge } from "@/components/section-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function ApiSection() {
  const { data, loading, refresh } = useProfileData<{ stacks: { name: string; status: string; created: string; description: string }[] }>(
    "/api/security?filter=api-gateway|rest-api|lambda-authorizer",
    { stacks: [] }
  );

  return (
    <SectionShell title="API Gateway" onRefresh={refresh} loading={loading}>
      <RequireProfile>
        <p className="text-sm text-muted-foreground mb-4">REST APIs, Lambda Authorizers, Custom Domains</p>
        {loading ? <LoadingState /> : (
          <Card>
            <CardHeader><CardTitle className="text-base">API Stacks</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stack Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.stacks.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                      <TableCell className="text-xs max-w-[300px] truncate">{s.description}</TableCell>
                      <TableCell className="text-xs">{s.created ? new Date(s.created).toLocaleDateString() : ""}</TableCell>
                    </TableRow>
                  ))}
                  {data.stacks.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No API stacks found</TableCell></TableRow>
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
