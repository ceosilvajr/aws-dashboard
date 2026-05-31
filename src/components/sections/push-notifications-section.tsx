"use client";

import { useEffect, useState, useCallback } from "react";
import { useProfile } from "@/context/profile-context";
import { useRegion } from "@/context/region-context";
import { SectionShell, RequireProfile, StatCard } from "@/components/section-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Bell, Smartphone, ChevronRight } from "lucide-react";
import { PushNotificationDetail } from "./push-notification-detail";

interface PlatformAppInfo {
  account: string;
  accountId: string;
  profile: string;
  arn: string;
  name: string;
  platform: string;
  enabled: boolean;
  attributes: Record<string, string>;
}

const PLATFORM_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  GCM: { label: "Android (FCM)", variant: "default" },
  APNS: { label: "iOS (APNS)", variant: "secondary" },
  APNS_SANDBOX: { label: "iOS Sandbox", variant: "outline" },
};

export function PushNotificationsSection() {
  const { profile } = useProfile();
  const { region } = useRegion();
  const [platforms, setPlatforms] = useState<PlatformAppInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformAppInfo | null>(null);

  const fetchPlatforms = useCallback(async () => {
    setLoading(true);
    try {
      const url = profile
        ? `/api/sns-platforms?profile=${profile}&region=${region}`
        : `/api/sns-platforms?region=${region}`;
      const data = await fetch(url).then((r) => r.json());
      setPlatforms(data.platforms ?? []);
    } catch {
      setPlatforms([]);
    }
    setLoading(false);
  }, [profile, region]);

  useEffect(() => { fetchPlatforms(); }, [fetchPlatforms]); // eslint-disable-line react-hooks/set-state-in-effect

  if (selectedPlatform) {
    return (
      <PushNotificationDetail
        platformArn={selectedPlatform.arn}
        platformName={selectedPlatform.name}
        platform={selectedPlatform.platform}
        profile={selectedPlatform.profile}
        onBack={() => setSelectedPlatform(null)}
      />
    );
  }

  const grouped = platforms.reduce<Record<string, PlatformAppInfo[]>>((acc, p) => {
    const key = `${p.account} (${p.accountId})`;
    (acc[key] ??= []).push(p);
    return acc;
  }, {});

  const androidCount = platforms.filter((p) => p.platform === "GCM").length;
  const iosCount = platforms.filter((p) => p.platform === "APNS" || p.platform === "APNS_SANDBOX").length;

  return (
    <SectionShell title="Push Notifications" onRefresh={fetchPlatforms} loading={loading}>
      <RequireProfile>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <StatCard label="Total Platforms" value={platforms.length} icon={Bell} />
          <StatCard label="Android (FCM)" value={androidCount} icon={Smartphone} />
          <StatCard label="iOS (APNS)" value={iosCount} icon={Smartphone} />
        </div>

        {loading && platforms.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Fetching platform applications…</p>
            </CardContent>
          </Card>
        )}

        {!loading && platforms.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No SNS platform applications found.</p>
            </CardContent>
          </Card>
        )}

        {Object.entries(grouped).map(([label, accountPlatforms]) => (
          <Card key={label} className="mb-4">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{label}</CardTitle>
                <Badge variant="secondary">{accountPlatforms.length} app{accountPlatforms.length !== 1 ? "s" : ""}</Badge>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>ARN</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountPlatforms.map((p) => {
                    const platformMeta = PLATFORM_LABELS[p.platform] ?? { label: p.platform, variant: "outline" as const };
                    return (
                      <TableRow
                        key={p.arn}
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => setSelectedPlatform(p)}
                      >
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>
                          <Badge variant={platformMeta.variant}>{platformMeta.label}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground max-w-xs truncate">{p.arn}</TableCell>
                        <TableCell>
                          <Badge variant={p.enabled ? "default" : "secondary"}>
                            {p.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </TableCell>
                        <TableCell className="w-8 px-2">
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
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
