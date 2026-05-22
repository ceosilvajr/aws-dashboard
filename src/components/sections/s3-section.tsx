"use client";

import { useState } from "react";
import { SectionShell, RequireProfile, LoadingState, useProfileData, StatCard } from "@/components/section-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { S3BucketDetail } from "@/components/sections/s3-bucket-detail";
import { HardDrive, Lock, Unlock, Search, AlertTriangle } from "lucide-react";
import type { BucketSummary } from "@/app/api/s3/route";

function SortHead({ col, label, sortKey, sortAsc, onSort }: {
  col: keyof BucketSummary; label: string;
  sortKey: keyof BucketSummary; sortAsc: boolean; onSort: (k: keyof BucketSummary) => void;
}) {
  return (
    <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => onSort(col)}>
      <div className="flex items-center gap-1">
        {label}
        {sortKey === col && <span className="text-xs">{sortAsc ? "↑" : "↓"}</span>}
      </div>
    </TableHead>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "—";
  const k = 1024, units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

function EncryptionBadge({ enc }: { enc: string }) {
  if (enc === "SSE-KMS") return <Badge variant="default" className="text-xs">SSE-KMS</Badge>;
  if (enc === "SSE-S3") return <Badge variant="secondary" className="text-xs">SSE-S3</Badge>;
  return <Badge variant="destructive" className="text-xs">none</Badge>;
}

function PublicBadge({ blocked }: { blocked: boolean | null }) {
  if (blocked === null) return <Badge variant="outline" className="text-xs">?</Badge>;
  if (blocked) return <div className="flex items-center gap-1"><Lock className="h-3 w-3 text-green-500" /><span className="text-xs text-green-600">Private</span></div>;
  return <div className="flex items-center gap-1"><Unlock className="h-3 w-3 text-red-500" /><span className="text-xs text-red-600">Public</span></div>;
}

export function S3Section() {
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<keyof BucketSummary>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const { data, loading, refresh } = useProfileData<{ buckets: BucketSummary[]; fetchedAt: string }>("/api/s3", { buckets: [], fetchedAt: "" });

  if (selectedBucket) {
    return (
      <SectionShell title="S3 Buckets">
        <S3BucketDetail bucket={selectedBucket} onBack={() => setSelectedBucket(null)} />
      </SectionShell>
    );
  }

  const publicCount = data.buckets.filter((b) => b.publicAccessBlocked === false).length;
  const noEncCount = data.buckets.filter((b) => b.encryption === "none").length;

  const filtered = data.buckets
    .filter((b) => b.name.toLowerCase().includes(filter.toLowerCase()) || b.region.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey] ?? "", bv = b[sortKey] ?? "";
      return sortAsc ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });

  function toggleSort(key: keyof BucketSummary) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  }

  return (
    <SectionShell title="S3 Buckets" onRefresh={refresh} loading={loading}>
      <RequireProfile>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <StatCard label="Total Buckets" value={data.buckets.length} icon={HardDrive} />
          <StatCard label="Public Buckets" value={publicCount} icon={Unlock} />
          <StatCard label="Unencrypted" value={noEncCount} icon={AlertTriangle} />
          <StatCard label="Total Size" value={formatBytes(data.buckets.reduce((s, b) => s + b.sizeBytes, 0))} icon={HardDrive} />
        </div>

        {publicCount > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-4 mb-4">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-400">{publicCount} bucket{publicCount > 1 ? "s have" : " has"} public access not fully blocked</p>
              <p className="text-xs text-red-600 dark:text-red-300">Review these buckets to ensure no sensitive data is exposed.</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 mb-4">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Filter by bucket name or region…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {loading ? <LoadingState /> : (
          <Card>
            <CardHeader><CardTitle className="text-base">Buckets ({filtered.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHead col="name" label="Bucket Name" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                    <SortHead col="region" label="Region" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                    <SortHead col="sizeBytes" label="Size" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                    <SortHead col="objectCount" label="Objects" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                    <TableHead>Encryption</TableHead>
                    <TableHead>Public Access</TableHead>
                    <SortHead col="versioningStatus" label="Versioning" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                    <SortHead col="created" label="Created" sortKey={sortKey} sortAsc={sortAsc} onSort={toggleSort} />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((b) => (
                    <TableRow key={b.name} className="cursor-pointer hover:bg-accent" onClick={() => setSelectedBucket(b.name)}>
                      <TableCell className="font-mono text-sm font-medium">{b.name}</TableCell>
                      <TableCell className="text-xs">{b.region}</TableCell>
                      <TableCell className="text-xs">{formatBytes(b.sizeBytes)}</TableCell>
                      <TableCell className="text-xs">{b.objectCount > 0 ? b.objectCount.toLocaleString() : "—"}</TableCell>
                      <TableCell><EncryptionBadge enc={b.encryption} /></TableCell>
                      <TableCell><PublicBadge blocked={b.publicAccessBlocked} /></TableCell>
                      <TableCell>
                        <Badge variant={b.versioningStatus === "Enabled" ? "default" : "outline"} className="text-xs">
                          {b.versioningStatus || "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{b.created ? new Date(b.created).toLocaleDateString() : ""}</TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No buckets found</TableCell></TableRow>
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
