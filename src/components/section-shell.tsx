"use client";

import { useProfile } from "@/context/profile-context";
import { useRegion } from "@/context/region-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useEffect, useState, ReactNode } from "react";

export function SectionShell({ title, children, onRefresh, loading }: { title: string; children: ReactNode; onRefresh?: () => void; loading?: boolean }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

export function RequireProfile({ children }: { children: ReactNode }) {
  const { profile } = useProfile();
  if (!profile) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Select an AWS account from the sidebar to view resources
        </CardContent>
      </Card>
    );
  }
  return <>{children}</>;
}

export function LoadingState() {
  return (
    <div className="py-12 text-center">
      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
      <p className="mt-2 text-sm text-muted-foreground">Loading resources…</p>
    </div>
  );
}

export function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const variant = s.includes("ACTIVE") || s.includes("COMPLETE") || s.includes("AVAILABLE") || s === "HEALTHY"
    ? "default"
    : s.includes("FAILED") || s.includes("ERROR") || s.includes("UNHEALTHY")
    ? "destructive"
    : s.includes("PROGRESS") || s.includes("PENDING") || s.includes("CREATING")
    ? "secondary"
    : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}

// Generic hook for fetching data when profile or region changes
export function useProfileData<T>(url: string, defaultValue: T): { data: T; loading: boolean; refresh: () => void } {
  const { profile } = useProfile();
  const { region } = useRegion();
  const [data, setData] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(false);

  const fetchData = () => {
    if (!profile) { setData(defaultValue); return; }
    setLoading(true);
    const sep = url.includes("?") ? "&" : "?";
    fetch(`${url}${sep}profile=${profile}&region=${region}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(defaultValue))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [profile, region]); // eslint-disable-line react-hooks/exhaustive-deps,react-hooks/set-state-in-effect

  return { data, loading, refresh: fetchData };
}
