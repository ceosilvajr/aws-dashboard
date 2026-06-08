/** A curated AWS Managed Rule Group recommended as a WAF best practice. */
export interface RecommendedRuleGroup {
  /** Managed rule group name, exactly as it appears in a ManagedRuleGroupStatement. */
  name: string;
  /** Vendor that publishes the rule group. Always "AWS" for these recommendations. */
  vendor: string;
  /** Short human-readable explanation of what the rule group protects against. */
  description: string;
}

/**
 * Well-known AWS Managed Rule Groups that AWS recommends as a baseline WAF setup.
 * Source: AWS WAF "AWS Managed Rules rule groups list" documentation.
 * This is static knowledge — these are read-only recommendations, nothing is mutated in AWS.
 */
export const WAF_RECOMMENDED_RULE_GROUPS: RecommendedRuleGroup[] = [
  {
    name: "AWSManagedRulesCommonRuleSet",
    vendor: "AWS",
    description: "Core baseline protection against a broad range of common OWASP-style threats (Core rule set).",
  },
  {
    name: "AWSManagedRulesKnownBadInputsRuleSet",
    vendor: "AWS",
    description: "Blocks request patterns known to be invalid and associated with exploiting or discovering vulnerabilities.",
  },
  {
    name: "AWSManagedRulesSQLiRuleSet",
    vendor: "AWS",
    description: "Blocks request patterns associated with SQL injection attacks.",
  },
  {
    name: "AWSManagedRulesLinuxRuleSet",
    vendor: "AWS",
    description: "Blocks request patterns associated with exploitation of Linux-specific vulnerabilities (e.g. LFI).",
  },
  {
    name: "AWSManagedRulesAmazonIpReputationList",
    vendor: "AWS",
    description: "Blocks source IPs on the Amazon threat-intelligence reputation list (bots, reconnaissance, DDoS sources).",
  },
  {
    name: "AWSManagedRulesAnonymousIpList",
    vendor: "AWS",
    description: "Blocks requests from anonymizing services (VPNs, proxies, Tor) often used to obscure identity.",
  },
];

/**
 * Returns the recommended rule groups whose `name` is NOT in `enabledManagedRuleNames`.
 * Matching is exact and case-sensitive — managed rule group names are stable identifiers.
 */
export function getMissingRecommendations(enabledManagedRuleNames: string[]): RecommendedRuleGroup[] {
  const enabled = new Set(enabledManagedRuleNames);
  return WAF_RECOMMENDED_RULE_GROUPS.filter((r) => !enabled.has(r.name));
}
