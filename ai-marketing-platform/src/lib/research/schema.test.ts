import { describe, expect, it } from "vitest";
import {
  enforceCitationIntegrity,
  researchInputSchema,
  researchOutputSchema,
} from "./schema";

describe("market research contracts", () => {
  it("rejects incomplete or malformed briefs", () => {
    expect(researchInputSchema.safeParse({ industry: "retail" }).success).toBe(false);
  });

  it("rejects malformed structured model output", () => {
    expect(researchOutputSchema.safeParse({ findings: [{ claim: "missing required fields" }] }).success).toBe(false);
  });

  it("downgrades uncited and unknown-URL claims to hypotheses", () => {
    const output = researchOutputSchema.parse({
      findings: [
        { category: "market_trend", claim: "A sourced market claim", classification: "verified", confidence: 0.8, evidence: "Evidence", sourceUrls: ["https://known.example/article", "https://invented.example"] },
        { category: "opportunity", claim: "An uncited suggestion", classification: "inferred", confidence: 0.5, evidence: "Reasoning", sourceUrls: [] },
      ],
    });
    const safe = enforceCitationIntegrity(output, new Set(["https://known.example/article"]));
    expect(safe.findings[0]).toMatchObject({ classification: "verified", sourceUrls: ["https://known.example/article"] });
    expect(safe.findings[1]).toMatchObject({ classification: "hypothesis", sourceUrls: [] });
  });
});
