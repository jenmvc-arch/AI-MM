import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/onboarding-form";

export const instant = false;

export default async function OnboardingPage() {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login");
  const { data: workspaces } = await supabase.from("workspaces").select("id").limit(1); if (workspaces?.length) redirect("/app");
  return <main className="auth-shell single"><section className="auth-card"><a className="auth-brand" href="/app">Northstar <span>Marketing intelligence</span></a><span className="eyebrow">FIRST WORKSPACE</span><h1>Bring your team’s work together.</h1><p>Create an organization, a workspace, and its first brand profile.</p><OnboardingForm /></section></main>;
}
