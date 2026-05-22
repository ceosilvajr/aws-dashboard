"use client";

import { useState, useEffect, useCallback } from "react";
import { useProfile } from "@/context/profile-context";
import { useRegion } from "@/context/region-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingState, StatusBadge } from "@/components/section-shell";
import { ArrowLeft, Lock, Unlock, Shield, RefreshCw, FolderOpen, FileText, ChevronRight, AlertTriangle, ExternalLink } from "lucide-react";

interface BucketDetail {
  bucket: string;
  region: string;
  versioningStatus: string;
  publicAccessBlocked: boolean | null;
  encryption: string;
  lifecycleRules: unknown[];
  hasReplication: boolean;
  policy: string | null;
  policyRisk: boolean;
  corsRules: unknown[];
  loggingTarget: string | null;
  tags: { Key?: string; Value?: string }[];
  notificationLambdaFunctions: unknown[];
  notificationSqsQueues: unknown[];
  notificationSnsTopics: unknown[];
  ownershipRule: string | null;
}

interface S3Object {
  key: string;
  size: number;
  storageClass: string;
  lastModified: string;
  etag: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024, units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

function ObjectBrowser({ bucket }: { bucket: string }) {
  const { profile } = useProfile();
  const { region } = useRegion();
  const [prefix, setPrefix] = useState("");
  const [objects, setObjects] = useState<S3Object[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [presigning, setPresigning] = useState<string | null>(null);

  const fetchObjects = useCallback(async (pfx: string, token?: string) => {
    if (!profile) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ profile, region, bucket, prefix: pfx });
      if (token) params.set("continuationToken", token);
      const res = await fetch(`/api/s3/objects?${params}`);
      const data = await res.json();
      setObjects(token ? (prev) => [...prev, ...data.objects] : data.objects);
      setFolders(token ? (prev) => [...prev, ...data.commonPrefixes] : data.commonPrefixes);
      setNextToken(data.nextContinuationToken ?? null);
    } finally { setLoading(false); }
  }, [profile, region, bucket]);

  useEffect(() => { fetchObjects(prefix); }, [fetchObjects, prefix]); // eslint-disable-line react-hooks/set-state-in-effect

  function navigate(pfx: string) { setPrefix(pfx); setObjects([]); setFolders([]); setNextToken(null); }

  const crumbs = prefix.split("/").filter(Boolean);

  async function viewObject(key: string) {
    if (!profile) return;
    setPresigning(key);
    const res = await fetch(`/api/s3/object/presign?${new URLSearchParams({ profile, region, bucket, key })}`);
    const { url, error } = await res.json();
    setPresigning(null);
    if (url) window.open(url, "_blank", "noopener");
    else alert(error ?? "Failed to generate URL");
  }

  return (
    <div className="space-y-3">
      <nav className="flex items-center gap-1 text-sm">
        <button onClick={() => navigate("")} className="text-primary hover:underline">{bucket}</button>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <button onClick={() => navigate(crumbs.slice(0, i + 1).join("/") + "/")} className="text-primary hover:underline">{c}</button>
          </span>
        ))}
      </nav>

      {loading && objects.length === 0 ? <LoadingState /> : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Storage Class</TableHead>
                <TableHead>Last Modified</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {folders.map((f) => (
                <TableRow key={f} className="cursor-pointer hover:bg-accent" onClick={() => navigate(f)}>
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-yellow-500 shrink-0" />
                      {f.slice(prefix.length)}
                    </div>
                  </TableCell>
                  <TableCell colSpan={3} />
                  <TableCell />
                </TableRow>
              ))}
              {objects.map((o) => (
                <TableRow key={o.key}>
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      {o.key.slice(prefix.length)}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{formatBytes(o.size)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{o.storageClass}</Badge></TableCell>
                  <TableCell className="text-xs">{o.lastModified ? new Date(o.lastModified).toLocaleDateString() : ""}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={() => viewObject(o.key)} disabled={presigning === o.key}>
                      {presigning === o.key ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {folders.length === 0 && objects.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Empty folder</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
      {nextToken && (
        <Button variant="outline" size="sm" onClick={() => fetchObjects(prefix, nextToken)} disabled={loading}>
          {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null} Load more
        </Button>
      )}
    </div>
  );
}

export function S3BucketDetail({ bucket, onBack }: { bucket: string; onBack: () => void }) {
  const { profile } = useProfile();
  const { region } = useRegion();
  const [detail, setDetail] = useState<BucketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "objects" | "security">("overview");

  useEffect(() => {
    if (!profile) return;
    setLoading(true); // eslint-disable-line react-hooks/set-state-in-effect
    fetch(`/api/s3/detail?profile=${profile}&region=${region}&bucket=${bucket}`)
      .then((r) => r.json())
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [profile, region, bucket]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
        <h2 className="text-xl font-semibold font-mono">{bucket}</h2>
        {detail && (
          <Badge variant="outline" className="text-xs">{detail.region}</Badge>
        )}
      </div>

      <div className="flex gap-1">
        {(["overview", "objects", "security"] as const).map((t) => (
          <Button key={t} variant={tab === t ? "default" : "outline"} size="sm" onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </Button>
        ))}
      </div>

      {loading ? <LoadingState /> : !detail ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Failed to load bucket details</CardContent></Card>
      ) : tab === "overview" ? (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Versioning</CardTitle></CardHeader>
            <CardContent><StatusBadge status={detail.versioningStatus || "Disabled"} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Encryption</CardTitle></CardHeader>
            <CardContent>
              <Badge variant={detail.encryption === "none" ? "destructive" : "default"}>{detail.encryption}</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Public Access</CardTitle></CardHeader>
            <CardContent className="flex items-center gap-2">
              {detail.publicAccessBlocked === null ? (
                <Badge variant="outline">Unknown</Badge>
              ) : detail.publicAccessBlocked ? (
                <><Lock className="h-4 w-4 text-green-500" /><span className="text-sm text-green-600">All blocked</span></>
              ) : (
                <><Unlock className="h-4 w-4 text-red-500" /><span className="text-sm text-red-600">Partially open</span></>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Lifecycle Rules</CardTitle></CardHeader>
            <CardContent><span className="text-2xl font-bold">{detail.lifecycleRules.length}</span></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Replication</CardTitle></CardHeader>
            <CardContent><Badge variant={detail.hasReplication ? "default" : "outline"}>{detail.hasReplication ? "Enabled" : "None"}</Badge></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Access Logging</CardTitle></CardHeader>
            <CardContent>
              {detail.loggingTarget ? (
                <span className="text-xs font-mono">{detail.loggingTarget}</span>
              ) : (
                <Badge variant="outline">Disabled</Badge>
              )}
            </CardContent>
          </Card>
          {detail.tags.length > 0 && (
            <Card className="col-span-2">
              <CardHeader><CardTitle className="text-sm">Tags</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {detail.tags.map((t) => (
                    <Badge key={t.Key} variant="secondary" className="text-xs">{t.Key}={t.Value}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {(detail.notificationLambdaFunctions.length + detail.notificationSqsQueues.length + detail.notificationSnsTopics.length) > 0 && (
            <Card className="col-span-2">
              <CardHeader><CardTitle className="text-sm">Event Notifications</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {detail.notificationLambdaFunctions.length > 0 && <p>{detail.notificationLambdaFunctions.length} Lambda function(s)</p>}
                {detail.notificationSqsQueues.length > 0 && <p>{detail.notificationSqsQueues.length} SQS queue(s)</p>}
                {detail.notificationSnsTopics.length > 0 && <p>{detail.notificationSnsTopics.length} SNS topic(s)</p>}
              </CardContent>
            </Card>
          )}
        </div>
      ) : tab === "objects" ? (
        <ObjectBrowser bucket={bucket} />
      ) : (
        <div className="space-y-4">
          {detail.policyRisk && (
            <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">World-readable policy detected</p>
                <p className="text-xs text-red-600 dark:text-red-300">This bucket has a policy with Principal: &quot;*&quot; and no Condition. Anyone on the internet may be able to access objects.</p>
              </div>
            </div>
          )}
          <Card>
            <CardHeader><CardTitle className="text-sm">Public Access Block</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                {[
                  ["Block public ACLs", detail.publicAccessBlocked],
                  ["Block public bucket policies", detail.publicAccessBlocked],
                  ["Ignore public ACLs", detail.publicAccessBlocked],
                  ["Restrict public buckets", detail.publicAccessBlocked],
                ].map(([label, on]) => (
                  <div key={label as string} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <div className="flex items-center gap-1">
                      {on ? <Shield className="h-3 w-3 text-green-500" /> : <AlertTriangle className="h-3 w-3 text-red-500" />}
                      <span className={on ? "text-green-600" : "text-red-600"}>{on ? "On" : "Off"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Bucket Policy</CardTitle></CardHeader>
            <CardContent>
              {detail.policy ? (
                <pre className="text-xs bg-muted rounded p-3 overflow-x-auto max-h-80 whitespace-pre-wrap">
                  {JSON.stringify(JSON.parse(detail.policy), null, 2)}
                </pre>
              ) : (
                <span className="text-sm text-muted-foreground">No bucket policy</span>
              )}
            </CardContent>
          </Card>
          {detail.corsRules.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">CORS Rules ({detail.corsRules.length})</CardTitle></CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted rounded p-3 overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {JSON.stringify(detail.corsRules, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
