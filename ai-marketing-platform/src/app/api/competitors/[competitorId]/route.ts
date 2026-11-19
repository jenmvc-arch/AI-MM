import { errorResponse } from "@/lib/api";
import { canAccessWorkspace, currentUser } from "@/lib/server-auth";
import { competitorInputSchema } from "@/lib/intelligence/schema";

type Context = { params: Promise<{ competitorId: string }> };

export async function PATCH(request: Request, context: Context) {
  const { competitorId } = await context.params;
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId) return errorResponse("VALIDATION_ERROR", "workspaceId is required.");
  const { user } = await currentUser();
  if (!user) return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  const parsed = competitorInputSchema.safeParse({ ...(await request.json().catch(() => null)), workspaceId });
  if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Competitor details are invalid.", parsed.error.flatten());
  const { supabase, error } = await canAccessWorkspace(workspaceId, ["owner", "admin", "editor"]);
  if (error) return errorResponse("FORBIDDEN", "Editor access is required.");
  const { data, error: updateError } = await supabase.from("competitors").update({ brand_id: parsed.data.brandId, name: parsed.data.name, website_url: parsed.data.websiteUrl || null, social_profiles: parsed.data.socialProfiles, positioning: parsed.data.positioning, offers: parsed.data.offers }).eq("id", competitorId).eq("workspace_id", workspaceId).select("id, brand_id, name, website_url, social_profiles, positioning, offers, created_at").maybeSingle();
  if (updateError || !data) return errorResponse("NOT_FOUND", "Competitor was not found in this workspace.");
  return Response.json({ data });
}

export async function DELETE(request: Request, context: Context) {
  const { competitorId } = await context.params;
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId) return errorResponse("VALIDATION_ERROR", "workspaceId is required.");
  const { supabase, error } = await canAccessWorkspace(workspaceId, ["owner", "admin"]);
  if (error) return errorResponse("FORBIDDEN", "Owner or admin access is required to delete competitors.");
  const { error: dbError } = await supabase.from("competitors").delete().eq("id", competitorId).eq("workspace_id", workspaceId);
  if (dbError) return errorResponse("DATABASE_ERROR", "Could not delete competitor.");
  return Response.json({ data: { id: competitorId, deleted: true } });
}
