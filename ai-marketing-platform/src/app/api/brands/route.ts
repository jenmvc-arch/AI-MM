import { brandSchema } from "@/lib/validation";
import { canAccessWorkspace, currentUser } from "@/lib/server-auth";
import { errorResponse } from "@/lib/api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId)
    return errorResponse("VALIDATION_ERROR", "workspaceId is required.");
  const access = await canAccessWorkspace(workspaceId, [
    "owner",
    "admin",
    "editor",
    "viewer",
  ]);
  if (!access.user)
    return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  if (access.error)
    return errorResponse("FORBIDDEN", "You cannot access this workspace.");
  const { data, error } = await access.supabase
    .from("brands")
    .select(
      "id, organization_id, workspace_id, name, website, description, tone, market_json, guidelines_json, created_at, updated_at",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error)
    return errorResponse(
      "DATABASE_ERROR",
      "Could not load brands.",
      error.message,
    );
  return Response.json({ data });
}

export async function POST(request: Request) {
  const { user } = await currentUser();
  if (!user) return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  const parsed = brandSchema.safeParse(await request.json().catch(() => null));
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
  const { data: workspace, error: wsError } = await access.supabase
    .from("workspaces")
    .select("organization_id")
    .eq("id", parsed.data.workspaceId)
    .single();
  if (wsError || !workspace)
    return errorResponse("NOT_FOUND", "Workspace not found.");
  const { data, error } = await access.supabase
    .from("brands")
    .insert({
      organization_id: workspace.organization_id,
      workspace_id: parsed.data.workspaceId,
      name: parsed.data.name,
      website: parsed.data.website || null,
      description: parsed.data.description || null,
      tone: parsed.data.tone || null,
      market_json: { market: parsed.data.market },
    })
    .select(
      "id, workspace_id, name, website, description, tone, market_json, created_at, updated_at",
    )
    .single();
  if (error)
    return errorResponse(
      "DATABASE_ERROR",
      "Could not save brand.",
      error.message,
    );
  return Response.json({ data }, { status: 201 });
}
