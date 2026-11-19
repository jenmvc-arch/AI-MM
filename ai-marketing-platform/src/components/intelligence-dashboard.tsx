"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CopyIcon, DownloadIcon, PlusIcon, ReloadIcon, TrashIcon } from "@radix-ui/react-icons";

type Brand = { id: string; name: string };
type Snapshot = { id: string; source_url: string | null; source_type: string; observed_at: string; positioning: string; offers: string; pricing: string; messaging: string; channels: string[]; evidence: string; change_summary: string | null };
type Content = { id: string; source_url: string; content_type: string; title: string; body: string; observed_at: string };
type Competitor = { id: string; brand_id: string; name: string; website_url: string | null; social_profiles: Record<string, string>; positioning: string; offers: string; competitor_snapshots: Snapshot[]; competitor_content: Content[] };
type CopyAnalysis = { id: string; brand_id: string | null; source_url: string | null; input_copy: string; analysis_json: Record<string, unknown>; model: string; created_at: string };
type Strategy = { id: string; brand_id: string; title: string; version: number; strategy_json: Record<string, unknown>; status: "draft" | "active" | "archived"; model: string; updated_at: string; marketing_strategy_versions?: { id: string; version: number; created_at: string }[] };
type Schedule = { id: string; competitor_id: string; enabled: boolean; interval_hours: number; next_run_at: string; last_run_at: string | null; last_status: string | null; last_error_code: string | null; competitors: { name: string } | null };
type History = { projects: unknown[]; competitorSnapshots: unknown[]; copyAnalyses: unknown[]; strategies: unknown[]; monitoringSchedules: unknown[] };

const emptyCompetitor = { brandId: "", name: "", websiteUrl: "", socialProfiles: "", positioning: "", offers: "", sourceUrl: "", publicContent: "" };
const label = (value: unknown) => typeof value === "string" ? value : JSON.stringify(value, null, 2);

export function IntelligenceDashboard({ workspaceId, brands, canEdit, initialSection = "competitors" }: { workspaceId: string; brands: Brand[]; canEdit: boolean; initialSection?: string }) {
  const [section, setSection] = useState(initialSection);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [analyses, setAnalyses] = useState<CopyAnalysis[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [history, setHistory] = useState<History | null>(null);
  const [selectedBrand, setSelectedBrand] = useState(brands[0]?.id ?? "");
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([]);
  const [competitorForm, setCompetitorForm] = useState(emptyCompetitor);
  const [copyForm, setCopyForm] = useState({ brandId: brands[0]?.id ?? "", copy: "", sourceUrl: "", goal: "" });
  const [strategyForm, setStrategyForm] = useState({ brandId: brands[0]?.id ?? "", title: "90-day marketing strategy", objective: "", geography: "Malaysia" });
  const [editingStrategyId, setEditingStrategyId] = useState("");
  const [editingStrategyJson, setEditingStrategyJson] = useState("");
  const [selectedCopy, setSelectedCopy] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const urls = ["competitors", "copy-analyses", "strategies", "monitoring-schedules", "research-history"].map((path) => fetch(`/api/${path}?workspaceId=${workspaceId}`, { cache: "no-store" }));
      const responses = await Promise.all(urls);
      const results = await Promise.all(responses.map((response) => response.json()));
      const failed = responses.findIndex((response) => !response.ok);
      if (failed >= 0) throw new Error(results[failed].message ?? "Could not load workspace intelligence.");
      setCompetitors(results[0].data ?? []); setAnalyses(results[1].data ?? []); setStrategies(results[2].data ?? []); setSchedules(results[3].data ?? []); setHistory(results[4].data ?? null);
      if (!selectedBrand && brands[0]) setSelectedBrand(brands[0].id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load workspace intelligence."); }
    finally { setLoading(false); }
  }, [workspaceId, brands, selectedBrand]);

  useEffect(() => { queueMicrotask(() => void refresh()); }, [refresh]);

  async function request(path: string, method: string, body?: unknown) {
    const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message ?? "The request failed.");
    return result.data;
  }

  async function saveCompetitor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const socialProfiles = Object.fromEntries(competitorForm.socialProfiles.split(/\s+/).filter(Boolean).map((value) => { const [key, url] = value.split("="); return [key, url]; }));
      await request("/api/competitors", "POST", { ...competitorForm, workspaceId, socialProfiles });
      setCompetitorForm(emptyCompetitor); setNotice("Competitor and observation saved."); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save competitor."); }
    finally { setBusy(false); }
  }

  async function refreshCompetitor(id: string) {
    setBusy(true); setError("");
    try { await request(`/api/competitors/${id}/refresh?workspaceId=${workspaceId}`, "POST"); setNotice("Public competitor snapshot saved with source links."); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not refresh competitor."); }
    finally { setBusy(false); }
  }

  async function deleteCompetitor(competitor: Competitor) {
    if (!window.confirm(`Delete ${competitor.name} and its snapshot history?`)) return;
    try { await request(`/api/competitors/${competitor.id}?workspaceId=${workspaceId}`, "DELETE"); setNotice("Competitor deleted."); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete competitor."); }
  }

  async function analyzeCopy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { const data = await request("/api/copy-analyses", "POST", { ...copyForm, workspaceId }); setSelectedCopy(data.id); setNotice("Copy analysis saved."); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Copy analysis failed."); }
    finally { setBusy(false); }
  }

  async function makeStrategy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { await request("/api/strategies", "POST", { ...strategyForm, workspaceId }); setNotice("Strategy generated and saved as version 1."); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not generate strategy."); }
    finally { setBusy(false); }
  }

  async function saveEditedStrategy() {
    if (!editingStrategyId) return;
    setBusy(true); setError("");
    try { const strategy = strategies.find((item) => item.id === editingStrategyId); if (!strategy) return; await request(`/api/strategies/${strategy.id}`, "PATCH", { workspaceId, title: strategy.title, status: strategy.status, strategy: JSON.parse(editingStrategyJson) }); setNotice("Strategy saved as a new version."); setEditingStrategyId(""); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save strategy."); }
    finally { setBusy(false); }
  }

  async function addSchedule(competitorId: string) {
    try { await request("/api/monitoring-schedules", "POST", { workspaceId, competitorId, intervalHours: 168, enabled: true }); setNotice("Weekly refresh schedule saved."); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save schedule."); }
  }

  async function toggleSchedule(schedule: Schedule) {
    try { await request(`/api/monitoring-schedules/${schedule.id}?workspaceId=${workspaceId}`, "PATCH", { enabled: !schedule.enabled }); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update schedule."); }
  }

  async function removeSchedule(schedule: Schedule) {
    try { await request(`/api/monitoring-schedules/${schedule.id}?workspaceId=${workspaceId}`, "DELETE"); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not delete schedule."); }
  }

  const selectedCompetitorRows = useMemo(() => competitors.filter((item) => selectedCompetitors.includes(item.id)), [competitors, selectedCompetitors]);
  const copy = analyses.find((item) => item.id === selectedCopy) ?? analyses[0];
  const strategyValue = (item: Strategy) => editingStrategyId === item.id ? JSON.parse(editingStrategyJson || "{}") as Record<string, unknown> : item.strategy_json;
  const nav = [
    ["competitors", "Competitor directory"], ["compare", "Side-by-side comparison"], ["copy", "Copy analysis studio"], ["strategies", "Strategy generator"], ["history", "Research history"],
  ];

  return <div className="intelligence-workspace">
    <div className="intelligence-nav" role="tablist" aria-label="Marketing intelligence">
      {nav.map(([id, title]) => <button key={id} role="tab" aria-selected={section === id} className={section === id ? "selected" : ""} onClick={() => setSection(id)}>{title}</button>)}
      <Button variant="secondary" onClick={() => void refresh()} disabled={loading}><ReloadIcon /> Refresh</Button>
    </div>
    {notice && <p className="notice" role="status">{notice}</p>}{error && <p className="error" role="alert">{error}</p>}
    {loading ? <div className="panel intelligence-empty">Loading workspace intelligence...</div> : null}

    {!loading && section === "competitors" && <div className="intelligence-grid">
      <section className="panel">
        <div className="panel-header"><div><span className="eyebrow">COMPETITORS</span><h2>Public market observations</h2></div><span className="role-tag">{competitors.length} saved</span></div>
        {canEdit && <form className="intelligence-form" onSubmit={saveCompetitor}>
          <label>Brand<select required value={competitorForm.brandId} onChange={(event) => setCompetitorForm({ ...competitorForm, brandId: event.target.value })}><option value="">Choose brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
          <label>Name<input required minLength={2} maxLength={160} value={competitorForm.name} onChange={(event) => setCompetitorForm({ ...competitorForm, name: event.target.value })} /></label>
          <label>Website URL<input type="url" placeholder="https://example.com" value={competitorForm.websiteUrl} onChange={(event) => setCompetitorForm({ ...competitorForm, websiteUrl: event.target.value })} /></label>
          <label>Social profile URLs<input placeholder="instagram=https://... linkedin=https://..." value={competitorForm.socialProfiles} onChange={(event) => setCompetitorForm({ ...competitorForm, socialProfiles: event.target.value })} /></label>
          <label>Positioning notes<textarea maxLength={2000} value={competitorForm.positioning} onChange={(event) => setCompetitorForm({ ...competitorForm, positioning: event.target.value })} /></label>
          <label>Offers observed<textarea maxLength={2000} value={competitorForm.offers} onChange={(event) => setCompetitorForm({ ...competitorForm, offers: event.target.value })} /></label>
          <label>Permitted public content<textarea minLength={10} maxLength={20000} value={competitorForm.publicContent} onChange={(event) => setCompetitorForm({ ...competitorForm, publicContent: event.target.value })} placeholder="Optional. Only use content you may analyze." /></label>
          <label>Content source URL<input type="url" value={competitorForm.sourceUrl} onChange={(event) => setCompetitorForm({ ...competitorForm, sourceUrl: event.target.value })} /></label>
          <Button type="submit" disabled={busy || !brands.length}><PlusIcon /> Save competitor</Button>
        </form>}
        {!competitors.length ? <div className="intelligence-empty">No competitors saved for this workspace.</div> : <div className="intelligence-list">{competitors.map((item) => { const latest = [...item.competitor_snapshots].sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0]; return <article className="intel-row" key={item.id}>
          <label className="compare-toggle"><input type="checkbox" checked={selectedCompetitors.includes(item.id)} onChange={(event) => setSelectedCompetitors((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} aria-label={`Compare ${item.name}`} /></label>
          <div className="intel-row-body"><h3>{item.name}</h3><p>{item.website_url ?? "Website not provided"}</p><small>{latest ? `Observed ${new Date(latest.observed_at).toLocaleString()}` : "No snapshot yet"}</small>{latest?.change_summary && <p className="change-note">{latest.change_summary}</p>}{latest?.source_url && <a href={latest.source_url} target="_blank" rel="noreferrer">Latest source</a>}</div>
          <div className="intel-row-actions">{canEdit && <><Button variant="secondary" disabled={busy || !item.website_url} onClick={() => void refreshCompetitor(item.id)}><ReloadIcon /> Refresh public sources</Button>{schedules.some((schedule) => schedule.competitor_id === item.id) ? <span className="job-status completed">Monitoring scheduled</span> : <Button variant="secondary" onClick={() => void addSchedule(item.id)}>Schedule weekly refresh</Button>}</>}{canEdit && <Button variant="secondary" onClick={() => void deleteCompetitor(item)}><TrashIcon /> Delete</Button>}</div>
        </article>; })}</div>}
      </section>
      <aside className="panel"><span className="eyebrow">OBSERVATION SCOPE</span><h2>Evidence boundaries</h2><p>Refresh uses Tavily’s search API and only stores returned public result excerpts. Each snapshot includes source URLs, retrieval time and a content hash. Search visibility is not proof of completeness.</p><div className="detail-row"><span>Conversion or ROAS estimates</span><strong>Not inferred</strong></div><div className="detail-row"><span>Automatic website crawling</span><strong>Not used</strong></div><div className="detail-row"><span>Manual source records</span><strong>{competitors.reduce((count, item) => count + item.competitor_content.length, 0)}</strong></div></aside>
    </div>}

    {!loading && section === "compare" && <section className="panel comparison-panel"><div className="panel-header"><div><span className="eyebrow">COMPARE</span><h2>Observable competitor messaging</h2></div><p>Select up to four competitors in the directory.</p></div>{selectedCompetitorRows.length < 2 ? <div className="intelligence-empty">Select at least two competitors from the directory.</div> : <div className="comparison-grid" style={{ gridTemplateColumns: `repeat(${Math.min(selectedCompetitorRows.length, 4)}, minmax(0, 1fr))` }}>{selectedCompetitorRows.slice(0, 4).map((item) => { const snapshot = [...item.competitor_snapshots].sort((a, b) => b.observed_at.localeCompare(a.observed_at))[0]; return <article className="comparison-column" key={item.id}><h3>{item.name}</h3><p>{item.website_url ?? "No website provided"}</p>{snapshot ? <><dl>{[["Positioning", snapshot.positioning], ["Offers", snapshot.offers], ["Public pricing", snapshot.pricing], ["Messaging", snapshot.messaging], ["Channels observed", snapshot.channels.join(", ") || "Not observed"]].map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value || "Not observed"}</dd></div>)}</dl><a href={snapshot.source_url ?? "#"} target="_blank" rel="noreferrer">Source and observation date</a><small>{new Date(snapshot.observed_at).toLocaleString()}</small></> : <div className="intelligence-empty">No saved snapshot. Add a public source or refresh search results.</div>}</article>; })}</div>}</section>}

    {!loading && section === "copy" && <div className="intelligence-grid copy-layout"><section className="panel"><span className="eyebrow">COPY ANALYSIS</span><h2>Analyze marketing copy</h2><form className="intelligence-form" onSubmit={analyzeCopy}>
      <label>Brand<select value={copyForm.brandId} onChange={(event) => setCopyForm({ ...copyForm, brandId: event.target.value })}><option value="">No brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
      <label>Goal<input maxLength={500} value={copyForm.goal} onChange={(event) => setCopyForm({ ...copyForm, goal: event.target.value })} placeholder="e.g. explain a new product" /></label>
      <label>Source URL<input type="url" value={copyForm.sourceUrl} onChange={(event) => setCopyForm({ ...copyForm, sourceUrl: event.target.value })} /></label>
      <label>Copy<textarea required minLength={10} maxLength={20000} rows={12} value={copyForm.copy} onChange={(event) => setCopyForm({ ...copyForm, copy: event.target.value })} /></label>
      <Button type="submit" disabled={busy || !canEdit}><CopyIcon /> Analyze and save</Button>
    </form></section><section className="panel"><div className="panel-header"><div><span className="eyebrow">SAVED ANALYSES</span><h2>Messaging structure</h2></div><select aria-label="Select copy analysis" value={copy?.id ?? ""} onChange={(event) => setSelectedCopy(event.target.value)}>{analyses.map((item) => <option key={item.id} value={item.id}>{new Date(item.created_at).toLocaleString()}</option>)}</select></div>{!copy ? <div className="intelligence-empty">No copy analyses saved.</div> : <><p className="evidence-note">Structure labels describe text patterns. They do not indicate performance or conversion.</p><div className="copy-analysis-result">{Object.entries(copy.analysis_json).map(([key, value]) => <article key={key}><span className="eyebrow">{key.replaceAll(/([A-Z])/g, " $1")}</span><p>{Array.isArray(value) ? value.map((entry) => typeof entry === "string" ? entry : JSON.stringify(entry)).join(" · ") : label(value)}</p></article>)}</div><details><summary>Analyzed input</summary><p className="preserved-copy">{copy.input_copy}</p></details><small>Saved {new Date(copy.created_at).toLocaleString()} · {copy.model}</small></>}</section></div>}

    {!loading && section === "strategies" && <div className="intelligence-grid strategy-layout"><section className="panel"><span className="eyebrow">STRATEGY GENERATOR</span><h2>Build an evidence-informed plan</h2><form className="intelligence-form" onSubmit={makeStrategy}>
      <label>Brand<select required value={strategyForm.brandId} onChange={(event) => setStrategyForm({ ...strategyForm, brandId: event.target.value })}><option value="">Choose brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
      <label>Title<input required minLength={2} maxLength={200} value={strategyForm.title} onChange={(event) => setStrategyForm({ ...strategyForm, title: event.target.value })} /></label>
      <label>Business objective<textarea required minLength={5} maxLength={2000} value={strategyForm.objective} onChange={(event) => setStrategyForm({ ...strategyForm, objective: event.target.value })} /></label>
      <label>Geographic market<input required minLength={2} maxLength={160} value={strategyForm.geography} onChange={(event) => setStrategyForm({ ...strategyForm, geography: event.target.value })} /></label>
      <Button type="submit" disabled={busy || !canEdit}><PlusIcon /> Generate and save</Button>
    </form></section><section className="panel"><div className="panel-header"><div><span className="eyebrow">SAVED STRATEGIES</span><h2>Versioned strategy documents</h2></div></div>{!strategies.length ? <div className="intelligence-empty">Generate a strategy from brand profile, research findings and saved competitor observations.</div> : <div className="strategy-list">{strategies.map((item) => <article className="strategy-item" key={item.id}><div className="panel-header"><div><h3>{item.title}</h3><small>Version {item.version} · {item.status} · {new Date(item.updated_at).toLocaleString()}</small></div><Button variant="secondary" onClick={() => { const data = new Blob([JSON.stringify(item.strategy_json, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(data); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${item.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`; anchor.click(); URL.revokeObjectURL(url); }}><DownloadIcon /> Export JSON</Button></div><div className="strategy-outline">{Object.entries(strategyValue(item)).map(([key, value]) => <details key={key}><summary>{key.replaceAll(/([A-Z])/g, " $1")}</summary><pre>{label(value)}</pre></details>)}</div>{canEdit && <div className="form-actions"><Button variant="secondary" onClick={() => { setEditingStrategyId(item.id); setEditingStrategyJson(JSON.stringify(item.strategy_json, null, 2)); }}>Edit JSON</Button>{item.marketing_strategy_versions?.length ? <small>{item.marketing_strategy_versions.length} saved versions</small> : null}</div>}{editingStrategyId === item.id && <div className="strategy-editor"><label>Edit strategy JSON<textarea aria-label="Edit strategy JSON" rows={20} value={editingStrategyJson} onChange={(event) => setEditingStrategyJson(event.target.value)} /></label><Button disabled={busy} onClick={() => void saveEditedStrategy()}>Save as version {item.version + 1}</Button><Button variant="secondary" onClick={() => setEditingStrategyId("")}>Cancel</Button></div>}</article>)}</div>}</section></div>}

    {!loading && section === "history" && <div className="history-grid"><section className="panel"><span className="eyebrow">RESEARCH HISTORY</span><h2>Research jobs</h2>{history?.projects.length ? <div className="history-list">{(history.projects as {id:string;title:string;created_at:string;research_jobs:{status:string;attempt_count:number;progress:string;error_code:string|null;finished_at:string|null}[]}[]).map((project) => <article key={project.id}><strong>{project.title}</strong><small>{new Date(project.created_at).toLocaleString()}</small>{project.research_jobs.map((job, index) => <span key={index} className={`job-status ${job.status}`}>{job.status} · attempt {job.attempt_count} · {job.progress}</span>)}</article>)}</div> : <div className="intelligence-empty">No research jobs saved.</div>}</section><section className="panel"><span className="eyebrow">COMPETITOR MONITORING</span><h2>Scheduled refreshes</h2>{schedules.length ? <div className="history-list">{schedules.map((schedule) => <article key={schedule.id}><strong>{schedule.competitors?.name ?? "Competitor"} · every {schedule.interval_hours} hours</strong><small>Next: {new Date(schedule.next_run_at).toLocaleString()}</small><small>Last run: {schedule.last_run_at ? new Date(schedule.last_run_at).toLocaleString() : "Not run"} · {schedule.last_status ?? "pending"}</small>{schedule.last_error_code && <small className="error">{schedule.last_error_code}</small>}<Button variant="secondary" onClick={() => void toggleSchedule(schedule)}>{schedule.enabled ? "Pause schedule" : "Enable schedule"}</Button><Button variant="secondary" onClick={() => void removeSchedule(schedule)}><TrashIcon /> Delete schedule</Button></article>)}</div> : <div className="intelligence-empty">Schedule a weekly refresh from a competitor in the directory.</div>}<p className="evidence-note">Automatic execution requires `CRON_SECRET`, server-side database credentials, and a deployment scheduler calling the protected monitoring endpoint.</p></section><section className="panel history-full"><span className="eyebrow">ACTIVITY</span><h2>Saved intelligence records</h2><div className="metrics-row"><div className="metric"><span className="eyebrow">COMPETITOR SNAPSHOTS</span><strong>{history?.competitorSnapshots.length ?? 0}</strong></div><div className="metric"><span className="eyebrow">COPY ANALYSES</span><strong>{history?.copyAnalyses.length ?? 0}</strong></div><div className="metric"><span className="eyebrow">STRATEGIES</span><strong>{history?.strategies.length ?? 0}</strong></div><div className="metric"><span className="eyebrow">MONITORING RULES</span><strong>{history?.monitoringSchedules.length ?? 0}</strong></div></div></section></div>}
  </div>;
}
