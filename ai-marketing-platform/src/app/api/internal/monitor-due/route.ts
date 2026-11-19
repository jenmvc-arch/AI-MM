import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { inspectCompetitor, observationHash, searchCompetitor } from "@/lib/intelligence/providers";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ code: "UNAUTHORIZED", message: "Not authorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ code: "SERVER_CONFIGURATION", message: "Scheduled monitoring database access is not configured." }, { status: 503 });
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date().toISOString();
  const { data: schedules, error } = await supabase.from("monitoring_schedules").select("id, organization_id, workspace_id, competitor_id, interval_hours, created_by, competitors(id, name, website_url, positioning, offers)").eq("enabled", true).lte("next_run_at", now).order("next_run_at").limit(20);
  if (error) return Response.json({ code: "DATABASE_ERROR", message: "Could not load due monitoring schedules." }, { status: 500 });
  let completed = 0;
  let failed = 0;
  for (const schedule of schedules ?? []) {
    const competitor = Array.isArray(schedule.competitors) ? schedule.competitors[0] : schedule.competitors;
    if (!competitor || !schedule.organization_id) continue;
    try {
      const { query, results } = await searchCompetitor(competitor.name, competitor.website_url, competitor.positioning, competitor.offers);
      const { observation, sourceUrl } = await inspectCompetitor(competitor.name, query, results);
      const { data: previous } = await supabase.from("competitor_snapshots").select("id, content_hash, positioning, offers, pricing, messaging").eq("competitor_id", competitor.id).order("observed_at", { ascending: false }).limit(1).maybeSingle();
      const hash = createHash("sha256").update(observationHash(observation)).digest("hex");
      const changed = previous && previous.content_hash !== hash;
      const changeSummary = changed ? "A public marketing observation changed since the previous refresh." : null;
      const { data: snapshot, error: saveError } = await supabase.from("competitor_snapshots").insert({ ...observation, organization_id: schedule.organization_id, workspace_id: schedule.workspace_id, competitor_id: competitor.id, source_url: sourceUrl, source_type: "tavily_search", content_hash: hash, change_summary: changeSummary }).select("id").single();
      if (saveError || !snapshot) throw new Error("Snapshot save failed");
      for (const source of results) {
        const { error: contentError } = await supabase.from("competitor_content").insert({ organization_id: schedule.organization_id, workspace_id: schedule.workspace_id, competitor_id: competitor.id, snapshot_id: snapshot.id, source_url: source.url, content_type: "website", title: source.title, body: source.content, created_by: schedule.created_by });
        if (contentError) throw new Error("Source evidence save failed");
      }
      await supabase.from("monitoring_schedules").update({ last_run_at: now, last_status: "completed", last_error_code: null, next_run_at: new Date(Date.now() + schedule.interval_hours * 3600000).toISOString() }).eq("id", schedule.id);
      completed++;
    } catch {
      await supabase.from("monitoring_schedules").update({ last_run_at: now, last_status: "failed", last_error_code: "PROVIDER_OR_DATABASE_ERROR", next_run_at: new Date(Date.now() + Math.min(schedule.interval_hours, 24) * 3600000).toISOString() }).eq("id", schedule.id);
      failed++;
    }
  }
  return Response.json({ data: { processed: completed + failed, completed, failed } });
}
