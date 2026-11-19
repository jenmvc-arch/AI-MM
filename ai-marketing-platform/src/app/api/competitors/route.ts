import { errorResponse } from "@/lib/api";
import { canAccessWorkspace, currentUser } from "@/lib/server-auth";
import { competitorInputSchema } from "@/lib/intelligence/schema";
import { observationHash } from "@/lib/intelligence/providers";
import { createHash } from "node:crypto";

export async function GET(request: Request) {
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  const brandId = new URL(request.url).searchParams.get("brandId");
  if (!workspaceId) return errorResponse("VALIDATION_ERROR", "workspaceId is required.");
  const { supabase, error } = await canAccessWorkspace(workspaceId, ["owner", "admin", "editor", "viewer"]);
  if (error) return errorResponse("FORBIDDEN", "You cannot access this workspace.");
  let query = supabase.from("competitors").select("id, brand_id, name, website_url, social_profiles, positioning, offers, created_at, competitor_snapshots(id, source_url, source_type, observed_at, positioning, offers, pricing, messaging, channels, evidence, content_hash, change_summary), competitor_content(id, source_url, content_type, title, body, observed_at)").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
  if (brandId) query = query.eq("brand_id", brandId);
  const { data, error: dbError } = await query;
  if (dbError) return errorResponse("DATABASE_ERROR", "Could not load competitor records. Apply migration 0004_phase2_intelligence.sql if needed.");
  return Response.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const { user } = await currentUser();
  if (!user) return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  const parsed = competitorInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Competitor details are invalid.", parsed.error.flatten());
  const input = parsed.data;
  if (input.publicContent && !(input.sourceUrl || input.websiteUrl)) return errorResponse("VALIDATION_ERROR", "Add a source URL when supplying public content.");
  const { supabase, error } = await canAccessWorkspace(input.workspaceId, ["owner", "admin", "editor"]);
  if (error) return errorResponse("FORBIDDEN", "Editor access is required.");
  const { data: brand } = await supabase.from("brands").select("id").eq("id", input.brandId).eq("workspace_id", input.workspaceId).maybeSingle();
  if (!brand) return errorResponse("NOT_FOUND", "Brand not found in this workspace.");
  const { data: workspace } = await supabase.from("workspaces").select("organization_id").eq("id", input.workspaceId).single();
  if (!workspace) return errorResponse("NOT_FOUND", "Workspace not found.");
  const { data: competitor, error: createError } = await supabase.from("competitors").insert({ organization_id: workspace.organization_id, workspace_id: input.workspaceId, brand_id: input.brandId, name: input.name, website_url: input.websiteUrl || null, social_profiles: input.socialProfiles, positioning: input.positioning, offers: input.offers, created_by: user.id }).select("id, brand_id, name, website_url, social_profiles, positioning, offers, created_at").single();
  if (createError || !competitor) return errorResponse("DATABASE_ERROR", "Could not save the competitor.");
  let observation: unknown = null;
  if (input.publicContent) {
    const sourceUrl = input.sourceUrl || input.websiteUrl;
    if (!sourceUrl) return errorResponse("VALIDATION_ERROR", "Add a source URL when supplying public content.");
    const normalized = { positioning: input.positioning, offers: input.offers, pricing: "", messaging: input.publicContent, channels: [], evidence: input.publicContent };
    const { data: previous } = await supabase.from("competitor_snapshots").select("content_hash").eq("competitor_id", competitor.id).order("observed_at", { ascending: false }).limit(1).maybeSingle();
    const digest = createHash("sha256").update(observationHash(normalized)).digest("hex");
    const snapshot = { ...normalized, organization_id: workspace.organization_id, workspace_id: input.workspaceId, competitor_id: competitor.id, source_url: sourceUrl, source_type: "user_provided", content_hash: digest, change_summary: previous?.content_hash && previous.content_hash !== digest ? "User-provided observation changed." : null, created_by: user.id };
    const { data: saved, error: snapshotError } = await supabase.from("competitor_snapshots").insert(snapshot).select("id").single();
    if (snapshotError || !saved) return errorResponse("DATABASE_ERROR", "Competitor was saved, but its observation could not be stored.");
    const { error: contentError } = await supabase.from("competitor_content").insert({ organization_id: workspace.organization_id, workspace_id: input.workspaceId, competitor_id: competitor.id, snapshot_id: saved.id, source_url: sourceUrl, content_type: "website", title: input.name, body: input.publicContent, created_by: user.id });
    if (contentError) return errorResponse("DATABASE_ERROR", "Competitor observation was saved, but its content record could not be stored.");
    observation = snapshot;
  }
  return Response.json({ data: { ...competitor, observation } }, { status: 201 });
}

export async function PATCH() { return errorResponse("METHOD_NOT_ALLOWED", "Use the competitor detail endpoint to update a competitor.", undefined, 405); }
