"use client";

import { useEffect, useState, useCallback } from "react";
import { useProfile } from "@/context/profile-context";
import { useRegion } from "@/context/region-context";
import { SectionShell, RequireProfile, StatCard } from "@/components/section-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Users, Database, ChevronRight } from "lucide-react";
import { CognitoPoolDetail } from "./cognito-pool-detail";

interface UserPoolInfo {
  account: string;
  accountId: string;
  profile: string;
  poolId: string;
  poolName: string;
  estimatedUsers: number;
}

export function CognitoSection() {
  const { profile } = useProfile();
  const { region } = useRegion();
  const [pools, setPools] = useState<UserPoolInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPool, setSelectedPool] = useState<UserPoolInfo | null>(null);

  const fetchPools = useCallback(async () => {
    setLoading(true);
    try {
      const url = profile ? `/api/cognito?profile=${profile}&region=${region}` : `/api/cognito?region=${region}`;
      const data = await fetch(url).then((r) => r.json());
      setPools(data.pools ?? []);
    } catch { setPools([]); }
    setLoading(false);
  }, [profile, region]);

  useEffect(() => { fetchPools(); }, [fetchPools]); // eslint-disable-line react-hooks/set-state-in-effect

  if (selectedPool) {
    return (
      <CognitoPoolDetail
        poolId={selectedPool.poolId}
        poolName={selectedPool.poolName}
        profile={selectedPool.profile}
        onBack={() => setSelectedPool(null)}
      />
    );
  }

  const grouped = pools.reduce<Record<string, UserPoolInfo[]>>((acc, p) => {
    const key = `${p.account} (${p.accountId})`;
    (acc[key] ??= []).push(p);
    return acc;
  }, {});

  const totalEstimated = pools.reduce((a, p) => a + p.estimatedUsers, 0);

  return (
    <SectionShell title="Cognito User Pools" onRefresh={fetchPools} loading={loading}>
      <RequireProfile>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <StatCard label="Accounts" value={Object.keys(grouped).length} icon={Database} />
          <StatCard label="Est. Total Users" value={totalEstimated.toLocaleString()} icon={Users} />
        </div>

        {loading && pools.length === 0 && (
          <Card><CardContent className="py-12 text-center">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Fetching user pools…</p>
          </CardContent></Card>
        )}

        {Object.entries(grouped).map(([label, accountPools]) => (
          <Card key={label} className="mb-4">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{label}</CardTitle>
                <Badge variant="secondary">{accountPools.length} pool{accountPools.length !== 1 ? "s" : ""}</Badge>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pool Name</TableHead>
                    <TableHead>Pool ID</TableHead>
                    <TableHead className="text-right">Est. Users</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountPools.map((pool) => (
                    <TableRow
                      key={pool.poolId}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => setSelectedPool(pool)}
                    >
                      <TableCell className="font-medium">{pool.poolName}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{pool.poolId}</TableCell>
                      <TableCell className="text-right">{pool.estimatedUsers.toLocaleString()}</TableCell>
                      <TableCell className="w-8 px-2">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </RequireProfile>
    </SectionShell>
  );
}
