"use client";

import { SectionShell, RequireProfile, LoadingState, useProfileData, StatusBadge } from "@/components/section-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/context/profile-context";
import { useRegion } from "@/context/region-context";
import { RefreshCw, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";

type Subgroup = "WAF" | "ALB" | "VPC" | "Route53";
const SUBGROUPS: Subgroup[] = ["WAF", "ALB", "VPC", "Route53"];

// ─── WAF ────────────────────────────────────────────────────────────────────

interface WafAcl { id: string; name: string; arn: string }
interface WafDetail { name: string; arn: string; capacity: number; defaultAction: string; rules: { name: string; priority: number; action: string; type: string }[]; associatedResources: string[] }

function WafDetailView({ acl, onBack }: { acl: WafAcl; onBack: () => void }) {
  const { profile } = useProfile();
  const { region } = useRegion();
  const [detail, setDetail] = useState<WafDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    fetch(`/api/waf/detail?profile=${profile}&id=${encodeURIComponent(acl.id)}&name=${encodeURIComponent(acl.name)}&region=${region}`)
      .then((r) => r.json()).then(setDetail).catch(() => setDetail(null)).finally(() => setLoading(false));
  }, [profile, region, acl.id, acl.name]);

  if (loading) return <LoadingState />;
  if (!detail) return <Card><CardContent className="py-8 text-center text-muted-foreground">Failed to load details</CardContent></Card>;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
      <Card>
        <CardHeader><CardTitle className="text-lg">{detail.name}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="ARN" value={detail.arn} />
          <Row label="Capacity" value={String(detail.capacity)} />
          <Row label="Default Action" value={detail.defaultAction} />
        </CardContent>
      </Card>
      {detail.associatedResources.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Associated Resources</CardTitle></CardHeader>
          <CardContent><ul className="space-y-1 text-xs font-mono">{detail.associatedResources.map((r, i) => <li key={i} className="truncate">{r}</li>)}</ul></CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle className="text-base">Rules ({detail.rules.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Priority</TableHead><TableHead>Name</TableHead><TableHead>Action</TableHead><TableHead>Type</TableHead></TableRow></TableHeader>
            <TableBody>
              {detail.rules.map((r, i) => (
                <TableRow key={i}><TableCell>{r.priority}</TableCell><TableCell className="font-medium">{r.name}</TableCell><TableCell><Badge variant="outline">{r.action}</Badge></TableCell><TableCell className="text-xs">{r.type}</TableCell></TableRow>
              ))}
              {detail.rules.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No rules</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function WafSubgroup() {
  const [selected, setSelected] = useState<WafAcl | null>(null);
  const { data, loading, refresh } = useProfileData<{ acls: WafAcl[] }>("/api/waf", { acls: [] });

  if (selected) return <WafDetailView acl={selected} onBack={() => setSelected(null)} />;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{data.acls.length} Web ACL(s)</p>
      {loading ? <LoadingState /> : (
        <Card><CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>ID</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.acls.map((acl) => (
                <TableRow key={acl.id} className="cursor-pointer hover:bg-accent" onClick={() => setSelected(acl)}><TableCell className="font-medium">{acl.name}</TableCell><TableCell className="text-xs font-mono">{acl.id}</TableCell></TableRow>
              ))}
              {data.acls.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">No Web ACLs found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}

// ─── ALB ────────────────────────────────────────────────────────────────────

interface AlbRule { priority: string; isDefault: boolean; conditions: { field: string; values: string[]; hostHeader: string[]; pathPattern: string[] }[]; actions: { type: string; targetGroupArn: string; forwardConfig: string[] }[] }
interface AlbListener { port: number; protocol: string; rules: AlbRule[] }
interface AlbData { name: string; dnsName: string; scheme: string; state: string; type: string; listeners: AlbListener[] }

function AlbSubgroup() {
  const { data, loading, refresh } = useProfileData<{ loadBalancers: AlbData[] }>("/api/alb", { loadBalancers: [] });
  return (
    <div className="space-y-4">
      {loading ? <LoadingState /> : data.loadBalancers.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No load balancers found</CardContent></Card>
      ) : data.loadBalancers.map((lb) => (
        <Card key={lb.name}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">{lb.name}<Badge variant="outline">{lb.scheme}</Badge><StatusBadge status={lb.state} /></CardTitle>
            <p className="text-xs text-muted-foreground">{lb.dnsName}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {lb.listeners.map((listener) => (
              <div key={listener.port}>
                <p className="text-sm font-medium mb-2">{listener.protocol}:{listener.port} — {listener.rules.length} rule(s)</p>
                <Table>
                  <TableHeader><TableRow><TableHead className="w-24">Priority</TableHead><TableHead>Conditions</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {listener.rules.map((rule, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-sm">{rule.isDefault ? "default" : rule.priority}</TableCell>
                        <TableCell className="text-xs">{rule.isDefault ? <span className="text-muted-foreground">Default</span> : rule.conditions.map((c, ci) => (<div key={ci}>{c.pathPattern.length > 0 && <span>Path: {c.pathPattern.join(", ")}</span>}{c.hostHeader.length > 0 && <span>Host: {c.hostHeader.join(", ")}</span>}{c.pathPattern.length === 0 && c.hostHeader.length === 0 && c.values.length > 0 && <span>{c.field}: {c.values.join(", ")}</span>}</div>))}</TableCell>
                        <TableCell className="text-xs">{rule.actions.map((a, ai) => (<div key={ai}><Badge variant="secondary" className="text-xs">{a.type}</Badge>{a.targetGroupArn && <span className="ml-1">{a.targetGroupArn.split("/")[1] ?? a.targetGroupArn}</span>}</div>))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── VPC ────────────────────────────────────────────────────────────────────

interface VpcItem { vpcId: string; name: string; cidr: string; state: string; isDefault: boolean; subnetCount: number }
interface VpcDetail { vpcId: string; name: string; cidr: string; state: string; isDefault: boolean; dnsHostnames: boolean; dnsResolution: boolean; subnets: { subnetId: string; cidr: string; az: string; availableIps: number; mapPublicIp: boolean; name: string }[]; routeTables: { id: string; name: string; associations: { subnetId: string }[]; routes: { destination: string; target: string; state: string }[] }[]; securityGroups: { id: string; name: string; description: string; inboundCount: number; outboundCount: number }[]; natGateways: { id: string; state: string; subnetId: string; publicIp: string }[] }

function VpcDetailView({ vpcId, onBack }: { vpcId: string; onBack: () => void }) {
  const { profile } = useProfile();
  const { region } = useRegion();
  const [detail, setDetail] = useState<VpcDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    fetch(`/api/vpc/detail?profile=${profile}&vpcId=${encodeURIComponent(vpcId)}&region=${region}`)
      .then((r) => r.json()).then(setDetail).catch(() => setDetail(null)).finally(() => setLoading(false));
  }, [profile, region, vpcId]);

  if (loading) return <LoadingState />;
  if (!detail) return <Card><CardContent className="py-8 text-center text-muted-foreground">Failed to load details</CardContent></Card>;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
      <Card>
        <CardHeader><CardTitle className="text-lg">{detail.name || detail.vpcId}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <Row label="VPC ID" value={detail.vpcId} />
          <Row label="CIDR" value={detail.cidr} />
          <Row label="State" value={detail.state} />
          <Row label="Default" value={detail.isDefault ? "Yes" : "No"} />
          <Row label="DNS Hostnames" value={detail.dnsHostnames ? "Enabled" : "Disabled"} />
          <Row label="DNS Resolution" value={detail.dnsResolution ? "Enabled" : "Disabled"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Subnets ({detail.subnets.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Subnet ID</TableHead><TableHead>CIDR</TableHead><TableHead>AZ</TableHead><TableHead>Available IPs</TableHead><TableHead>Public</TableHead></TableRow></TableHeader>
            <TableBody>
              {detail.subnets.map((s) => (
                <TableRow key={s.subnetId}><TableCell className="font-medium">{s.name || "—"}</TableCell><TableCell className="text-xs font-mono">{s.subnetId}</TableCell><TableCell>{s.cidr}</TableCell><TableCell>{s.az}</TableCell><TableCell>{s.availableIps}</TableCell><TableCell>{s.mapPublicIp ? "Yes" : "No"}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Route Tables ({detail.routeTables.length})</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {detail.routeTables.map((rt) => (
            <div key={rt.id}>
              <p className="text-sm font-medium mb-1">{rt.name || rt.id} <span className="text-muted-foreground text-xs">({rt.associations.map((a) => a.subnetId).join(", ")})</span></p>
              <Table>
                <TableHeader><TableRow><TableHead>Destination</TableHead><TableHead>Target</TableHead><TableHead>State</TableHead></TableRow></TableHeader>
                <TableBody>{rt.routes.map((r, i) => (<TableRow key={i}><TableCell className="font-mono text-xs">{r.destination}</TableCell><TableCell className="font-mono text-xs">{r.target}</TableCell><TableCell><StatusBadge status={r.state} /></TableCell></TableRow>))}</TableBody>
              </Table>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Security Groups ({detail.securityGroups.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>ID</TableHead><TableHead>Inbound Rules</TableHead><TableHead>Outbound Rules</TableHead></TableRow></TableHeader>
            <TableBody>
              {detail.securityGroups.map((sg) => (
                <TableRow key={sg.id}><TableCell className="font-medium">{sg.name}</TableCell><TableCell className="text-xs font-mono">{sg.id}</TableCell><TableCell>{sg.inboundCount}</TableCell><TableCell>{sg.outboundCount}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {detail.natGateways.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">NAT Gateways ({detail.natGateways.length})</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>State</TableHead><TableHead>Subnet</TableHead><TableHead>Public IP</TableHead></TableRow></TableHeader>
              <TableBody>
                {detail.natGateways.map((n) => (
                  <TableRow key={n.id}><TableCell className="font-mono text-xs">{n.id}</TableCell><TableCell><StatusBadge status={n.state} /></TableCell><TableCell className="font-mono text-xs">{n.subnetId}</TableCell><TableCell>{n.publicIp}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function VpcSubgroup() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data, loading, refresh } = useProfileData<{ vpcs: VpcItem[] }>("/api/vpc", { vpcs: [] });

  if (selected) return <VpcDetailView vpcId={selected} onBack={() => setSelected(null)} />;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{data.vpcs.length} VPC(s)</p>
      {loading ? <LoadingState /> : (
        <Card><CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>VPC ID</TableHead><TableHead>CIDR</TableHead><TableHead>State</TableHead><TableHead>Subnets</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.vpcs.map((v) => (
                <TableRow key={v.vpcId} className="cursor-pointer hover:bg-accent" onClick={() => setSelected(v.vpcId)}>
                  <TableCell className="font-medium">{v.name || (v.isDefault ? "(default)" : "—")}</TableCell><TableCell className="text-xs font-mono">{v.vpcId}</TableCell><TableCell>{v.cidr}</TableCell><TableCell><StatusBadge status={v.state} /></TableCell><TableCell>{v.subnetCount}</TableCell>
                </TableRow>
              ))}
              {data.vpcs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No VPCs found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}

// ─── Route53 ────────────────────────────────────────────────────────────────

interface Zone { id: string; name: string; type: string; recordCount: number }
interface R53Detail { id: string; name: string; type: string; recordCount: number; vpcs: { vpcId: string; region: string }[]; records: { name: string; type: string; ttl: number | null; values: string[] }[] }

function Route53DetailView({ zoneId, onBack }: { zoneId: string; onBack: () => void }) {
  const { profile } = useProfile();
  const { region } = useRegion();
  const [detail, setDetail] = useState<R53Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    fetch(`/api/route53/detail?profile=${profile}&zoneId=${encodeURIComponent(zoneId)}&region=${region}`)
      .then((r) => r.json()).then(setDetail).catch(() => setDetail(null)).finally(() => setLoading(false));
  }, [profile, region, zoneId]);

  if (loading) return <LoadingState />;
  if (!detail) return <Card><CardContent className="py-8 text-center text-muted-foreground">Failed to load details</CardContent></Card>;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
      <Card>
        <CardHeader><CardTitle className="text-lg">{detail.name}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Zone ID" value={detail.id} />
          <Row label="Type" value={detail.type} />
          <Row label="Record Count" value={String(detail.recordCount)} />
        </CardContent>
      </Card>

      {detail.vpcs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Associated VPCs</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>VPC ID</TableHead><TableHead>Region</TableHead></TableRow></TableHeader>
              <TableBody>{detail.vpcs.map((v, i) => (<TableRow key={i}><TableCell className="font-mono text-xs">{v.vpcId}</TableCell><TableCell>{v.region}</TableCell></TableRow>))}</TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Records ({detail.records.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>TTL</TableHead><TableHead>Value</TableHead></TableRow></TableHeader>
            <TableBody>
              {detail.records.map((r, i) => (
                <TableRow key={i}><TableCell className="font-mono text-xs">{r.name}</TableCell><TableCell><Badge variant="outline">{r.type}</Badge></TableCell><TableCell>{r.ttl ?? "—"}</TableCell><TableCell className="text-xs max-w-xs truncate">{r.values.join(", ")}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Route53Subgroup() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data, loading, refresh } = useProfileData<{ zones: Zone[] }>("/api/route53", { zones: [] });

  if (selected) return <Route53DetailView zoneId={selected} onBack={() => setSelected(null)} />;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{data.zones.length} hosted zone(s)</p>
      {loading ? <LoadingState /> : (
        <Card><CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Zone Name</TableHead><TableHead>Type</TableHead><TableHead>Records</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.zones.map((z) => (
                <TableRow key={z.id} className="cursor-pointer hover:bg-accent" onClick={() => setSelected(z.id)}><TableCell className="font-medium">{z.name}</TableCell><TableCell><Badge variant="outline">{z.type}</Badge></TableCell><TableCell>{z.recordCount}</TableCell></TableRow>
              ))}
              {data.zones.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No hosted zones found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium text-right max-w-[60%] truncate">{value}</dd></div>;
}

// ─── Main ───────────────────────────────────────────────────────────────────

export function NetworkingSection() {
  const [active, setActive] = useState<Subgroup>("ALB");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <SectionShell title="Networking" onRefresh={() => setRefreshKey((k) => k + 1)}>
      <RequireProfile>
        <div className="flex gap-1 border-b pb-2 mb-4 overflow-x-auto">
          {SUBGROUPS.map((sg) => (
            <Button key={sg} variant={active === sg ? "default" : "ghost"} size="sm" onClick={() => setActive(sg)}>{sg}</Button>
          ))}
        </div>
        {active === "WAF" && <WafSubgroup key={refreshKey} />}
        {active === "ALB" && <AlbSubgroup key={refreshKey} />}
        {active === "VPC" && <VpcSubgroup key={refreshKey} />}
        {active === "Route53" && <Route53Subgroup key={refreshKey} />}
      </RequireProfile>
    </SectionShell>
  );
}
