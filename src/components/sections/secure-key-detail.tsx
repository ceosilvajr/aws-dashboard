"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw } from "lucide-react";

interface SecretDetail {
  kind: "secret";
  name: string;
  arn: string;
  description: string;
  rotationEnabled: boolean;
  lastChangedDate: string | null;
  lastAccessedDate: string | null;
  createdDate: string | null;
  tags: { key: string; value: string }[];
}

interface ParameterDetail {
  kind: "parameter";
  name: string;
  type: string;
  version: number;
  lastModifiedDate: string | null;
  description: string;
  tier: string;
  dataType: string;
}

type Detail = SecretDetail | ParameterDetail;

interface Props {
  kind: "secret" | "parameter";
  id?: string;
  name: string;
  profile: string;
  onBack: () => void;
}

function fmt(d: string | null): string {
  return d ? new Date(d).toLocaleString() : "—";
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right break-all">{children}</span>
    </div>
  );
}

export function SecureKeyDetail({ kind, id, name, profile, onBack }: Props) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    const params = new URLSearchParams({ kind, profile });
    if (kind === "secret") params.set("id", id ?? name);
    else params.set("name", name);
    try {
      const data = await fetch(`/api/secure-keys/detail?${params.toString()}`).then((r) => r.json());
      if (data.error) { setFailed(true); setDetail(null); }
      else setDetail(data);
    } catch {
      setFailed(true);
      setDetail(null);
    }
    setLoading(false);
  }, [kind, id, name, profile]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]); // eslint-disable-line react-hooks/set-state-in-effect

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        <div>
          <h2 className="text-lg font-semibold break-all">{name}</h2>
          <p className="text-xs text-muted-foreground capitalize">{kind}</p>
        </div>
      </div>

      {loading ? (
        <Card><CardContent className="py-12 text-center">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading details…</p>
        </CardContent></Card>
      ) : failed ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Failed to load details</CardContent></Card>
      ) : detail?.kind === "secret" ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Secret Metadata</CardTitle></CardHeader>
          <CardContent>
            <Row label="Description">{detail.description || "—"}</Row>
            <Row label="ARN">{detail.arn}</Row>
            <Row label="Rotation">{detail.rotationEnabled ? <Badge>Enabled</Badge> : <Badge variant="outline">Disabled</Badge>}</Row>
            <Row label="Created">{fmt(detail.createdDate)}</Row>
            <Row label="Last Changed">{fmt(detail.lastChangedDate)}</Row>
            <Row label="Last Accessed">{fmt(detail.lastAccessedDate)}</Row>
            {detail.tags.length > 0 && (
              <Row label="Tags">{detail.tags.map((t) => `${t.key}=${t.value}`).join(", ")}</Row>
            )}
          </CardContent>
        </Card>
      ) : detail?.kind === "parameter" ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Parameter Metadata</CardTitle></CardHeader>
          <CardContent>
            <Row label="Description">{detail.description || "—"}</Row>
            <Row label="Type"><Badge variant="outline">{detail.type}</Badge></Row>
            <Row label="Tier">{detail.tier || "—"}</Row>
            <Row label="Data Type">{detail.dataType || "—"}</Row>
            <Row label="Version">{detail.version}</Row>
            <Row label="Last Modified">{fmt(detail.lastModifiedDate)}</Row>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
