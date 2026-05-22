"use client";

import { useEffect, useState, useCallback } from "react";
import { useProfile } from "@/context/profile-context";
import { useNav } from "@/context/nav-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionShell, RequireProfile, LoadingState, StatCard } from "@/components/section-shell";
import {
  Database, HardDrive, Container, Globe, Zap, Layers, DollarSign,
  Server, HeartPulse, RefreshCw, Building2, Hash, User, MapPin,
} from "lucide-react";
import { useRegion } from "@/context/region-context";
import { useAccounts } from "@/context/accounts-context";

interface OverviewData {
  s3Buckets: number | null;
  dynamoTables: number | null;
  ecrRepos: number | null;
  cloudFrontDistributions: number | null;
  lambdaFunctions: number | null;
  cfnStacks: number | null;
  monthlyCost: string | null;
  forecastedCost: string | null;
  topServices: { name: string; cost: string }[] | null;
}

interface EcsData {
  services: { service: string; status: string; running: number; desired: number; cluster: string; account: string }[];
}

export function DashboardSection() {
  const { profile } = useProfile();
  const { setSection } = useNav();
  const { region } = useRegion();
  const { accounts } = useAccounts();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [ecs, setEcs] = useState<EcsData>({ services: [] });
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!profile) { setOverview(null); setEcs({ services: [] }); return; }
    setLoading(true);
    const [ov, ec] = await Promise.all([
      fetch(`/api/overview?profile=${profile}&region=${region}`).then((r) => r.json()).catch(() => null),
      fetch(`/api/ecs?profile=${profile}&region=${region}`).then((r) => r.json()).catch(() => ({ services: [] })),
    ]);
    setOverview(ov);
    setEcs(ec);
    setLoading(false);
  }, [profile, region]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const healthy = ecs.services.filter((s) => s.status === "healthy").length;
  const total = ecs.services.length;

  return (
    <SectionShell title="Dashboard" onRefresh={fetchAll} loading={loading}>
      <RequireProfile>
        {loading ? <LoadingState /> : (
          <>
            {/* Account Info */}
            {(() => {
              const acct = accounts.find((a) => a.profile === profile);
              if (!acct) return null;
              return (
                <Card className="mb-6">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Account Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="flex items-start gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div><p className="text-xs text-muted-foreground">Account Name</p><p className="text-sm font-medium">{acct.name}</p></div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div><p className="text-xs text-muted-foreground">Account ID</p><p className="text-sm font-mono font-medium">{acct.id || "—"}</p></div>
                      </div>
                      <div className="flex items-start gap-2">
                        <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div><p className="text-xs text-muted-foreground">Profile</p><p className="text-sm font-mono font-medium">{acct.profile}</p></div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div><p className="text-xs text-muted-foreground">Region</p><p className="text-sm font-mono font-medium">{region}</p></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
            {/* ECS Health */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="ECS Services" value={total} icon={Server} />
              <StatCard label="Healthy" value={`${healthy}/${total}`} icon={HeartPulse} />
              <StatCard label="CF Stacks" value={overview?.cfnStacks ?? "N/A"} icon={Layers} />
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Running Cost</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{overview?.monthlyCost ? `$${overview.monthlyCost}` : "N/A"}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              <Card className="col-span-2 sm:col-span-1">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Expected Month Cost</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{overview?.forecastedCost ? `$${overview.forecastedCost}` : "N/A"}</p>
                </CardContent>
              </Card>
              <div className="col-span-2 sm:col-span-3 flex items-center">
                <Button variant="link" size="sm" className="text-primary" onClick={() => setSection("cost-analysis")}>
                  View Cost Analysis →
                </Button>
              </div>
            </div>

            {/* Resource Counts */}
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-6 mb-3">Resources</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <button onClick={() => setSection("s3")} className="text-left">
                <StatCard label="S3 Buckets" value={overview?.s3Buckets ?? "N/A"} icon={HardDrive} />
              </button>
              <button onClick={() => setSection("dynamodb")} className="text-left">
                <StatCard label="DynamoDB Tables" value={overview?.dynamoTables ?? "N/A"} icon={Database} />
              </button>
              <button onClick={() => setSection("ecs")} className="text-left">
                <StatCard label="ECR Repos" value={overview?.ecrRepos ?? "N/A"} icon={Container} />
              </button>
              <button onClick={() => setSection("cdn")} className="text-left">
                <StatCard label="CloudFront" value={overview?.cloudFrontDistributions ?? "N/A"} icon={Globe} />
              </button>
              <StatCard label="Lambda Functions" value={overview?.lambdaFunctions ?? "N/A"} icon={Zap} />
            </div>

            {/* Cost Breakdown */}
            {overview?.topServices && overview.topServices.length > 0 && (
              <>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-6 mb-3">Top Services by Running Cost</h3>
                <Card>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      {overview.topServices.map((s) => {
                        const pct = overview.monthlyCost ? (parseFloat(s.cost) / parseFloat(overview.monthlyCost) * 100) : 0;
                        return (
                          <div key={s.name} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="truncate mr-4">{s.name}</span>
                              <span className="font-medium">${s.cost}</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Unhealthy Services Alert */}
            {healthy < total && total > 0 && (
              <>
                <h3 className="text-sm font-semibold text-destructive uppercase tracking-wider mt-6 mb-3">Unhealthy Services</h3>
                <Card>
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      {ecs.services.filter((s) => s.status !== "healthy").map((s) => (
                        <div key={s.service} className="flex items-center justify-between p-2 rounded-lg bg-destructive/5">
                          <div>
                            <span className="font-medium text-sm">{s.service}</span>
                            <span className="text-xs text-muted-foreground ml-2">{s.cluster}</span>
                          </div>
                          <Badge variant="destructive">{s.running}/{s.desired} running</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </RequireProfile>
    </SectionShell>
  );
}
