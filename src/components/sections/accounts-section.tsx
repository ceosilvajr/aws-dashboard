"use client";

import { SectionShell } from "@/components/section-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAccounts } from "@/context/accounts-context";

export function AccountsSection() {
  const { accounts } = useAccounts();
  return (
    <SectionShell title="Accounts">
      <Card>
        <CardHeader><CardTitle className="text-base">Configured AWS Accounts</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accounts.map((a) => (
              <div key={a.profile} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary text-xs font-bold">{a.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{a.id}</p>
                </div>
                <Badge variant="outline" className="ml-auto shrink-0 text-xs">{a.profile}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </SectionShell>
  );
}
