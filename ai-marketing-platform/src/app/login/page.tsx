import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AuthForm } from "@/components/auth-form";

export const instant = false;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; mode?: string }> }) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (user) redirect("/app");
  const params = await searchParams;
  return <main className="auth-shell"><section className="auth-card"><Link className="auth-brand" href="/">Northstar <span>Marketing intelligence</span></Link><span className="eyebrow">YOUR WORKSPACE STARTS HERE</span><h1>Research with context.<br />Create with confidence.</h1><p>Sign in to your organization’s private marketing workspace.</p><AuthForm initialMode={params.mode === "signup" ? "signup" : "signin"} error={params.error} /></section><div className="auth-aside"><div className="auth-aside-inner"><span className="eyebrow">BUILT FOR CLEARER DECISIONS</span><h2>Make every marketing move traceable.</h2><p>Keep your brand context, team roles, and work in one protected space.</p><div className="auth-proof"><span>01</span><div><strong>Evidence stays visible</strong><small>Sources belong next to the decisions they inform.</small></div></div><div className="auth-proof"><span>02</span><div><strong>Your workspace stays yours</strong><small>Access rules are enforced in PostgreSQL, not just in the interface.</small></div></div></div></div></main>;
}
