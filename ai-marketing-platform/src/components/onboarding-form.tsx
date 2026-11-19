"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function OnboardingForm() {
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("MYR");
  const [timezone, setTimezone] = useState("Asia/Kuala_Lumpur");
  const [brand, setBrand] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          defaultCurrency: currency,
          timezone,
          brandName: brand,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message ?? "Could not create workspace.");
      router.replace("/app");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create workspace.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="auth-form" onSubmit={submit}>
      <label>
        Organization and workspace name
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!brand) setBrand(`${e.target.value} brand`);
          }}
          minLength={2}
          maxLength={80}
          required
        />
      </label>
      <label>
        First brand name
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          minLength={2}
          maxLength={120}
          required
        />
      </label>
      <div className="form-row">
        <label>
          Default currency
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option>MYR</option>
            <option>USD</option>
            <option>SGD</option>
            <option>GBP</option>
            <option>EUR</option>
          </select>
        </label>
        <label>
          Timezone
          <input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            required
          />
        </label>
      </div>
      {error && (
        <p className="form-message" role="alert">
          {error}
        </p>
      )}
      <Button className="auth-submit" disabled={busy} type="submit">
        {busy ? "Creating workspace…" : "Create workspace"}
      </Button>
    </form>
  );
}
