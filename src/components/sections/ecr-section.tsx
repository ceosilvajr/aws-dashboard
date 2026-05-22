"use client";

import { SectionShell, RequireProfile, LoadingState, useProfileData, StatCard } from "@/components/section-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Container, Search, ShieldCheck } from "lucide-react";
import { useState } from "react";

interface EcrRepo {
  name: string;
  uri: string;
  created: string;
  scanOnPush: boolean;
  tagMutability: string;
  latestTag: string;
  latestPushed: string;
  imageCount: number;
  sizeMB: number;
}

export function EcrSection() {
  const [search, setSearch] = useState("");
  const { data, loading, refresh } = useProfileData<{ repositories: EcrRepo[] }>("/api/ecr", { repositories: [] });

  const filtered = search
    ? data.repositories.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    : data.repositories;

  const totalSize = data.repositories.reduce((sum, r) => sum + r.sizeMB, 0);
  const totalImages = data.repositories.reduce((sum, r) => sum + r.imageCount, 0);

  return (
    <SectionShell title="Elastic Container Registry (ECR)" onRefresh={refresh} loading={loading}>
      <RequireProfile>
        <p className="text-sm text-muted-foreground mb-4">Container image repositories with scan-on-push and immutable tags</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <StatCard label="Repositories" value={data.repositories.length} icon={Container} />
          <StatCard label="Total Images" value={totalImages} icon={Container} />
          <StatCard label="Total Size" value={`${totalSize} MB`} icon={Container} />
          <StatCard label="Scan on Push" value={data.repositories.filter((r) => r.scanOnPush).length} icon={ShieldCheck} />
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Filter repositories…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        {loading ? <LoadingState /> : (
          <Card>
            <CardHeader><CardTitle className="text-base">Repositories</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Repository</TableHead>
                    <TableHead>Latest Tag</TableHead>
                    <TableHead>Last Pushed</TableHead>
                    <TableHead>Images</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Tag Mutability</TableHead>
                    <TableHead>Scan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{r.name}</p>
                          <p className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">{r.uri}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {r.latestTag ? (
                          <Badge variant="outline">{r.latestTag}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">no images</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.latestPushed ? new Date(r.latestPushed).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell>{r.imageCount}</TableCell>
                      <TableCell className="text-xs">{r.sizeMB} MB</TableCell>
                      <TableCell>
                        <Badge variant={r.tagMutability === "IMMUTABLE" ? "default" : "secondary"}>
                          {r.tagMutability}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.scanOnPush ? "default" : "outline"}>
                          {r.scanOnPush ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        {search ? "No repositories match filter" : "No repositories found"}
                      </TableCell>
                    </TableRow>
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
