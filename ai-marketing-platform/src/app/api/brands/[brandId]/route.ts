import { z } from "zod";
import { currentUser, canAccessWorkspace } from "@/lib/server-auth";
import { errorResponse } from "@/lib/api";

const patchSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  website: z.string().trim().url().or(z.literal("")),
  description: z.string().trim().max(2000),
  tone: z.string().trim().max(500),
  market: z.string().trim().max(500),
});

type RouteParams = { params: Promise<{ brandId: string }> };

export async function PATCH(request: Request, context: RouteParams) {
  const { user } = await currentUser();
  if (!user) return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return errorResponse(
      "VALIDATION_ERROR",
      "Brand details are invalid.",
      parsed.error.flatten(),
    );
  const access = await canAccessWorkspace(parsed.data.workspaceId, [
    "owner",
    "admin",
    "editor",
  ]);
  if (!access.user)
    return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  if (access.error)
    return errorResponse(
      "FORBIDDEN",
      "You cannot edit brands in this workspace.",
    );
  const { brandId } = await context.params;
  const { data, error } = await access.supabase
    .from("brands")
    .update({
      name: parsed.data.name,
      website: parsed.data.website || null,
      description: parsed.data.description || null,
      tone: parsed.data.tone || null,
      market_json: { market: parsed.data.market },
    })
    .eq("id", brandId)
    .eq("workspace_id", parsed.data.workspaceId)
    .select(
      "id, workspace_id, name, website, description, tone, market_json, updated_at",
    )
    .maybeSingle();
  if (error)
    return errorResponse(
      "DATABASE_ERROR",
      "Could not update brand.",
      error.message,
    );
  if (!data) return errorResponse("NOT_FOUND", "Brand not found.");
  return Response.json({ data });
}

export async function DELETE(_request: Request, context: RouteParams) {
  const { brandId } = await context.params;
  const { supabase, user } = await currentUser();
  if (!user) return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  const { data: brand, error: readError } = await supabase
    .from("brands")
    .select("workspace_id")
    .eq("id", brandId)
    .maybeSingle();
  if (readError || !brand)
    return errorResponse("NOT_FOUND", "Brand not found.");
  const access = await canAccessWorkspace(brand.workspace_id, [
    "owner",
    "admin",
  ]);
  if (!access.user)
    return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  if (access.error)
    return errorResponse(
      "FORBIDDEN",
      "Only workspace owners and admins can delete brands.",
    );
  const { error } = await access.supabase
    .from("brands")
    .delete()
    .eq("id", brandId)
    .eq("workspace_id", brand.workspace_id);
  if (error)
    return errorResponse(
      "DATABASE_ERROR",
      "Could not delete brand.",
      error.message,
    );
  return new Response(null, { status: 204 });
}
