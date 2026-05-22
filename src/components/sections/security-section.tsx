"use client";

import { SectionShell, RequireProfile, LoadingState, useProfileData, StatusBadge } from "@/components/section-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function SecuritySection() {
  const { data, loading, refresh } = useProfileData<{ stacks: { name: string; status: string; created: string; description: string }[] }>(
    "/api/security?filter=iam|waf|cognito|security|authorizer",
    { stacks: [] }
  );

  return (
    <SectionShell title="Security" onRefresh={refresh} loading={loading}>
      <RequireProfile>
        <p className="text-sm text-muted-foreground mb-4">IAM Roles, WAF, Cognito, Lambda Authorizer</p>
        {loading ? <LoadingState /> : (
          <Card>
            <CardHeader><CardTitle className="text-base">Security Stacks</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stack Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.stacks.map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {s.name.includes("iam") ? "IAM" : s.name.includes("waf") ? "WAF" : s.name.includes("cognito") ? "Cognito" : s.name.includes("authorizer") ? "Authorizer" : "Security"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{s.created ? new Date(s.created).toLocaleDateString() : ""}</TableCell>
                    </TableRow>
                  ))}
                  {data.stacks.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No security stacks found</TableCell></TableRow>
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
