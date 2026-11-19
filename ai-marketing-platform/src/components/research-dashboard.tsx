"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PlusIcon, ReloadIcon } from "@radix-ui/react-icons";

type Project = {
  id: string;
  title: string;
  industry: string;
  product: string;
  geography: string;
  target_customers: string;
  objectives: string;
  created_at: string;
  research_jobs: { id: string; status: string; progress: string; error_code?: string | null; attempt_count?: number; error_message?: string | null; finished_at?: string | null }[];
};
type Source = { id: string; title: string; url: string; retrieved_at: string; evidence: string; provider: string };
type Finding = {
  id: string;
  category: string;
  claim: string;
  classification: "verified" | "inferred" | "hypothesis";
  confidence: number;
  evidence: string;
  market_finding_sources: { research_sources: Source }[];
};
type DetailJob = { id: string; status: string; progress: string; attempt_count: number; error_code?: string | null; error_message?: string | null; finished_at?: string | null };
type Detail = { project: Project; jobs: DetailJob[]; findings: Finding[] };

const categories: Record<string, string> = {
  market_trend: "Market trends",
  customer_pain: "Customer pain points",
  competitor_landscape: "Competitor landscape",
  pricing_positioning: "Pricing and positioning",
  swot: "SWOT analysis",
  opportunity: "Opportunities",
  risk: "Risks",
  recommended_action: "Recommended actions",
};

export function ResearchDashboard({ workspaceId, brands }: { workspaceId: string; brands: { id: string; name: string }[] }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ brandId: "", industry: "", product: "", geography: "", targetCustomers: "", objectives: "" });

  const loadProjects = useCallback(async () => {
    setError("");
    try {
      setLoading(true);
      const response = await fetch(`/api/research?workspaceId=${workspaceId}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Could not load research projects.");
      setProjects(result.data);
      if (!selectedId && result.data[0]) setSelectedId(result.data[0].id);
      if (selectedId && !result.data.some((project: Project) => project.id === selectedId)) setSelectedId("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load research projects.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, selectedId]);

  const loadDetail = useCallback(async () => {
    if (!selectedId) { setDetail(null); return; }
    try {
      const response = await fetch(`/api/research/${selectedId}?workspaceId=${workspaceId}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Could not load research project.");
      setDetail(result.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load research project.");
    }
  }, [selectedId, workspaceId]);

  useEffect(() => { queueMicrotask(() => { void loadProjects(); }); }, [loadProjects]);
  useEffect(() => { queueMicrotask(() => { void loadDetail(); }); }, [loadDetail]);

  async function createProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, brandId: form.brandId || undefined, workspaceId, idempotencyKey: crypto.randomUUID() }),
      });
      const result = await response.json();
      if (!response.ok && !result.data?.projectId) throw new Error(result.message ?? result.error?.message ?? "Research job could not be started.");
      setSelectedId(result.data.projectId);
      setShowForm(false);
      await loadProjects();
      await loadDetailFor(result.data.projectId);
      if (result.data.error) setError(result.data.error.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Research job could not be started.");
    } finally {
      setSaving(false);
    }
  }

  async function loadDetailFor(projectId: string) {
    const response = await fetch(`/api/research/${projectId}?workspaceId=${workspaceId}`, { cache: "no-store" });
    const result = await response.json();
    if (response.ok) setDetail(result.data);
  }

  async function retryResearch() {
    if (!detail) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/research/${detail.project.id}/run?workspaceId=${workspaceId}`, { method: "POST" });
      const result = await response.json();
      if (!response.ok && !result.data?.projectId) throw new Error(result.message ?? "Research retry failed.");
      await loadDetailFor(detail.project.id);
      await loadProjects();
      if (result.data.error) setError(result.data.error.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Research retry failed.");
    } finally {
      setSaving(false);
    }
  }

  const currentJob = detail?.jobs[0];

  return (
    <div className="research-layout">
      <aside className="research-list panel">
        <div className="panel-header">
          <div><span className="eyebrow">MARKET INTELLIGENCE</span><h2>Research projects</h2></div>
          <button className="icon-button" aria-label="Refresh research projects" title="Refresh" onClick={() => void loadProjects()}><ReloadIcon /></button>
        </div>
        <Button className="research-new" onClick={() => setShowForm((value) => !value)}><PlusIcon /> New research</Button>
        {loading ? <p className="research-muted">Loading research history...</p> : projects.length ? (
          <div className="project-items">{projects.map((project) => {
            const job = project.research_jobs?.[0];
            return <button key={project.id} className={`project-item ${selectedId === project.id ? "selected" : ""}`} onClick={() => setSelectedId(project.id)}>
              <strong>{project.title}</strong><span>{project.product}</span><small>{new Date(project.created_at).toLocaleDateString()} · {job?.status ?? "No job"}</small>
            </button>;
          })}</div>
        ) : <div className="research-empty">No research projects yet.</div>}
      </aside>

      <section className="research-main">
        {error && <p className="error" role="alert">{error}</p>}
        {showForm && <form className="panel research-form" onSubmit={createProject}>
          <div className="panel-header"><div><span className="eyebrow">NEW PROJECT</span><h2>Define your research brief</h2></div></div>
          {brands.length > 0 && <label>Brand<select value={form.brandId} onChange={(event) => setForm({ ...form, brandId: event.target.value })}><option value="">No brand selected</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>}
          <div className="research-form-grid">
            <label>Industry<input value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} maxLength={160} required /></label>
            <label>Product or service<textarea value={form.product} onChange={(event) => setForm({ ...form, product: event.target.value })} maxLength={2000} rows={2} required /></label>
            <label>Geographic market<input value={form.geography} onChange={(event) => setForm({ ...form, geography: event.target.value })} maxLength={160} required /></label>
            <label>Target customers<textarea value={form.targetCustomers} onChange={(event) => setForm({ ...form, targetCustomers: event.target.value })} maxLength={2000} rows={2} required /></label>
            <label className="research-objectives">Research objectives<textarea value={form.objectives} onChange={(event) => setForm({ ...form, objectives: event.target.value })} maxLength={2000} rows={3} placeholder="What market questions should this research answer?" required /></label>
          </div>
          <div className="form-actions"><Button type="submit" disabled={saving}>{saving ? "Running research..." : "Create and research"}</Button><Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Cancel</Button></div>
        </form>}

        {!showForm && detail ? <>
          <div className="research-detail-heading"><div><span className="eyebrow">{detail.project.industry} · {detail.project.geography}</span><h2>{detail.project.title}</h2><p>{detail.project.product}</p></div><div className="research-job-actions"><span className={`job-status ${currentJob?.status ?? "queued"}`}>{currentJob?.status ?? "queued"}</span>{currentJob?.status === "failed" && currentJob.attempt_count < 3 && <Button variant="secondary" disabled={saving} onClick={() => void retryResearch()}><ReloadIcon /> Retry research</Button>}</div></div>
          <div className="research-progress"><span>{currentJob?.progress ?? "Waiting to start"}</span><small>{currentJob?.finished_at ? `Updated ${new Date(currentJob.finished_at).toLocaleString()}` : "Job history is persistent"}</small></div>
          {currentJob?.error_message && <div className="error"><strong>{currentJob.error_code}</strong> {currentJob.error_message}</div>}
          <div className="research-context panel"><div><span className="eyebrow">TARGET CUSTOMERS</span><p>{detail.project.target_customers}</p></div><div><span className="eyebrow">OBJECTIVES</span><p>{detail.project.objectives}</p></div></div>
          {detail.findings.length ? <div className="finding-list">{detail.findings.map((finding) => <article className="finding panel" key={finding.id}>
            <div className="finding-heading"><span className="eyebrow">{categories[finding.category] ?? finding.category.replaceAll("_", " ")}</span><span className={`classification ${finding.classification}`}>{finding.classification}</span></div>
            <h3>{finding.claim}</h3><p>{finding.evidence}</p><small>Confidence {Math.round(finding.confidence * 100)}%</small>
            {finding.market_finding_sources.length > 0 && <div className="source-list"><strong>Evidence</strong>{finding.market_finding_sources.map(({ research_sources: source }) => <a href={source.url} key={source.id} target="_blank" rel="noreferrer">{source.title}<small>{source.provider} · Retrieved {new Date(source.retrieved_at).toLocaleString()}</small></a>)}</div>}
          </article>)}</div> : currentJob?.status !== "failed" && <div className="research-empty panel">Findings will appear here when the research job completes.</div>}
          {detail.jobs.length > 1 && <section className="panel job-history"><span className="eyebrow">JOB HISTORY</span>{detail.jobs.map((job) => <p key={job.id}>{job.status} · attempt {job.attempt_count} · {job.progress}</p>)}</section>}
        </> : !showForm && <div className="research-empty panel">Select a saved project or create a research brief to begin.</div>}
      </section>
    </div>
  );
}
