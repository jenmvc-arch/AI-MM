import "server-only";
import { createHash } from "node:crypto";
import { canAccessWorkspace } from "@/lib/server-auth";
import { errorResponse } from "@/lib/api";
import { analyzeMarket, ProviderConfigurationError, searchMarket } from "./providers";
import { enforceCitationIntegrity, type ResearchInput } from "./schema";

export async function runResearchJob(input: {
  supabase: Awaited<ReturnType<typeof canAccessWorkspace>>["supabase"];
  userId: string;
  projectId: string;
  jobId: string;
  attemptCount?: number;
  organizationId: string;
  workspaceId: string;
  brief: ResearchInput;
}) {
  const { supabase, projectId, jobId, organizationId, workspaceId, brief } = input;
  const attemptCount = input.attemptCount ?? 1;
  const startedAt = new Date().toISOString();
  await supabase.from("research_jobs").update({ status: "running", progress: "Searching authorized sources", attempt_count: attemptCount, started_at: startedAt, error_code: null, error_message: null }).eq("id", jobId).eq("workspace_id", workspaceId);
  try {
    const results = await searchMarket(brief);
    if (!results.length) throw new Error("Search returned no usable sources for this research brief.");
    const sourceRows = results.map((result) => ({
      organization_id: organizationId,
      workspace_id: workspaceId,
      project_id: projectId,
      job_id: jobId,
      url: result.url,
      title: result.title,
      retrieved_at: new Date().toISOString(),
      provider: "tavily",
      evidence: result.content,
      content_hash: createHash("sha256").update(result.url).update(result.content).digest("hex"),
      metadata_json: { score: result.score },
    }));
    const { data: savedSources, error: sourceError } = await supabase
      .from("research_sources")
      .insert(sourceRows)
      .select("id, url, title, retrieved_at, evidence, provider");
    if (sourceError || !savedSources?.length) throw new Error("Could not persist research sources.");
    await supabase.from("research_jobs").update({ progress: "Analyzing source evidence" }).eq("id", jobId).eq("workspace_id", workspaceId);
    const analysis = await analyzeMarket(brief, results);
    const knownUrls = new Set(savedSources.map((source) => source.url));
    const output = enforceCitationIntegrity(analysis.output, knownUrls);
    const sourceByUrl = new Map(savedSources.map((source) => [source.url, source]));
    for (const finding of output.findings) {
      const { data: inserted, error: findingError } = await supabase
        .from("market_findings")
        .insert({
          organization_id: organizationId,
          workspace_id: workspaceId,
          project_id: projectId,
          job_id: jobId,
          category: finding.category,
          claim: finding.claim,
          classification: finding.classification,
          confidence: finding.confidence,
          evidence: finding.evidence,
        })
        .select("id")
        .single();
      if (findingError || !inserted) throw new Error("Could not save a research finding.");
      const links = finding.sourceUrls.flatMap((url) => {
        const source = sourceByUrl.get(url);
        return source ? [{ finding_id: inserted.id, source_id: source.id, organization_id: organizationId, workspace_id: workspaceId, project_id: projectId }] : [];
      });
      if (links.length) {
        const { error: linkError } = await supabase.from("market_finding_sources").insert(links);
        if (linkError) throw new Error("Could not save research citations.");
      }
    }
    await supabase.from("research_jobs").update({ status: "completed", progress: "Research complete", provider: "tavily + openai", model: analysis.model, finished_at: new Date().toISOString() }).eq("id", jobId).eq("workspace_id", workspaceId);
    return null;
  } catch (cause) {
    const configurationError = cause instanceof ProviderConfigurationError;
    const message = configurationError
      ? cause.message
      : "A research provider rejected the request or is temporarily unavailable. Check the server-side provider credentials and retry.";
    await supabase.from("research_jobs").update({ status: "failed", progress: "Research could not be completed", error_code: configurationError ? "PROVIDER_NOT_CONFIGURED" : "PROVIDER_ERROR", error_message: message, finished_at: new Date().toISOString() }).eq("id", jobId).eq("workspace_id", workspaceId);
    return configurationError
      ? { code: "PROVIDER_NOT_CONFIGURED", message, status: 503 }
      : { code: "RESEARCH_FAILED", message, status: 502 };
  }
}

export async function getResearchAccess(workspaceId: string, action: "read" | "write") {
  const roles = action === "read" ? ["owner", "admin", "editor", "viewer"] as const : ["owner", "admin", "editor"] as const;
  const access = await canAccessWorkspace(workspaceId, [...roles]);
  if (!access.user) return { access, response: errorResponse("UNAUTHENTICATED", "Sign in to continue.") };
  if (access.error) return { access, response: errorResponse("FORBIDDEN", "You cannot access research in this workspace.") };
  return { access, response: null };
}
