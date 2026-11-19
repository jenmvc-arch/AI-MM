"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function AuthForm({
  initialMode,
  error,
}: {
  initialMode: "signin" | "signup";
  error?: string;
}) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(error ?? "");
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const result =
        mode === "signup"
          ? await supabase.auth.signUp({
              email,
              password,
              options: {
                emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
              },
            })
          : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (mode === "signup" && !result.data.session) {
        setMessage("Check your email to confirm your account, then sign in.");
        return;
      }
      router.push(mode === "signup" ? "/onboarding" : "/app");
      router.refresh();
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Could not authenticate. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        Email address
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={8}
          required
        />
      </label>
      {message && (
        <p className="form-message" role="alert">
          {message}
        </p>
      )}
      <Button className="auth-submit" disabled={busy} type="submit">
        {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
      </Button>
      <p className="auth-switch">
        {mode === "signup" ? "Already have an account?" : "New to Northstar?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setMessage("");
          }}
        >
          {mode === "signup" ? "Sign in" : "Create an account"}
        </button>
      </p>
    </form>
  );
}
