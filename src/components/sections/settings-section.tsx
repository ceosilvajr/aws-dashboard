"use client";

import { SectionShell } from "@/components/section-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { useAccounts } from "@/context/accounts-context";
import { useRegion } from "@/context/region-context";
import { useState } from "react";

const DEPLOY_DEFAULTS_KEY = "aws-dashboard-deploy-defaults";

interface DeployDefaults {
  owner: string;
  costCenter: string;
}

function loadDeployDefaults(): DeployDefaults {
  if (typeof window === "undefined") return { owner: "", costCenter: "" };
  try { return JSON.parse(localStorage.getItem(DEPLOY_DEFAULTS_KEY) ?? "{}"); } catch { return { owner: "", costCenter: "" }; }
}

export function SettingsSection() {
  const { theme, setTheme } = useTheme();
  const { groups, enabledGroups, setEnabledGroups, loading } = useAccounts();
  const { region, setRegion, regions } = useRegion();
  const [defaults, setDefaults] = useState<DeployDefaults>(loadDeployDefaults);
  const [saved, setSaved] = useState(false);

  function toggleGroup(group: string) {
    if (enabledGroups.includes(group)) {
      setEnabledGroups(enabledGroups.filter((g) => g !== group));
    } else {
      setEnabledGroups([...enabledGroups, group]);
    }
  }

  function saveDefaults() {
    localStorage.setItem(DEPLOY_DEFAULTS_KEY, JSON.stringify(defaults));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <SectionShell title="Settings">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Choose your preferred theme</p>
          <div className="flex gap-2">
            {([
              { id: "light", label: "Light", icon: Sun },
              { id: "dark", label: "Dark", icon: Moon },
              { id: "system", label: "System", icon: Monitor },
            ] as const).map((t) => (
              <Button
                key={t.id}
                variant={theme === t.id ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme(t.id)}
              >
                <t.icon className="h-4 w-4 mr-2" />
                {t.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AWS Region</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Select the default AWS region for all resource queries. This is persisted to your browser.
          </p>
          <select
            className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            {regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile Groups</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Enable or disable account groups. Only enabled groups appear in the sidebar and dashboard.
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading groups…</p>
          ) : (
            <div className="space-y-2">
              {groups.map((group) => (
                <label key={group} className="flex items-center justify-between rounded-lg border px-4 py-3 cursor-pointer hover:bg-accent transition-colors">
                  <span className="text-sm font-medium">{group}</span>
                  <input
                    type="checkbox"
                    checked={enabledGroups.includes(group)}
                    onChange={() => toggleGroup(group)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deploy Defaults</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            These values are pre-filled in the CloudFormation deploy wizard for cost tracking and ownership.
          </p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Owner (email)</label>
            <Input
              placeholder="team@example.com"
              value={defaults.owner}
              onChange={(e) => setDefaults({ ...defaults, owner: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Cost Center</label>
            <Input
              placeholder="MY-TEAM"
              value={defaults.costCenter}
              onChange={(e) => setDefaults({ ...defaults, costCenter: e.target.value })}
            />
          </div>
          <Button size="sm" onClick={saveDefaults}>
            {saved ? "Saved!" : "Save Defaults"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">AWS Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-2">
            This dashboard reads AWS credentials from your local{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">~/.aws/config</code> profiles.
            Any profile in your config file is automatically discovered — no configuration needed.
          </p>
          <p className="text-sm text-muted-foreground">
            Override the default region by setting{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">AWS_DASHBOARD_REGION</code> in your environment,
            or use the region picker above.
          </p>
        </CardContent>
      </Card>
    </SectionShell>
  );
}
