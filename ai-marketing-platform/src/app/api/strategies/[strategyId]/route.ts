import { errorResponse } from "@/lib/api";
import { canAccessWorkspace, currentUser } from "@/lib/server-auth";
import { strategyUpdateSchema } from "@/lib/intelligence/schema";

type Context = { params: Promise<{ strategyId: string }> };

export async function PATCH(request: Request, context: Context) {
  const { strategyId } = await context.params;
  const { user } = await currentUser();
  if (!user) return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  const parsed = strategyUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Strategy update is invalid.", parsed.error.flatten());
  const input = parsed.data;
  const { supabase, error } = await canAccessWorkspace(input.workspaceId, ["owner", "admin", "editor"]);
  if (error) return errorResponse("FORBIDDEN", "Editor access is required.");
  const { data: current } = await supabase.from("marketing_strategies").select("id, organization_id, version, title").eq("id", strategyId).eq("workspace_id", input.workspaceId).maybeSingle();
  if (!current) return errorResponse("NOT_FOUND", "Strategy not found in this workspace.");
  const nextVersion = current.version + 1;
  const { data, error: updateError } = await supabase.from("marketing_strategies").update({ title: input.title ?? current.title, version: nextVersion, strategy_json: input.strategy, status: input.status, updated_by: user.id }).eq("id", strategyId).eq("workspace_id", input.workspaceId).eq("version", current.version).select("id, brand_id, title, version, strategy_json, status, model, updated_at").maybeSingle();
  if (updateError || !data) return errorResponse("CONCURRENT_UPDATE", "Strategy changed while you were editing. Reload and apply your changes again.", undefined, 409);
  return Response.json({ data });
}

export async function DELETE(request: Request, context: Context) {
  const { strategyId } = await context.params;
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId) return errorResponse("VALIDATION_ERROR", "workspaceId is required.");
  const { supabase, error } = await canAccessWorkspace(workspaceId, ["owner", "admin"]);
  if (error) return errorResponse("FORBIDDEN", "Owner or admin access is required.");
  const { error: dbError } = await supabase.from("marketing_strategies").delete().eq("id", strategyId).eq("workspace_id", workspaceId);
  if (dbError) return errorResponse("DATABASE_ERROR", "Could not delete strategy.");
  return Response.json({ data: { id: strategyId, deleted: true } });
}
