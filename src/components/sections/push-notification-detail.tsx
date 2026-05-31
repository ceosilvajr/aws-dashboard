"use client";

import { useEffect, useState, useCallback } from "react";
import { useRegion } from "@/context/region-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, RefreshCw, Bell, Smartphone } from "lucide-react";

interface PlatformDetailProps {
  platformArn: string;
  platformName: string;
  platform: string;
  profile: string;
  onBack: () => void;
}

interface PlatformEndpoint {
  arn: string;
  token: string;
  enabled: boolean;
  userData?: string;
}

interface DetailData {
  attributes: Record<string, string>;
  endpoints: PlatformEndpoint[];
}

const ATTRIBUTE_LABELS: { key: string; label: string }[] = [
  { key: "Enabled", label: "Enabled" },
  { key: "SuccessFeedbackRoleArn", label: "Success Feedback Role" },
  { key: "FailureFeedbackRoleArn", label: "Failure Feedback Role" },
  { key: "SuccessFeedbackSampleRate", label: "Success Sample Rate" },
  { key: "ApplePlatformTeamID", label: "Apple Team ID" },
  { key: "ApplePlatformBundleID", label: "Bundle ID" },
  { key: "AppleCertificateExpiryDate", label: "Cert Expiry" },
];

const PLATFORM_DISPLAY: Record<string, string> = {
  GCM: "Android (FCM)",
  APNS: "iOS (APNS)",
  APNS_SANDBOX: "iOS Sandbox (APNS)",
};

export function PushNotificationDetail({ platformArn, platformName, platform, profile, onBack }: PlatformDetailProps) {
  const { region } = useRegion();
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/sns-platforms/detail?arn=${encodeURIComponent(platformArn)}&profile=${encodeURIComponent(profile)}&region=${region}`;
      const result = await fetch(url).then((r) => r.json());
      if (result.error) {
        setError(result.error);
      } else {
        setData(result);
      }
    } catch {
      setError("Failed to load platform details");
    }
    setLoading(false);
  }, [platformArn, profile, region]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]); // eslint-disable-line react-hooks/set-state-in-effect

  const enabledCount = data?.endpoints?.filter((e) => e.enabled).length ?? 0;
  const disabledCount = (data?.endpoints?.length ?? 0) - enabledCount;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />Back
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{platformName}</h2>
            <Badge variant="outline">{PLATFORM_DISPLAY[platform] ?? platform}</Badge>
          </div>
          <p className="text-xs text-muted-foreground font-mono">{platformArn}</p>
        </div>
      </div>

      {loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Loading platform details…</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {data && !loading && (
        <>
          {/* Attributes */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm">Platform Attributes</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ATTRIBUTE_LABELS.filter(({ key }) => data.attributes[key] !== undefined).map(({ key, label }) => (
                  <div key={key} className="flex flex-col gap-0.5 rounded-lg border p-3">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    {key === "Enabled" ? (
                      <Badge variant={data.attributes[key] === "true" ? "default" : "secondary"} className="w-fit">
                        {data.attributes[key] === "true" ? "Enabled" : "Disabled"}
                      </Badge>
                    ) : (
                      <span className="text-sm font-mono break-all">{data.attributes[key]}</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Endpoint stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Endpoints</p>
                    <p className="text-xl font-bold">{data.endpoints.length.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div>
                  <p className="text-xs text-muted-foreground">Enabled</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">{enabledCount.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div>
                  <p className="text-xs text-muted-foreground">Disabled</p>
                  <p className="text-xl font-bold text-muted-foreground">{disabledCount.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Endpoints table */}
          {data.endpoints.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Registered Device Endpoints</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Endpoint ARN</TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.endpoints.map((ep) => (
                      <TableRow key={ep.arn}>
                        <TableCell className="font-mono text-xs text-muted-foreground max-w-xs truncate">{ep.arn}</TableCell>
                        <TableCell className="font-mono text-xs">{ep.token}</TableCell>
                        <TableCell>
                          <Badge variant={ep.enabled ? "default" : "secondary"}>
                            {ep.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {data.endpoints.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No registered device endpoints for this platform application.
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
