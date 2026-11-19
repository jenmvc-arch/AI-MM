import { errorResponse } from "@/lib/api";
import { canAccessWorkspace } from "@/lib/server-auth";

type Context = { params: Promise<{ scheduleId: string }> };

export async function PATCH(request: Request, context: Context) {
  const { scheduleId } = await context.params;
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId) return errorResponse("VALIDATION_ERROR", "workspaceId is required.");
  const body = await request.json().catch(() => null) as { enabled?: unknown } | null;
  if (!body || typeof body.enabled !== "boolean") return errorResponse("VALIDATION_ERROR", "enabled must be boolean.");
  const { supabase, error } = await canAccessWorkspace(workspaceId, ["owner", "admin", "editor"]);
  if (error) return errorResponse("FORBIDDEN", "Editor access is required.");
  const { data, error: dbError } = await supabase.from("monitoring_schedules").update({ enabled: body.enabled, updated_at: new Date().toISOString() }).eq("id", scheduleId).eq("workspace_id", workspaceId).select("id, enabled, interval_hours, next_run_at").maybeSingle();
  if (dbError || !data) return errorResponse("NOT_FOUND", "Monitoring schedule not found.");
  return Response.json({ data });
}

export async function DELETE(request: Request, context: Context) {
  const { scheduleId } = await context.params;
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId) return errorResponse("VALIDATION_ERROR", "workspaceId is required.");
  const { supabase, error } = await canAccessWorkspace(workspaceId, ["owner", "admin"]);
  if (error) return errorResponse("FORBIDDEN", "Owner or admin access is required.");
  const { error: dbError } = await supabase.from("monitoring_schedules").delete().eq("id", scheduleId).eq("workspace_id", workspaceId);
  if (dbError) return errorResponse("DATABASE_ERROR", "Could not delete monitoring schedule.");
  return Response.json({ data: { id: scheduleId, deleted: true } });
}
