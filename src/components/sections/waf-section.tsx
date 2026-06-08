"use client";

import { useState } from "react";
import { SectionShell, RequireProfile, LoadingState, useProfileData } from "@/components/section-shell";
import { useProfile } from "@/context/profile-context";
import { useRegion } from "@/context/region-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, ShieldCheck, ShieldX, ShieldAlert } from "lucide-react";

interface WafRule {
  name: string;
  priority: number;
  action: string;
  type: string;
  category: "managed" | "custom";
  status: "enabled" | "disabled" | "overridden";
  managedRuleName?: string;
}
interface Recommendation {
  name: string;
  vendor: string;
  description: string;
}
interface WafDetail {
  name: string;
  arn: string;
  capacity: number;
  defaultAction: string;
  rules: WafRule[];
  managedRules: WafRule[];
  customRules: WafRule[];
  recommendations: Recommendation[];
  associatedResources: string[];
  error?: string;
}
interface AclSummary {
  id: string;
  name: string;
  arn: string;
}

function statusBadge(status: WafRule["status"]) {
  if (status === "enabled") return <Badge variant="default">enabled</Badge>;
  if (status === "overridden") return <Badge variant="secondary">overridden</Badge>;
  return <Badge variant="outline">disabled</Badge>;
}

function RuleRow({ rule }: { rule: WafRule }) {
  return (
    <li className="flex items-center justify-between rounded border px-3 py-2 text-sm">
      <span>
        <span className="font-medium">{rule.name}</span>
        <Badge variant="outline" className="ml-2">{rule.category}</Badge>
        <span className="ml-2 text-xs text-muted-foreground">{rule.type}</span>
      </span>
      {statusBadge(rule.status)}
    </li>
  );
}

function WebAclPanel({ acl }: { acl: AclSummary }) {
  const { profile } = useProfile();
  const { region } = useRegion();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<WafDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !detail && profile) {
      setLoading(true);
      fetch(`/api/waf/detail?id=${encodeURIComponent(acl.id)}&name=${encodeURIComponent(acl.name)}&profile=${profile}&region=${region}`)
        .then((r) => r.json())
        .then((d: WafDetail) => setDetail(d))
        .catch(() => setDetail(null))
        .finally(() => setLoading(false));
    }
  };

  const active = detail?.rules?.filter((r) => r.status === "enabled") ?? [];
  const inactive = detail?.rules?.filter((r) => r.status !== "enabled") ?? [];

  return (
    <Card>
      <CardHeader>
        <button type="button" onClick={toggle} className="flex w-full items-center gap-2 text-left">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <CardTitle className="text-base">{acl.name}</CardTitle>
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-6">
          {loading && <LoadingState />}
          {!loading && detail && !detail.error && (
            <>
              <div className="text-xs text-muted-foreground">
                Default action: {detail.defaultAction} · Capacity: {detail.capacity} · Associated resources: {detail.associatedResources.length}
              </div>

              <section>
                <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" /> Active rules ({active.length})
                </h4>
                {active.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active rules.</p>
                ) : (
                  <ul className="space-y-1">
                    {active.map((r) => <RuleRow key={r.name} rule={r} />)}
                  </ul>
                )}
              </section>

              <section>
                <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <ShieldX className="h-4 w-4 text-muted-foreground" /> Disabled / overridden rules ({inactive.length})
                </h4>
                {inactive.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No disabled or overridden rules.</p>
                ) : (
                  <ul className="space-y-1">
                    {inactive.map((r) => <RuleRow key={r.name} rule={r} />)}
                  </ul>
                )}
              </section>

              <section>
                <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <ShieldAlert className="h-4 w-4 text-amber-600" /> Recommended (not enabled yet) ({detail.recommendations.length})
                </h4>
                {detail.recommendations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">All recommended AWS Managed Rule Groups are enabled.</p>
                ) : (
                  <ul className="space-y-1">
                    {detail.recommendations.map((rec) => (
                      <li key={rec.name} className="rounded border border-amber-300/60 bg-amber-50/40 px-3 py-2 text-sm dark:bg-amber-950/20">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{rec.name}</span>
                          <Badge variant="outline">{rec.vendor}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{rec.description}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
          {!loading && detail?.error && <p className="text-sm text-destructive">Failed to load WebACL detail.</p>}
        </CardContent>
      )}
    </Card>
  );
}

export function WafSection() {
  const { data, loading, refresh } = useProfileData<{ acls: AclSummary[] }>("/api/waf", { acls: [] });

  return (
    <SectionShell title="WAF" onRefresh={refresh} loading={loading}>
      <RequireProfile>
        <p className="mb-4 text-sm text-muted-foreground">Web ACLs, their rules, and AWS best-practice recommendations</p>
        {loading ? (
          <LoadingState />
        ) : data.acls.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">No Web ACLs found</CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.acls.map((acl) => (
              <WebAclPanel key={acl.id} acl={acl} />
            ))}
          </div>
        )}
      </RequireProfile>
    </SectionShell>
  );
}
