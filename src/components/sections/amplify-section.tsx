"use client";

import { SectionShell, RequireProfile, LoadingState, useProfileData, StatusBadge } from "@/components/section-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/context/profile-context";
import { useRegion } from "@/context/region-context";
import { RefreshCw, ArrowLeft, ExternalLink } from "lucide-react";
import { useState, useEffect } from "react";

interface AmplifyApp {
  appId: string;
  name: string;
  platform: string;
  repository: string;
  defaultDomain: string;
  updateTime: string;
}

interface SubDomain {
  prefix: string;
  branchName: string;
  verified: boolean;
  dnsRecord: string;
}

interface Domain {
  domainName: string;
  status: string;
  subDomains: SubDomain[];
}

interface Branch {
  branchName: string;
  stage: string;
  status: string;
  lastDeployTime: string;
  displayName: string;
}

interface AmplifyDetail {
  appId: string;
  name: string;
  platform: string;
  repository: string;
  defaultDomain: string;
  createTime: string;
  updateTime: string;
  domains: Domain[];
  branches: Branch[];
  envVars: { key: string; value: string }[];
}

function DetailView({ appId, onBack }: { appId: string; onBack: () => void }) {
  const { profile } = useProfile();
  const { region } = useRegion();
  const [detail, setDetail] = useState<AmplifyDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    fetch(`/api/amplify/detail?profile=${profile}&appId=${encodeURIComponent(appId)}&region=${region}`)
      .then((r) => r.json())
      .then((d) => setDetail(d))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [profile, region, appId]);

  if (loading) return <LoadingState />;
  if (!detail) return <Card><CardContent className="py-8 text-center text-muted-foreground">Failed to load details</CardContent></Card>;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{detail.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{detail.platform} • {detail.repository || "No repository"}</p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Default Domain</span><a href={`https://${detail.defaultDomain}`} target="_blank" className="font-medium flex items-center gap-1">{detail.defaultDomain}<ExternalLink className="h-3 w-3" /></a></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="font-medium">{new Date(detail.createTime).toLocaleDateString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Last Updated</span><span className="font-medium">{new Date(detail.updateTime).toLocaleDateString()}</span></div>
        </CardContent>
      </Card>

      {/* Domains */}
      <Card>
        <CardHeader><CardTitle className="text-base">Domains</CardTitle></CardHeader>
        <CardContent>
          {detail.domains.length === 0 ? (
            <p className="text-sm text-muted-foreground">No custom domains configured</p>
          ) : (
            <div className="space-y-4">
              {detail.domains.map((d) => (
                <div key={d.domainName} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{d.domainName}</span>
                    <StatusBadge status={d.status} />
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>URL</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Verified</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.subDomains.map((s, i) => {
                        const url = s.prefix ? `${s.prefix}.${d.domainName}` : d.domainName;
                        return (
                          <TableRow key={i}>
                            <TableCell><a href={`https://${url}`} target="_blank" className="flex items-center gap-1 text-primary hover:underline">{url}<ExternalLink className="h-3 w-3" /></a></TableCell>
                            <TableCell><Badge variant="outline">{s.branchName}</Badge></TableCell>
                            <TableCell>{s.verified ? "✓" : "✗"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Branches */}
      <Card>
        <CardHeader><CardTitle className="text-base">Branches</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Deploy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.branches.map((b) => (
                <TableRow key={b.branchName}>
                  <TableCell className="font-medium">{b.displayName}</TableCell>
                  <TableCell><Badge variant="outline">{b.stage}</Badge></TableCell>
                  <TableCell><StatusBadge status={b.status} /></TableCell>
                  <TableCell className="text-xs">{b.lastDeployTime ? new Date(b.lastDeployTime).toLocaleDateString() : ""}</TableCell>
                </TableRow>
              ))}
              {detail.branches.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No branches</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Environment Variables */}
      <Card>
        <CardHeader><CardTitle className="text-base">Environment Variables</CardTitle></CardHeader>
        <CardContent>
          {detail.envVars.length === 0 ? (
            <p className="text-sm text-muted-foreground">No environment variables</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.envVars.map((ev) => (
                  <TableRow key={ev.key}>
                    <TableCell className="font-mono text-xs">{ev.key}</TableCell>
                    <TableCell className="font-mono text-xs truncate max-w-xs">{ev.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function AmplifySection() {
  const [selected, setSelected] = useState<string | null>(null);
  const { data, loading, refresh } = useProfileData<{ apps: AmplifyApp[] }>("/api/amplify", { apps: [] });

  return (
    <SectionShell title="Amplify Hosting" onRefresh={refresh} loading={loading}>
      <RequireProfile>
        {selected ? (
          <DetailView appId={selected} onBack={() => setSelected(null)} />
        ) : (
          <>
            <p className="text-sm text-muted-foreground">{data.apps.length} app(s)</p>
            {loading ? <LoadingState /> : (
              <Card>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>App Name</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead>Default Domain</TableHead>
                        <TableHead>Last Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.apps.map((app) => (
                        <TableRow key={app.appId} className="cursor-pointer hover:bg-accent" onClick={() => setSelected(app.appId)}>
                          <TableCell className="font-medium">{app.name}</TableCell>
                          <TableCell><Badge variant="outline">{app.platform}</Badge></TableCell>
                          <TableCell className="text-xs">{app.defaultDomain}</TableCell>
                          <TableCell className="text-xs">{app.updateTime ? new Date(app.updateTime).toLocaleDateString() : ""}</TableCell>
                        </TableRow>
                      ))}
                      {data.apps.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No Amplify apps found</TableCell></TableRow>
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
