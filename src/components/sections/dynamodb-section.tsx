"use client";

import { useEffect, useState, useCallback } from "react";
import { useProfile } from "@/context/profile-context";
import { useRegion } from "@/context/region-context";
import { SectionShell, RequireProfile, StatCard } from "@/components/section-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Table2, Database, ChevronDown, ChevronRight, ShieldCheck, ShieldOff } from "lucide-react";

interface TableInfo {
  account: string;
  accountId: string;
  profile: string;
  tableName: string;
  status: string;
  deletionProtection: boolean;
  sizeBytes: number;
  itemCount: number;
}

interface IndexInfo {
  name: string;
  type: "GSI" | "LSI";
  keys: string;
  projection: string;
  status?: string;
}

interface TableDetail {
  pk: string;
  sk: string | null;
  indexes: IndexInfo[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  CREATING: "secondary",
  UPDATING: "secondary",
  DELETING: "destructive",
  INACCESSIBLE_ENCRYPTION_CREDENTIALS: "destructive",
};

export function DynamoDbSection() {
  const { profile } = useProfile();
  const { region } = useRegion();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, TableDetail | "loading">>({});

  const fetchTables = useCallback(async () => {
    setLoading(true);
    setExpanded({});
    try {
      const url = profile ? `/api/dynamodb?profile=${profile}&region=${region}` : `/api/dynamodb?region=${region}`;
      const data = await fetch(url).then((r) => r.json());
      setTables(data.tables ?? []);
    } catch { setTables([]); }
    setLoading(false);
  }, [profile, region]);

  useEffect(() => { fetchTables(); }, [fetchTables]); // eslint-disable-line react-hooks/set-state-in-effect

  const toggleTable = async (table: TableInfo) => {
    const key = `${table.profile}::${table.tableName}`;
    if (expanded[key]) {
      setExpanded((prev) => { const n = { ...prev }; delete n[key]; return n; });
      return;
    }
    setExpanded((prev) => ({ ...prev, [key]: "loading" }));
    try {
      const data: TableDetail = await fetch(
        `/api/dynamodb/detail?tableName=${encodeURIComponent(table.tableName)}&profile=${encodeURIComponent(table.profile)}&region=${region}`
      ).then((r) => r.json());
      setExpanded((prev) => ({ ...prev, [key]: data }));
    } catch {
      setExpanded((prev) => { const n = { ...prev }; delete n[key]; return n; });
    }
  };

  const grouped = tables.reduce<Record<string, TableInfo[]>>((acc, t) => {
    const key = `${t.account} (${t.accountId})`;
    (acc[key] ??= []).push(t);
    return acc;
  }, {});

  return (
    <SectionShell title="DynamoDB Tables" onRefresh={fetchTables} loading={loading}>
      <RequireProfile>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <StatCard label="Accounts" value={Object.keys(grouped).length} icon={Database} />
          <StatCard label="Total Tables" value={tables.length} icon={Table2} />
        </div>

        {loading && tables.length === 0 && (
          <Card><CardContent className="py-12 text-center">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Fetching tables…</p>
          </CardContent></Card>
        )}

        {Object.entries(grouped).map(([label, accountTables]) => (
          <Card key={label} className="mb-4">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{label}</CardTitle>
                <Badge variant="secondary">{accountTables.length} table{accountTables.length !== 1 ? "s" : ""}</Badge>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Table Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Deletion Protection</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountTables.map((table) => {
                    const key = `${table.profile}::${table.tableName}`;
                    const detail = expanded[key];
                    const isOpen = !!detail;
                    const isLoading = detail === "loading";
                    return (
                      <>
                        <TableRow
                          key={key}
                          className="cursor-pointer hover:bg-accent/50"
                          onClick={() => toggleTable(table)}
                        >
                          <TableCell className="w-8 px-2">
                            {isLoading
                              ? <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                              : isOpen
                                ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell className="font-medium">{table.tableName}</TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[table.status] ?? "secondary"}>
                              {table.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {table.deletionProtection
                              ? <span className="flex items-center gap-1 text-green-600 text-sm"><ShieldCheck className="h-4 w-4" /> Enabled</span>
                              : <span className="flex items-center gap-1 text-muted-foreground text-sm"><ShieldOff className="h-4 w-4" /> Disabled</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">{formatBytes(table.sizeBytes)}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{table.itemCount.toLocaleString()}</TableCell>
                        </TableRow>

                        {isOpen && !isLoading && typeof detail === "object" && (
                          <TableRow key={`${key}-detail`} className="bg-muted/30 hover:bg-muted/30">
                            <TableCell />
                            <TableCell colSpan={5} className="py-3">
                              <div className="space-y-3">
                                <div className="flex flex-wrap gap-4 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Partition Key: </span>
                                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{detail.pk}</code>
                                  </div>
                                  {detail.sk && (
                                    <div>
                                      <span className="text-muted-foreground">Sort Key: </span>
                                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{detail.sk}</code>
                                    </div>
                                  )}
                                </div>

                                {detail.indexes.length > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Indexes</p>
                                    <div className="space-y-1">
                                      {detail.indexes.map((idx) => (
                                        <div key={idx.name} className="flex flex-wrap items-center gap-2 text-sm">
                                          <Badge variant={idx.type === "GSI" ? "default" : "outline"} className="text-xs">{idx.type}</Badge>
                                          <span className="font-medium">{idx.name}</span>
                                          <span className="text-muted-foreground text-xs">{idx.keys}</span>
                                          <Badge variant="secondary" className="text-xs">{idx.projection}</Badge>
                                          {idx.status && idx.status !== "ACTIVE" && (
                                            <Badge variant="secondary" className="text-xs">{idx.status}</Badge>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {detail.indexes.length === 0 && (
                                  <p className="text-xs text-muted-foreground">No secondary indexes</p>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </RequireProfile>
    </SectionShell>
  );
}
