"use client";

import { SectionShell, RequireProfile, LoadingState, useProfileData, StatCard } from "@/components/section-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HardDrive, Database } from "lucide-react";
import { useState } from "react";

export function StorageSection() {
  const [tab, setTab] = useState<"s3" | "dynamodb">("s3");
  const { data: s3Data, loading: s3Loading, refresh: s3Refresh } = useProfileData<{ buckets: { name: string; created: string }[] }>("/api/storage?type=s3", { buckets: [] });
  const { data: ddbData, loading: ddbLoading, refresh: ddbRefresh } = useProfileData<{ tables: { name: string; status: string; itemCount: number; sizeBytes: number; billingMode: string; created: string }[] }>("/api/storage?type=dynamodb", { tables: [] });

  const loading = tab === "s3" ? s3Loading : ddbLoading;
  const refresh = tab === "s3" ? s3Refresh : ddbRefresh;

  return (
    <SectionShell title="Storage" onRefresh={refresh} loading={loading}>
      <RequireProfile>
        <div className="flex items-center mb-4">
          <div className="flex gap-1">
            <Button variant={tab === "s3" ? "default" : "outline"} size="sm" onClick={() => setTab("s3")}>
              <HardDrive className="h-4 w-4 mr-2" /> S3 Buckets
            </Button>
            <Button variant={tab === "dynamodb" ? "default" : "outline"} size="sm" onClick={() => setTab("dynamodb")}>
              <Database className="h-4 w-4 mr-2" /> DynamoDB Tables
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <StatCard label="S3 Buckets" value={s3Data.buckets.length} icon={HardDrive} />
          <StatCard label="DynamoDB Tables" value={ddbData.tables.length} icon={Database} />
        </div>

        {loading ? <LoadingState /> : tab === "s3" ? (
          <Card>
            <CardHeader><CardTitle className="text-base">S3 Buckets</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bucket Name</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s3Data.buckets.map((b) => (
                    <TableRow key={b.name}>
                      <TableCell className="font-medium font-mono text-sm">{b.name}</TableCell>
                      <TableCell className="text-xs">{b.created ? new Date(b.created).toLocaleDateString() : ""}</TableCell>
                    </TableRow>
                  ))}
                  {s3Data.buckets.length === 0 && (
                    <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">No buckets found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle className="text-base">DynamoDB Tables</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Table Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Billing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ddbData.tables.map((t) => (
                    <TableRow key={t.name}>
                      <TableCell className="font-medium font-mono text-sm">{t.name}</TableCell>
                      <TableCell><Badge variant={t.status === "ACTIVE" ? "default" : "secondary"}>{t.status}</Badge></TableCell>
                      <TableCell>{t.itemCount.toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{(t.sizeBytes / 1024).toFixed(1)} KB</TableCell>
                      <TableCell><Badge variant="outline">{t.billingMode}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {ddbData.tables.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No tables found</TableCell></TableRow>
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
