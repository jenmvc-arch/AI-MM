import { createHash } from "node:crypto";
import { errorResponse } from "@/lib/api";
import { canAccessWorkspace, currentUser } from "@/lib/server-auth";
import { inspectCompetitor, observationHash, searchCompetitor } from "@/lib/intelligence/providers";

type Context = { params: Promise<{ competitorId: string }> };

export async function POST(request: Request, context: Context) {
  const { competitorId } = await context.params;
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId) return errorResponse("VALIDATION_ERROR", "workspaceId is required.");
  const { user } = await currentUser();
  if (!user) return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  const { supabase, error } = await canAccessWorkspace(workspaceId, ["owner", "admin", "editor"]);
  if (error) return errorResponse("FORBIDDEN", "Editor access is required.");
  const { data: competitor } = await supabase.from("competitors").select("id, organization_id, workspace_id, name, website_url, positioning, offers").eq("id", competitorId).eq("workspace_id", workspaceId).maybeSingle();
  if (!competitor) return errorResponse("NOT_FOUND", "Competitor not found in this workspace.");
  try {
    const { query, results } = await searchCompetitor(competitor.name, competitor.website_url, competitor.positioning, competitor.offers);
    const { observation, sourceUrl, model } = await inspectCompetitor(competitor.name, query, results);
    const snapshotObservation = {
      positioning: observation.positioning,
      offers: observation.offers,
      pricing: observation.pricing,
      messaging: observation.messaging,
      channels: observation.channels,
      evidence: observation.evidence,
    };
    const { data: previous } = await supabase.from("competitor_snapshots").select("id, content_hash, positioning, offers, pricing, messaging").eq("competitor_id", competitorId).order("observed_at", { ascending: false }).limit(1).maybeSingle();
    const hash = createHash("sha256").update(observationHash(snapshotObservation)).digest("hex");
    const changed = previous && previous.content_hash !== hash;
    const changeSummary = changed ? ["positioning", "offers", "pricing", "messaging"].filter((key) => previous[key as keyof typeof previous] !== snapshotObservation[key as keyof typeof snapshotObservation]).join(", ") + " changed from the previous observed snapshot." : null;
    const { data: snapshot, error: saveError } = await supabase.from("competitor_snapshots").insert({ ...snapshotObservation, organization_id: competitor.organization_id, workspace_id: workspaceId, competitor_id: competitorId, source_url: sourceUrl, source_type: "tavily_search", content_hash: hash, change_summary: changeSummary, created_by: user.id }).select("id, source_url, source_type, observed_at, positioning, offers, pricing, messaging, channels, evidence, content_hash, change_summary").single();
    if (saveError || !snapshot) return errorResponse("DATABASE_ERROR", "Could not save competitor observation.");
    for (const source of results) {
      const { error: contentError } = await supabase.from("competitor_content").insert({ organization_id: competitor.organization_id, workspace_id: workspaceId, competitor_id: competitorId, snapshot_id: snapshot.id, source_url: source.url, content_type: "website", title: source.title, body: source.content, created_by: user.id });
      if (contentError) return errorResponse("DATABASE_ERROR", "Snapshot saved, but public source content could not be persisted.");
    }
    return Response.json({ data: { snapshot, sources: results.map(({ title, url }) => ({ title, url })), model } }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error && cause.message === "TAVILY_NOT_CONFIGURED" ? "Tavily is not configured on the server." : "Could not retrieve or analyze permitted public competitor sources.";
    return errorResponse("PROVIDER_ERROR", message, undefined, 502);
  }
}
