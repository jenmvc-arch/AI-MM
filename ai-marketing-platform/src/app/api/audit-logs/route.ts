import { errorResponse } from "@/lib/api";
import { canAccessWorkspace } from "@/lib/server-auth";

export async function GET(request: Request) {
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId) return errorResponse("VALIDATION_ERROR", "workspaceId is required.");
  const access = await canAccessWorkspace(workspaceId, ["owner", "admin", "editor", "viewer"]);
  if (!access.user) return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  if (access.error) return errorResponse("FORBIDDEN", "You cannot access this workspace.");
  const { data, error } = await access.supabase.from("audit_logs").select("id, actor_user_id, action, entity_type, entity_id, metadata_json, created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(100);
  if (error) return errorResponse("DATABASE_ERROR", "Could not load audit history.");
  return Response.json({ data: data ?? [] });
}
