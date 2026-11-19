import { z } from "zod";

export const researchInputSchema = z.object({
  workspaceId: z.string().uuid(),
  brandId: z.string().uuid().optional(),
  industry: z.string().trim().min(2).max(160),
  product: z.string().trim().min(2).max(2000),
  geography: z.string().trim().min(2).max(160),
  targetCustomers: z.string().trim().min(2).max(2000),
  objectives: z.string().trim().min(2).max(2000),
  idempotencyKey: z.string().trim().min(8).max(160),
});

export const findingCategorySchema = z.enum([
  "market_trend",
  "customer_pain",
  "competitor_landscape",
  "pricing_positioning",
  "swot",
  "opportunity",
  "risk",
  "recommended_action",
]);

export const researchOutputSchema = z.object({
  findings: z.array(
    z.object({
      category: findingCategorySchema,
      claim: z.string().trim().min(5).max(2000),
      classification: z.enum(["verified", "inferred", "hypothesis"]),
      confidence: z.number().min(0).max(1),
      evidence: z.string().max(4000),
      // The Responses API structured-output subset rejects JSON Schema's uri format.
      // Citation integrity is enforced against retrieved source URLs after parsing.
      sourceUrls: z.array(z.string().trim().min(1).max(2048)).max(8),
    }),
  ).min(1).max(40),
});

export type ResearchInput = z.infer<typeof researchInputSchema>;
export type ResearchOutput = z.infer<typeof researchOutputSchema>;

export function enforceCitationIntegrity(output: ResearchOutput, knownUrls: Set<string>): ResearchOutput {
  return {
    findings: output.findings.map((finding) => {
      const validUrls = finding.sourceUrls.filter((url) => knownUrls.has(url));
      const classification = validUrls.length
        ? finding.classification
        : "hypothesis";
      return {
        ...finding,
        classification,
        sourceUrls: validUrls,
      };
    }),
  };
}
