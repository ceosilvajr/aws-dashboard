"use client";

import { useEffect, useState, useCallback } from "react";
import { useProfile } from "@/context/profile-context";
import { useRegion } from "@/context/region-context";
import { SectionShell, RequireProfile } from "@/components/section-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ChevronRight, KeyRound, FileLock2 } from "lucide-react";
import { SecureKeyDetail } from "./secure-key-detail";

interface SecretInfo {
  name: string;
  arn: string;
  description: string;
  lastChangedDate: string | null;
  lastAccessedDate: string | null;
}

interface ParameterInfo {
  name: string;
  type: string;
  lastModifiedDate: string | null;
  version: number;
}

type Tab = "secrets" | "parameters";
type Selection = { kind: "secret" | "parameter"; id?: string; name: string };

function fmt(d: string | null): string {
  return d ? new Date(d).toLocaleDateString() : "—";
}

export function SecureKeysSection() {
  const { profile } = useProfile();
  const { region } = useRegion();
  const [secrets, setSecrets] = useState<SecretInfo[]>([]);
  const [parameters, setParameters] = useState<ParameterInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("secrets");
  const [selected, setSelected] = useState<Selection | null>(null);

  const fetchData = useCallback(async () => {
    if (!profile) { setSecrets([]); setParameters([]); return; }
    setLoading(true);
    try {
      const data = await fetch(`/api/secure-keys?profile=${profile}&region=${region}`).then((r) => r.json());
      setSecrets(data.secrets ?? []);
      setParameters(data.parameters ?? []);
    } catch {
      setSecrets([]);
      setParameters([]);
    }
    setLoading(false);
  }, [profile, region]);

  useEffect(() => { fetchData(); }, [fetchData]); // eslint-disable-line react-hooks/set-state-in-effect

  if (selected && profile) {
    return (
      <SecureKeyDetail
        kind={selected.kind}
        id={selected.id}
        name={selected.name}
        profile={profile}
        onBack={() => setSelected(null)}
      />
    );
  }

  const tabBtn = (id: Tab, label: string, Icon: typeof KeyRound, count: number) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-2 px-4 py-2 text-sm border-b-2 transition-colors ${
        tab === id ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
      <Badge variant="secondary">{count}</Badge>
    </button>
  );

  return (
    <SectionShell title="Secure Keys" onRefresh={fetchData} loading={loading}>
      <RequireProfile>
        <div className="flex gap-2 border-b mb-4">
          {tabBtn("secrets", "Secrets Manager", KeyRound, secrets.length)}
          {tabBtn("parameters", "Parameter Store", FileLock2, parameters.length)}
        </div>

        {loading && (
          <Card><CardContent className="py-12 text-center">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Fetching secure keys…</p>
          </CardContent></Card>
        )}

        {!loading && tab === "secrets" && (
          <Card>
            <CardContent className="overflow-x-auto pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Last Changed</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {secrets.map((s) => (
                    <TableRow
                      key={s.arn || s.name}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => setSelected({ kind: "secret", id: s.arn, name: s.name })}
                    >
                      <TableCell className="font-medium break-all">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.description || "—"}</TableCell>
                      <TableCell className="text-xs">{fmt(s.lastChangedDate)}</TableCell>
                      <TableCell className="w-8 px-2"><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  ))}
                  {secrets.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No secrets found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {!loading && tab === "parameters" && (
          <Card>
            <CardContent className="overflow-x-auto pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Version</TableHead>
                    <TableHead>Last Modified</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parameters.map((p) => (
                    <TableRow
                      key={p.name}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => setSelected({ kind: "parameter", name: p.name })}
                    >
                      <TableCell className="font-medium break-all">{p.name}</TableCell>
                      <TableCell><Badge variant="outline">{p.type}</Badge></TableCell>
                      <TableCell className="text-right">{p.version}</TableCell>
                      <TableCell className="text-xs">{fmt(p.lastModifiedDate)}</TableCell>
                      <TableCell className="w-8 px-2"><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  ))}
                  {parameters.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No parameters found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </RequireProfile>
    </SectionShell>
  );
}
