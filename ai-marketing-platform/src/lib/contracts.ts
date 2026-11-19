export type Role = "owner" | "admin" | "editor" | "viewer";
export type FindingClassification = "verified" | "inferred" | "hypothesis";
export type JobStatus = "queued" | "running" | "completed" | "failed";

export type Workspace = { id: string; organizationId: string; name: string; currency: string; timezone: string };
export type Brand = { id: string; workspaceId: string; name: string; website: string; description: string; tone: string; market: string; products: Product[] };
export type Product = { id: string; name: string; description: string; price?: number; currency: string };
export type Source = { id: string; title: string; url: string; retrievedAt: string; sourceType: "manual_url" | "demo_source" };
export type ResearchFinding = { id: string; claim: string; classification: FindingClassification; confidence: number; sources: Source[] };
export type ResearchProject = { id: string; question: string; geography: string; status: JobStatus; findings: ResearchFinding[]; createdAt: string };
export type Competitor = { id: string; name: string; website: string; notes: string; observations: { category: string; value: string; source: Source }[] };
export type CopyVersion = { id: string; version: number; body: string; createdAt: string };
export type CopyArtifact = { id: string; platform: string; goal: string; audience: string; variants: string[]; versions: CopyVersion[]; createdAt: string };
export type ContentItem = { id: string; title: string; platform: string; format: string; date: string; status: "idea" | "draft" | "in_review" | "approved" | "published"; body: string };
export type CampaignPlan = { id: string; name: string; platform: string; objective: string; budget: number; audience: string; hypothesis: string; status: "draft" | "in_review" };

export type AppState = { workspace: Workspace; role: Role; brand: Brand; research: ResearchProject[]; competitors: Competitor[]; copy: CopyArtifact[]; content: ContentItem[]; campaigns: CampaignPlan[]; lastUpdated: string };
