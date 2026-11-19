import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceDashboard } from "@/components/workspace-dashboard";

export const instant = false;

export default async function AppPage() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login");
  const { data: workspaces, error } = await supabase.from("workspaces").select("id, organization_id, name, default_currency, timezone").order("created_at", { ascending: true });
  if (error) throw new Error("Could not load workspaces. Check your database migration and connection.");
  if (!workspaces?.length) redirect("/onboarding");
  const workspace = workspaces[0]; const { data: membership } = await supabase.from("workspace_members").select("role").eq("workspace_id", workspace.id).eq("user_id", user.id).single();
  const { data: brands, error: brandError } = await supabase.from("brands").select("id, workspace_id, name, website, description, tone, market_json, updated_at, products(id, brand_id, name, description, price, currency)").eq("workspace_id", workspace.id).order("created_at");
  if (brandError) throw new Error("Could not load brand profiles. Check workspace policies.");
  return <WorkspaceDashboard user={{ email: user.email ?? "", id: user.id }} initialWorkspace={workspace} initialWorkspaces={workspaces} role={membership?.role ?? "viewer"} initialBrands={brands ?? []} />;
}
