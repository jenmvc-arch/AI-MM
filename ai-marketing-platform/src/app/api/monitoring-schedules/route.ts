import { errorResponse } from "@/lib/api";
import { canAccessWorkspace, currentUser } from "@/lib/server-auth";
import { scheduleSchema } from "@/lib/intelligence/schema";

export async function GET(request: Request) {
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId) return errorResponse("VALIDATION_ERROR", "workspaceId is required.");
  const { supabase, error } = await canAccessWorkspace(workspaceId, ["owner", "admin", "editor", "viewer"]);
  if (error) return errorResponse("FORBIDDEN", "You cannot access this workspace.");
  const { data, error: dbError } = await supabase.from("monitoring_schedules").select("id, competitor_id, enabled, interval_hours, next_run_at, last_run_at, last_status, last_error_code, created_at, competitors(name, website_url)").eq("workspace_id", workspaceId).order("next_run_at");
  if (dbError) return errorResponse("DATABASE_ERROR", "Could not load monitoring schedules.");
  return Response.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const { user } = await currentUser();
  if (!user) return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  const parsed = scheduleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Monitoring schedule is invalid.", parsed.error.flatten());
  const input = parsed.data;
  const { supabase, error } = await canAccessWorkspace(input.workspaceId, ["owner", "admin", "editor"]);
  if (error) return errorResponse("FORBIDDEN", "Editor access is required.");
  const { data, error: dbError } = await supabase.from("monitoring_schedules").upsert({ organization_id: (await supabase.from("workspaces").select("organization_id").eq("id", input.workspaceId).single()).data?.organization_id, workspace_id: input.workspaceId, competitor_id: input.competitorId, enabled: input.enabled, interval_hours: input.intervalHours, next_run_at: new Date(Date.now() + input.intervalHours * 60 * 60 * 1000).toISOString(), created_by: user.id }, { onConflict: "competitor_id" }).select("id, competitor_id, enabled, interval_hours, next_run_at, created_at").single();
  if (dbError || !data) return errorResponse("DATABASE_ERROR", "Could not save monitoring schedule.");
  return Response.json({ data }, { status: 201 });
}
