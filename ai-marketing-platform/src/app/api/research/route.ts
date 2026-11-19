import { errorResponse } from "@/lib/api";
import { getResearchAccess, runResearchJob } from "@/lib/research/run";
import { researchInputSchema } from "@/lib/research/schema";
import { currentUser } from "@/lib/server-auth";

export async function GET(request: Request) {
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId) return errorResponse("VALIDATION_ERROR", "workspaceId is required.");
  const { access, response } = await getResearchAccess(workspaceId, "read");
  if (response) return response;
  const { data, error } = await access.supabase
    .from("research_projects")
    .select("id, title, industry, product, geography, target_customers, objectives, created_at, research_jobs(id, status, progress, error_code, created_at)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) return errorResponse("MIGRATION_REQUIRED", "Market Research is not initialized in this Supabase project. Apply supabase/migrations/0003_market_research.sql, then reload.", { databaseCode: error.code });
  return Response.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const { user } = await currentUser();
  if (!user) return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  const parsed = researchInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Research brief is invalid.", parsed.error.flatten());
  const brief = parsed.data;
  const { access, response } = await getResearchAccess(brief.workspaceId, "write");
  if (response) return response;

  const title = `${brief.industry}: ${brief.geography}`.slice(0, 160);
  const { data: created, error: createError } = await access.supabase.rpc("create_research_project_job", {
    target_workspace: brief.workspaceId,
    target_brand: brief.brandId ?? null,
    research_title: title,
    research_industry: brief.industry,
    research_product: brief.product,
    research_geography: brief.geography,
    research_customers: brief.targetCustomers,
    research_objectives: brief.objectives,
    request_key: brief.idempotencyKey,
  });
  if (createError || !created?.[0]) return errorResponse("DATABASE_ERROR", "Could not create research project.");
  const job = created[0];
  if (!job.was_created) return Response.json({ data: { projectId: job.project_id, jobId: job.job_id, status: job.job_status } }, { status: job.job_status === "failed" ? 502 : 200 });
  const { data: workspace } = await access.supabase.from("workspaces").select("organization_id").eq("id", brief.workspaceId).single();
  if (!workspace) return errorResponse("NOT_FOUND", "Workspace not found.");
  const providerError = await runResearchJob({ supabase: access.supabase, userId: user.id, projectId: job.project_id, jobId: job.job_id, organizationId: workspace.organization_id, workspaceId: brief.workspaceId, brief });
  return Response.json({ data: { projectId: job.project_id, jobId: job.job_id, status: providerError ? "failed" : "completed", error: providerError ? { code: providerError.code, message: providerError.message } : undefined } }, { status: providerError ? providerError.status : 201 });
}
