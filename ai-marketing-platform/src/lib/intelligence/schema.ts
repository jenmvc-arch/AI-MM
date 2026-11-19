import { z } from "zod";

const httpUrl = z.string().trim().url().refine((value) => {
  try { return /^https?:$/.test(new URL(value).protocol); } catch { return false; }
});

export const competitorInputSchema = z.object({
  workspaceId: z.string().uuid(),
  brandId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  websiteUrl: httpUrl.optional().or(z.literal("")),
  socialProfiles: z.record(z.string(), httpUrl).default({}),
  positioning: z.string().max(2000).default(""),
  offers: z.string().max(2000).default(""),
  publicContent: z.string().max(20000).optional(),
  sourceUrl: httpUrl.optional().or(z.literal("")),
});

export const copyAnalysisSchema = z.object({
  workspaceId: z.string().uuid(),
  brandId: z.string().uuid().optional(),
  copy: z.string().trim().min(10).max(20000),
  sourceUrl: httpUrl.optional().or(z.literal("")),
  goal: z.string().max(500).default(""),
});

export const copyOutputSchema = z.object({
  hook: z.string().max(1200),
  headline: z.string().max(1200),
  offer: z.string().max(1200),
  valueProposition: z.string().max(1600),
  cta: z.string().max(500),
  tone: z.array(z.string().max(80)).max(8),
  targetAudience: z.string().max(1200),
  structures: z.array(z.enum(["AIDA", "PAS", "FAB", "BAB", "none"])).max(5),
  strengths: z.array(z.string().max(500)).max(8),
  gaps: z.array(z.string().max(500)).max(8),
  differentiatedCopy: z.array(z.string().max(2000)).min(1).max(5),
});

export const strategyInputSchema = z.object({
  workspaceId: z.string().uuid(),
  brandId: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  objective: z.string().trim().min(5).max(2000),
  geography: z.string().trim().min(2).max(160),
});

export const strategyOutputSchema = z.object({
  audienceHypotheses: z.array(z.object({ audience: z.string().max(500), rationale: z.string().max(1200), confidence: z.number().min(0).max(1), evidence: z.array(z.string().max(200)).max(8) })).min(1).max(8),
  positioning: z.array(z.string().max(1200)).min(1).max(8),
  contentPillars: z.array(z.object({ name: z.string().max(120), description: z.string().max(800), formats: z.array(z.string().max(120)).max(8) })).min(1).max(8),
  campaignConcepts: z.array(z.object({ name: z.string().max(160), audience: z.string().max(500), message: z.string().max(1000), channel: z.string().max(120), hypothesis: z.string().max(1000) })).min(1).max(8),
  channels: z.array(z.object({ name: z.string().max(120), rationale: z.string().max(800), kpis: z.array(z.string().max(120)).max(8) })).min(1).max(8),
  actionPlan: z.array(z.object({ dayRange: z.enum(["0-30", "31-60", "61-90"]), action: z.string().max(1000), priority: z.enum(["high", "medium", "low"]), kpi: z.string().max(200) })).min(3).max(30),
  limitations: z.array(z.string().max(500)).max(10),
});

export const strategyUpdateSchema = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().trim().min(2).max(200).optional(),
  strategy: strategyOutputSchema,
  status: z.enum(["draft", "active", "archived"]).optional(),
});

export const scheduleSchema = z.object({
  workspaceId: z.string().uuid(),
  competitorId: z.string().uuid(),
  intervalHours: z.number().int().min(24).max(2160),
  enabled: z.boolean().default(true),
});

export { httpUrl };
