import { describe, it, expect } from "vitest";
import { WAF_RECOMMENDED_RULE_GROUPS, getMissingRecommendations } from "@/lib/waf-recommendations";

describe("waf-recommendations", () => {
  it("exposes the well-known AWS Managed Rule Groups", () => {
    const names = WAF_RECOMMENDED_RULE_GROUPS.map((r) => r.name);
    expect(names).toContain("AWSManagedRulesCommonRuleSet");
    expect(names).toContain("AWSManagedRulesKnownBadInputsRuleSet");
    expect(names).toContain("AWSManagedRulesSQLiRuleSet");
    expect(names).toContain("AWSManagedRulesLinuxRuleSet");
    expect(names).toContain("AWSManagedRulesAmazonIpReputationList");
    for (const r of WAF_RECOMMENDED_RULE_GROUPS) {
      expect(r.vendor).toBe("AWS");
      expect(typeof r.description).toBe("string");
      expect(r.description.length).toBeGreaterThan(0);
    }
  });

  it("returns recommendations NOT present in the enabled set", () => {
    const missing = getMissingRecommendations(["AWSManagedRulesCommonRuleSet"]);
    const missingNames = missing.map((r) => r.name);
    expect(missingNames).not.toContain("AWSManagedRulesCommonRuleSet");
    expect(missingNames).toContain("AWSManagedRulesSQLiRuleSet");
  });

  it("returns the full list when nothing is enabled", () => {
    expect(getMissingRecommendations([])).toHaveLength(WAF_RECOMMENDED_RULE_GROUPS.length);
  });

  it("returns empty when all recommendations are already enabled", () => {
    const all = WAF_RECOMMENDED_RULE_GROUPS.map((r) => r.name);
    expect(getMissingRecommendations(all)).toHaveLength(0);
  });

  it("is case-sensitive and tolerant of unrelated enabled names", () => {
    const missing = getMissingRecommendations(["SomeCustomRule", "awsmanagedrulescommonruleset"]);
    expect(missing.map((r) => r.name)).toContain("AWSManagedRulesCommonRuleSet");
  });
});
