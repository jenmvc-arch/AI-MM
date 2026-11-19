import { errorResponse } from "@/lib/api";
import { canAccessWorkspace } from "@/lib/server-auth";

export async function GET(request: Request) {
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId) return errorResponse("VALIDATION_ERROR", "workspaceId is required.");
  const { supabase, error } = await canAccessWorkspace(workspaceId, ["owner", "admin", "editor", "viewer"]);
  if (error) return errorResponse("FORBIDDEN", "You cannot access this workspace.");
  const [projects, competitors, analyses, strategies, schedules] = await Promise.all([
    supabase.from("research_projects").select("id, title, created_at, research_jobs(id, status, attempt_count, progress, error_code, finished_at)").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("competitor_snapshots").select("id, competitor_id, source_url, source_type, observed_at, change_summary, competitors(name)").eq("workspace_id", workspaceId).order("observed_at", { ascending: false }).limit(100),
    supabase.from("copy_analyses").select("id, brand_id, source_url, model, created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(100),
    supabase.from("marketing_strategies").select("id, title, version, status, updated_at, marketing_strategy_versions(id, version, created_at)").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }),
    supabase.from("monitoring_schedules").select("id, competitor_id, enabled, interval_hours, next_run_at, last_run_at, last_status, last_error_code, competitors(name)").eq("workspace_id", workspaceId).order("next_run_at"),
  ]);
  if (projects.error || competitors.error || analyses.error || strategies.error || schedules.error) return errorResponse("DATABASE_ERROR", "Could not load intelligence history. Confirm Phase 2 migrations are applied.");
  return Response.json({ data: { projects: projects.data ?? [], competitorSnapshots: competitors.data ?? [], copyAnalyses: analyses.data ?? [], strategies: strategies.data ?? [], monitoringSchedules: schedules.data ?? [] } });
}
