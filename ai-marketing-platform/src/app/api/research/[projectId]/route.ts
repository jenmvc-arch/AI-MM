import { errorResponse } from "@/lib/api";
import { getResearchAccess } from "@/lib/research/run";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: Context) {
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId) return errorResponse("VALIDATION_ERROR", "workspaceId is required.");
  const { access, response } = await getResearchAccess(workspaceId, "read");
  if (response) return response;
  const { projectId } = await context.params;
  const { data: project, error } = await access.supabase
    .from("research_projects")
    .select("id, title, industry, product, geography, target_customers, objectives, created_at")
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error || !project) return errorResponse("NOT_FOUND", "Research project not found.");
  const [{ data: jobs, error: jobError }, { data: findings, error: findingError }] = await Promise.all([
    access.supabase.from("research_jobs").select("id, status, progress, attempt_count, error_code, error_message, provider, model, started_at, finished_at, created_at").eq("project_id", projectId).eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    access.supabase.from("market_findings").select("id, job_id, category, claim, classification, confidence, evidence, created_at, market_finding_sources(source_id, research_sources(id, title, url, retrieved_at, evidence, provider))").eq("project_id", projectId).eq("workspace_id", workspaceId).order("created_at", { ascending: true }),
  ]);
  if (jobError || findingError) return errorResponse("DATABASE_ERROR", "Could not load research evidence.");
  const safeJobs = (jobs ?? []).map((job) => ({
    ...job,
    error_message: job.status === "failed"
      ? "A research provider rejected the request or is temporarily unavailable. Check the server-side provider credentials and retry."
      : null,
  }));
  return Response.json({ data: { project, jobs: safeJobs, findings: findings ?? [] } });
}
