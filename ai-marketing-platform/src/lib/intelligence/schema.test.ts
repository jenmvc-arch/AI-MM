import { describe, expect, it } from "vitest";
import { competitorInputSchema, copyAnalysisSchema, copyOutputSchema, scheduleSchema, strategyInputSchema, strategyOutputSchema, strategyUpdateSchema } from "./schema";

const workspaceId = "40000000-0000-4000-8000-000000000004";
const brandId = "70000000-0000-4000-8000-000000000007";

describe("Phase 2 intelligence contracts", () => {
  it("rejects invalid competitor source URLs and malformed social profiles", () => {
    expect(competitorInputSchema.safeParse({ workspaceId, brandId, name: "Competitor", websiteUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(competitorInputSchema.safeParse({ workspaceId, brandId, name: "Competitor", socialProfiles: { social: "not-a-url" } }).success).toBe(false);
  });

  it("rejects empty or oversized copy-analysis requests", () => {
    expect(copyAnalysisSchema.safeParse({ workspaceId, copy: "short" }).success).toBe(false);
    expect(copyAnalysisSchema.safeParse({ workspaceId, copy: "A meaningful source copy example", sourceUrl: "file:///private/source" }).success).toBe(false);
  });

  it("validates strategy output and enforces the 30/60/90 action ranges", () => {
    const valid = { audienceHypotheses: [{ audience: "Scalp care consumers", rationale: "Research suggests need", confidence: 0.7, evidence: ["research-project-id"] }], positioning: ["Evidence-led scalp care"], contentPillars: [{ name: "Education", description: "Explain ingredient use", formats: ["short video"] }], campaignConcepts: [{ name: "Scalp reset", audience: "Scalp care consumers", message: "Care for your scalp", channel: "Instagram", hypothesis: "Education creates interest" }], channels: [{ name: "Instagram", rationale: "Suitable visual format", kpis: ["engagement"] }], actionPlan: [{ dayRange: "0-30", action: "Interview current customers", priority: "high", kpi: "interviews completed" }, { dayRange: "31-60", action: "Publish education series", priority: "medium", kpi: "qualified visits" }, { dayRange: "61-90", action: "Review performance", priority: "medium", kpi: "cost per qualified visit" }], limitations: ["Audience is a hypothesis"] };
    expect(strategyOutputSchema.safeParse(valid).success).toBe(true);
    expect(strategyOutputSchema.safeParse({ ...valid, actionPlan: [{ ...valid.actionPlan[0], dayRange: "90-120" }] }).success).toBe(false);
  });

  it("requires full validated strategy data when saving an edit", () => {
    expect(strategyUpdateSchema.safeParse({ workspaceId, title: "Plan", strategy: { actionPlan: [] } }).success).toBe(false);
    expect(scheduleSchema.safeParse({ workspaceId, competitorId: brandId, intervalHours: 5 }).success).toBe(false);
    expect(copyOutputSchema.safeParse({ hook: "x" }).success).toBe(false);
    expect(strategyInputSchema.safeParse({ workspaceId, brandId, title: "Plan", objective: "Grow awareness", geography: "Malaysia" }).success).toBe(true);
  });
});
