export type Role = "owner" | "admin" | "editor" | "viewer";
export type Workspace = { id: string; organization_id: string; name: string; default_currency: string; timezone: string };
export type Brand = { id: string; workspace_id: string; name: string; website: string | null; description: string | null; tone: string | null; market_json: Record<string, unknown> };
export type Member = { organization_id: string; user_id: string; role: Role; status: string };
