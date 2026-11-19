export default function SetupPage() {
  return <main className="auth-shell"><section className="auth-card"><span className="eyebrow">SYSTEM FOUNDATION</span><h1>Connect your Supabase project</h1><p>Authentication and protected workspace data are disabled until the public Supabase URL and anon key are configured.</p><pre>NEXT_PUBLIC_SUPABASE_URL=...{"\n"}NEXT_PUBLIC_SUPABASE_ANON_KEY=...</pre><p>Keep database service-role keys out of the browser. Apply the SQL migration in <code>supabase/migrations</code> before signing in.</p></section></main>;
}
