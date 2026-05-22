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

interface LambdaFn {
  name: string;
  runtime: string;
  memory: number;
  timeout: number;
  lastModified: string;
  state: string;
}

interface LambdaDetail {
  name: string;
  arn: string;
  runtime: string;
  handler: string;
  role: string;
  codeSize: number;
  description: string;
  lastModified: string;
  state: string;
  stateReason: string;
  lastUpdateStatus: string;
  lastUpdateReason: string;
  memorySize: number;
  timeout: number;
  ephemeralStorage: number;
  reservedConcurrency: number | null;
  vpcId: string;
  subnetIds: string[];
  securityGroupIds: string[];
  envVarCount: number;
  layers: string[];
  architectures: string[];
  eventSources: { source: string; state: string; batchSize: number }[];
}

function DetailView({ name, onBack }: { name: string; onBack: () => void }) {
  const { profile } = useProfile();
  const { region } = useRegion();
  const [detail, setDetail] = useState<LambdaDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    fetch(`/api/lambda/detail?profile=${profile}&name=${encodeURIComponent(name)}&region=${region}`)
      .then((r) => r.json())
      .then((d) => setDetail(d))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [profile, region, name]);

  if (loading) return <LoadingState />;
  if (!detail) return <Card><CardContent className="py-8 text-center text-muted-foreground">Failed to load details</CardContent></Card>;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">{detail.name} <StatusBadge status={detail.state} /></CardTitle>
          {detail.description && <p className="text-sm text-muted-foreground">{detail.description}</p>}
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Health */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Health</h4>
            <dl className="space-y-1 text-sm">
              <Row label="State" value={detail.state} />
              {detail.stateReason && <Row label="State Reason" value={detail.stateReason} />}
              <Row label="Last Update Status" value={detail.lastUpdateStatus || "Successful"} />
              {detail.lastUpdateReason && <Row label="Update Reason" value={detail.lastUpdateReason} />}
              <Row label="Last Modified" value={new Date(detail.lastModified).toLocaleString()} />
            </dl>
          </div>

          {/* Scalability */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Scalability</h4>
            <dl className="space-y-1 text-sm">
              <Row label="Memory" value={`${detail.memorySize} MB`} />
              <Row label="Timeout" value={`${detail.timeout}s`} />
              <Row label="Ephemeral Storage" value={`${detail.ephemeralStorage} MB`} />
              <Row label="Reserved Concurrency" value={detail.reservedConcurrency !== null ? String(detail.reservedConcurrency) : "Unreserved"} />
              <Row label="Architecture" value={detail.architectures.join(", ") || "x86_64"} />
            </dl>
          </div>

          {/* Configuration */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Configuration</h4>
            <dl className="space-y-1 text-sm">
              <Row label="Runtime" value={detail.runtime} />
              <Row label="Handler" value={detail.handler} />
              <Row label="Code Size" value={`${(detail.codeSize / 1024).toFixed(1)} KB`} />
              <Row label="Env Variables" value={String(detail.envVarCount)} />
            </dl>
          </div>

          {/* Networking */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Networking</h4>
            <dl className="space-y-1 text-sm">
              <Row label="VPC" value={detail.vpcId || "None"} />
              {detail.subnetIds.length > 0 && <Row label="Subnets" value={detail.subnetIds.join(", ")} />}
              {detail.securityGroupIds.length > 0 && <Row label="Security Groups" value={detail.securityGroupIds.join(", ")} />}
            </dl>
          </div>
        </CardContent>
      </Card>

      {/* Layers */}
      {detail.layers.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Layers</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {detail.layers.map((l, i) => <li key={i} className="font-mono text-xs truncate">{l}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Event Sources */}
      {detail.eventSources.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Event Sources</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Batch Size</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.eventSources.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs truncate max-w-xs">{e.source}</TableCell>
                    <TableCell><StatusBadge status={e.state} /></TableCell>
                    <TableCell>{e.batchSize}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}

export function LambdaSection() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data, loading, refresh } = useProfileData<{ functions: LambdaFn[] }>("/api/lambda", { functions: [] });

  return (
    <SectionShell title="Lambda Functions" onRefresh={refresh} loading={loading}>
      <RequireProfile>
        {selected ? (
          <DetailView name={selected} onBack={() => setSelected(null)} />
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">{data.functions.length} function(s)</p>
            {loading ? <LoadingState /> : (
              <Card>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Function Name</TableHead>
                        <TableHead>Runtime</TableHead>
                        <TableHead>Memory</TableHead>
                        <TableHead>Timeout</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Last Modified</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.functions.map((fn) => (
                        <TableRow key={fn.name} className="cursor-pointer hover:bg-accent" onClick={() => setSelected(fn.name)}>
                          <TableCell className="font-medium">{fn.name}</TableCell>
                          <TableCell><Badge variant="outline">{fn.runtime}</Badge></TableCell>
                          <TableCell>{fn.memory} MB</TableCell>
                          <TableCell>{fn.timeout}s</TableCell>
                          <TableCell><StatusBadge status={fn.state} /></TableCell>
                          <TableCell className="text-xs">{fn.lastModified ? new Date(fn.lastModified).toLocaleDateString() : ""}</TableCell>
                        </TableRow>
                      ))}
                      {data.functions.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No Lambda functions found</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </RequireProfile>
    </SectionShell>
  );
}
