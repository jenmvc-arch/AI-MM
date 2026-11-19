import { errorResponse } from "@/lib/api";
import { getResearchAccess, runResearchJob } from "@/lib/research/run";
import { currentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, context: Context) {
  const { projectId } = await context.params;
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId) return errorResponse("VALIDATION_ERROR", "workspaceId is required.");
  const { access, response } = await getResearchAccess(workspaceId, "write");
  if (response) return response;
  const { supabase, user } = await currentUser();
  if (!user) return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  const [{ data: project }, { data: job }] = await Promise.all([
    access.supabase.from("research_projects").select("id, organization_id, workspace_id, industry, product, geography, target_customers, objectives").eq("id", projectId).eq("workspace_id", workspaceId).maybeSingle(),
    access.supabase.from("research_jobs").select("id, status, attempt_count").eq("project_id", projectId).eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!project || !job) return errorResponse("NOT_FOUND", "Research job not found.");
  if (job.status === "completed" || job.status === "running") return Response.json({ data: { projectId, jobId: job.id, status: job.status } }, { status: 200 });
  if (job.attempt_count >= 3) return errorResponse("RETRY_LIMIT", "This research job has reached its retry limit.");
  const { data: claimed } = await access.supabase.from("research_jobs").update({ status: "running", attempt_count: job.attempt_count + 1, progress: "Searching authorized sources", error_code: null, error_message: null, started_at: new Date().toISOString(), finished_at: null }).eq("id", job.id).eq("status", "failed").eq("attempt_count", job.attempt_count).select("id").maybeSingle();
  if (!claimed) return errorResponse("JOB_ALREADY_CLAIMED", "This research job has already been retried.");
  const error = await runResearchJob({
    supabase,
    userId: user.id,
    projectId,
    jobId: job.id,
    attemptCount: job.attempt_count + 1,
    organizationId: project.organization_id,
    workspaceId,
    brief: {
      workspaceId,
      brandId: undefined,
      industry: project.industry,
      product: project.product,
      geography: project.geography,
      targetCustomers: project.target_customers,
      objectives: project.objectives,
      idempotencyKey: `retry-${job.id}`,
    },
  });
  return Response.json({ data: { projectId, jobId: job.id, status: error ? "failed" : "completed", error: error ? { code: error.code, message: error.message } : undefined } }, { status: error?.status ?? 200 });
}
