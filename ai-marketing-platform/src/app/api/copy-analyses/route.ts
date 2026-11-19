import { errorResponse } from "@/lib/api";
import { canAccessWorkspace, currentUser } from "@/lib/server-auth";
import { analyzeCopy } from "@/lib/intelligence/providers";
import { copyAnalysisSchema } from "@/lib/intelligence/schema";

export async function GET(request: Request) {
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId) return errorResponse("VALIDATION_ERROR", "workspaceId is required.");
  const { supabase, error } = await canAccessWorkspace(workspaceId, ["owner", "admin", "editor", "viewer"]);
  if (error) return errorResponse("FORBIDDEN", "You cannot access this workspace.");
  const { data, error: dbError } = await supabase.from("copy_analyses").select("id, brand_id, source_competitor_content_id, source_url, input_copy, analysis_json, model, prompt_version, created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(100);
  if (dbError) return errorResponse("DATABASE_ERROR", "Could not load copy analysis history.");
  return Response.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const { user } = await currentUser();
  if (!user) return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  const parsed = copyAnalysisSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Copy analysis request is invalid.", parsed.error.flatten());
  const input = parsed.data;
  const { supabase, error } = await canAccessWorkspace(input.workspaceId, ["owner", "admin", "editor"]);
  if (error) return errorResponse("FORBIDDEN", "Editor access is required.");
  let brand: unknown = null;
  if (input.brandId) {
    const { data } = await supabase.from("brands").select("id, name, description, tone, market_json").eq("id", input.brandId).eq("workspace_id", input.workspaceId).maybeSingle();
    if (!data) return errorResponse("NOT_FOUND", "Brand not found in this workspace.");
    brand = data;
  }
  try {
    const { output, model } = await analyzeCopy({ copy: input.copy, goal: input.goal, brand, sourceUrl: input.sourceUrl || "" });
    const { data, error: saveError } = await supabase.from("copy_analyses").insert({ organization_id: (await supabase.from("workspaces").select("organization_id").eq("id", input.workspaceId).single()).data?.organization_id, workspace_id: input.workspaceId, brand_id: input.brandId ?? null, source_url: input.sourceUrl || null, input_copy: input.copy, analysis_json: output, model, created_by: user.id }).select("id, brand_id, source_url, input_copy, analysis_json, model, created_at").single();
    if (saveError || !data) return errorResponse("DATABASE_ERROR", "Analysis completed but could not be saved.");
    return Response.json({ data }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error && cause.message === "OPENAI_NOT_CONFIGURED" ? "OpenAI is not configured on the server." : "The copy analysis provider failed. Check provider availability and try again.";
    return errorResponse("PROVIDER_ERROR", message, undefined, 502);
  }
}
