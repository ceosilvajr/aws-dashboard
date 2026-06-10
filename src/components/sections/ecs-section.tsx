"use client";

import { useEffect, useState, useCallback } from "react";
import { useProfile } from "@/context/profile-context";
import { useRegion } from "@/context/region-context";
import { SectionShell, RequireProfile, StatCard } from "@/components/section-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Server, Activity, HeartPulse, Search, ArrowLeft } from "lucide-react";

interface EcsDetail {
  service: string;
  cluster: string;
  cpu: string;
  memory: string;
  desiredCount: number;
  runningCount: number;
  envVars: { name: string; value: string }[];
}

interface RuleInfo { priority: string; conditions: string; action: string }
interface ListenerInfo { protocol: string; port: number; rules: RuleInfo[] }
interface TargetGroupInfo {
  name: string; arn: string; protocol: string; port: number;
  healthCheckPath: string; albName: string; listeners: ListenerInfo[];
}
interface ServiceInfo {
  account: string; accountId: string; cluster: string; service: string;
  container: string; image: string; tag: string; cpu: string; memory: string;
  port: number; desired: number; running: number; minCapacity: number; maxCapacity: number; status: string;
  targetGroups?: TargetGroupInfo[];
}

export function EcsSection() {
  const { profile } = useProfile();
  const { region } = useRegion();
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ServiceInfo | null>(null);

  const fetchEcs = useCallback(async () => {
    setLoading(true);
    try {
      const url = profile ? `/api/ecs?profile=${profile}&region=${region}` : `/api/ecs?region=${region}`;
      const data = await fetch(url).then((r) => r.json());
      setServices(data.services ?? []);
    } catch { setServices([]); }
    setLoading(false);
  }, [profile, region]);

  useEffect(() => { fetchEcs(); }, [fetchEcs]); // eslint-disable-line react-hooks/set-state-in-effect

  const filtered = search ? services.filter((s) => s.service.toLowerCase().includes(search.toLowerCase())) : services;
  const grouped = filtered.reduce<Record<string, ServiceInfo[]>>((acc, svc) => {
    const key = `${svc.account} (${svc.accountId})`;
    (acc[key] ??= []).push(svc);
    return acc;
  }, {});
  const healthy = services.filter((s) => s.status === "healthy").length;

  return (
    <SectionShell title="Elastic Container Service (ECS)" onRefresh={fetchEcs} loading={loading}>
      <RequireProfile>
        {selected ? (
          <EcsDetailView svc={selected} onBack={() => setSelected(null)} />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <StatCard label="Accounts" value={Object.keys(grouped).length} icon={Server} />
              <StatCard label="Services" value={services.length} icon={Activity} />
              <StatCard label="Healthy" value={`${healthy}/${services.length}`} icon={HeartPulse} />
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Filter by service name…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>

            {loading && services.length === 0 && (
              <Card><CardContent className="py-12 text-center"><RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground">Fetching ECS data…</p></CardContent></Card>
            )}

            {Object.entries(grouped).map(([label, svcs]) => (
              <Card key={label} className="mb-4">
                <CardHeader>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-base">{label}</CardTitle>
                    <Badge variant="outline">Cluster: {svcs[0].cluster}</Badge>
                    <Badge variant="secondary">{svcs.length} services</Badge>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead>Tag</TableHead>
                        <TableHead>CPU</TableHead>
                        <TableHead>Memory</TableHead>
                        <TableHead>Port</TableHead>
                        <TableHead>Scaling (Des/Min/Max)</TableHead>
                        <TableHead>Running</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {svcs.sort((a, b) => a.service.localeCompare(b.service)).map((svc) => (
                        <TableRow key={svc.service} className="cursor-pointer hover:bg-accent" onClick={() => setSelected(svc)}>
                          <TableCell className="font-medium text-primary">{svc.service}</TableCell>
                          <TableCell><Badge variant="outline">{svc.tag}</Badge></TableCell>
                          <TableCell>{svc.cpu}</TableCell>
                          <TableCell>{svc.memory} MB</TableCell>
                          <TableCell>{svc.port}</TableCell>
                          <TableCell>{svc.desired} / {svc.minCapacity} / {svc.maxCapacity}</TableCell>
                          <TableCell>{svc.running}/{svc.desired}</TableCell>
                          <TableCell><Badge variant={svc.status === "healthy" ? "default" : "destructive"}>{svc.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </RequireProfile>
    </SectionShell>
  );
}

interface ScalingPolicy {
  name: string; type: string; metric: string; targetValue: number | null;
  scaleInCooldown: number | null; scaleOutCooldown: number | null;
  stepAdjustments: { lower: number | null; upper: number | null; adjustment: number }[];
}
interface ScalingConfig {
  minCapacity: number | null; maxCapacity: number | null;
  suspendedState: { DynamicScalingInSuspended?: boolean; DynamicScalingOutSuspended?: boolean; ScheduledScalingSuspended?: boolean } | null;
  policies: ScalingPolicy[];
}

function EcsDetailView({ svc, onBack }: { svc: ServiceInfo; onBack: () => void }) {
  const { profile } = useProfile();
  const { region } = useRegion();
  const [detail, setDetail] = useState<EcsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [scaling, setScaling] = useState<ScalingConfig | null>(null);

  useEffect(() => {
    if (!profile) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/ecs/detail?profile=${profile}&cluster=${encodeURIComponent(svc.cluster)}&service=${encodeURIComponent(svc.service)}&region=${region}`)
      .then((r) => r.json()).then(setDetail).catch(() => setDetail(null)).finally(() => setLoading(false));
    fetch(`/api/ecs/scaling?profile=${profile}&cluster=${encodeURIComponent(svc.cluster)}&service=${encodeURIComponent(svc.service)}&region=${region}`)
      .then((r) => r.json()).then((d) => { if (!d.error) setScaling(d); }).catch(() => {});
  }, [profile, region, svc.cluster, svc.service]);

  if (loading) return <Card><CardContent className="py-12 text-center"><RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></CardContent></Card>;
  if (!detail) return <Card><CardContent className="py-8 text-center text-muted-foreground">Failed to load details</CardContent></Card>;

  const tgs = svc.targetGroups ?? [];

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2">{detail.service} <Badge variant={svc.status === "healthy" ? "default" : "destructive"}>{svc.status}</Badge></CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><p className="text-muted-foreground">Cluster</p><p className="font-medium">{detail.cluster}</p></div>
          <div><p className="text-muted-foreground">CPU</p><p className="font-medium">{detail.cpu} units</p></div>
          <div><p className="text-muted-foreground">Memory</p><p className="font-medium">{detail.memory} MB</p></div>
          <div><p className="text-muted-foreground">Running Tasks</p><p className="font-medium">{detail.runningCount} / {detail.desiredCount}</p></div>
        </CardContent>
      </Card>

      {/* Target Groups / ALB Info */}
      {tgs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Load Balancing</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {tgs.map((tg) => (
              <div key={tg.arn} className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">ALB: {tg.albName}</Badge>
                  <Badge variant="secondary">TG: {tg.name}</Badge>
                  <Badge variant="secondary">{tg.protocol}:{tg.port}</Badge>
                  {tg.healthCheckPath && <Badge variant="outline">Health: {tg.healthCheckPath}</Badge>}
                </div>
                {tg.listeners.map((l) => (
                  <div key={`${l.protocol}-${l.port}`} className="ml-4">
                    <p className="text-sm font-medium mb-1">Listener <Badge variant="outline" className="ml-1">{l.protocol}:{l.port}</Badge></p>
                    <Table>
                      <TableHeader><TableRow><TableHead className="h-8 text-xs">Priority</TableHead><TableHead className="h-8 text-xs">Conditions</TableHead><TableHead className="h-8 text-xs">Action</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {l.rules.map((r) => (
                          <TableRow key={r.priority}><TableCell className="py-1 text-xs">{r.priority}</TableCell><TableCell className="py-1 text-xs font-mono">{r.conditions}</TableCell><TableCell className="py-1 text-xs">{r.action}</TableCell></TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Scaling Configuration */}
      {scaling && (
        <Card>
          <CardHeader><CardTitle className="text-base">Scaling Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div><p className="text-muted-foreground">Min Capacity</p><p className="font-medium">{scaling.minCapacity ?? "N/A"}</p></div>
              <div><p className="text-muted-foreground">Max Capacity</p><p className="font-medium">{scaling.maxCapacity ?? "N/A"}</p></div>
              {scaling.suspendedState && (
                <>
                  <div><p className="text-muted-foreground">Scale In</p><p className="font-medium">{scaling.suspendedState.DynamicScalingInSuspended ? "Suspended" : "Active"}</p></div>
                  <div><p className="text-muted-foreground">Scale Out</p><p className="font-medium">{scaling.suspendedState.DynamicScalingOutSuspended ? "Suspended" : "Active"}</p></div>
                </>
              )}
            </div>
            {scaling.policies.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Policy</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Metric</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Cooldown (In/Out)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scaling.policies.map((p) => (
                    <TableRow key={p.name}>
                      <TableCell className="font-mono text-xs">{p.name}</TableCell>
                      <TableCell>{p.type}</TableCell>
                      <TableCell>{p.metric}</TableCell>
                      <TableCell>{p.targetValue ?? "—"}</TableCell>
                      <TableCell>{p.scaleInCooldown ?? "—"}s / {p.scaleOutCooldown ?? "—"}s</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {scaling.policies.length === 0 && <p className="text-muted-foreground">No scaling policies configured</p>}
          </CardContent>
        </Card>
      )}

      {/* Environment Variables */}
      <Card>
        <CardHeader><CardTitle className="text-base">Environment Variables ({detail.envVars.length})</CardTitle></CardHeader>
        <CardContent>
          {detail.envVars.length === 0 ? (
            <p className="text-sm text-muted-foreground">No environment variables</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Value</TableHead></TableRow></TableHeader>
              <TableBody>
                {detail.envVars.map((ev) => (
                  <TableRow key={ev.name}><TableCell className="font-mono text-xs">{ev.name}</TableCell><TableCell className="font-mono text-xs max-w-xs truncate">{ev.value}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
