import { errorResponse } from "@/lib/api";
import { canAccessWorkspace, currentUser } from "@/lib/server-auth";
import { generateStrategy } from "@/lib/intelligence/providers";
import { strategyInputSchema } from "@/lib/intelligence/schema";

export async function GET(request: Request) {
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId) return errorResponse("VALIDATION_ERROR", "workspaceId is required.");
  const { supabase, error } = await canAccessWorkspace(workspaceId, ["owner", "admin", "editor", "viewer"]);
  if (error) return errorResponse("FORBIDDEN", "You cannot access this workspace.");
  const { data, error: dbError } = await supabase.from("marketing_strategies").select("id, brand_id, title, version, strategy_json, research_project_ids, competitor_ids, status, model, created_at, updated_at, marketing_strategy_versions(id, version, created_at)").eq("workspace_id", workspaceId).order("updated_at", { ascending: false });
  if (dbError) return errorResponse("DATABASE_ERROR", "Could not load saved strategies.");
  return Response.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const { user } = await currentUser();
  if (!user) return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  const parsed = strategyInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Strategy brief is invalid.", parsed.error.flatten());
  const input = parsed.data;
  const { supabase, error } = await canAccessWorkspace(input.workspaceId, ["owner", "admin", "editor"]);
  if (error) return errorResponse("FORBIDDEN", "Editor access is required.");
  const [{ data: brand }, { data: research }, { data: competitors }] = await Promise.all([
    supabase.from("brands").select("id, name, website, description, tone, market_json").eq("id", input.brandId).eq("workspace_id", input.workspaceId).maybeSingle(),
    supabase.from("research_projects").select("id, title, market_findings(category, claim, classification, confidence, evidence, market_finding_sources(research_sources(url, title, retrieved_at)))").eq("workspace_id", input.workspaceId).order("created_at", { ascending: false }).limit(5),
    supabase.from("competitors").select("id, name, website_url, positioning, offers, competitor_snapshots(source_url, observed_at, positioning, offers, pricing, messaging, evidence)").eq("brand_id", input.brandId).order("created_at", { ascending: false }).limit(20),
  ]);
  if (!brand) return errorResponse("NOT_FOUND", "Brand not found in this workspace.");
  try {
    const { output, model } = await generateStrategy({ brief: input, brand, research: research ?? [], competitors: competitors ?? [] });
    const organizationId = (await supabase.from("workspaces").select("organization_id").eq("id", input.workspaceId).single()).data?.organization_id;
    const researchIds = (research ?? []).map((project) => project.id);
    const competitorIds = (competitors ?? []).map((competitor) => competitor.id);
    const { data: strategy, error: saveError } = await supabase.from("marketing_strategies").insert({ organization_id: organizationId, workspace_id: input.workspaceId, brand_id: input.brandId, title: input.title, version: 1, strategy_json: output, research_project_ids: researchIds, competitor_ids: competitorIds, model, created_by: user.id, updated_by: user.id }).select("id, brand_id, title, version, strategy_json, research_project_ids, competitor_ids, status, model, created_at, updated_at").single();
    if (saveError || !strategy) return errorResponse("DATABASE_ERROR", "Strategy generated but could not be saved.");
    return Response.json({ data: strategy }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error && cause.message === "OPENAI_NOT_CONFIGURED" ? "OpenAI is not configured on the server." : "The strategy provider failed. Check provider availability and try again.";
    return errorResponse("PROVIDER_ERROR", message, undefined, 502);
  }
}
