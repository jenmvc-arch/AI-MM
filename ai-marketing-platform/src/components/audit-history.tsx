"use client";

import { useEffect, useState } from "react";

type AuditRow = { id: string; actor_user_id: string | null; action: string; entity_type: string; entity_id: string | null; metadata_json: Record<string, unknown>; created_at: string };

export function AuditHistory({ workspaceId }: { workspaceId: string }) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    queueMicrotask(() => {
      void fetch(`/api/audit-logs?workspaceId=${workspaceId}`, { cache: "no-store" })
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.message);
          setRows(result.data);
          setStatus("ready");
        })
        .catch(() => setStatus("error"));
    });
  }, [workspaceId]);

  return <section className="panel audit-panel"><span className="eyebrow">AUDIT HISTORY</span><h2>Recent workspace activity</h2>
    {status === "loading" ? <p>Loading activity...</p> : status === "error" ? <p className="error">Audit history could not be loaded.</p> : rows.length ? <div className="audit-list">{rows.map((row) => <article className="audit-row" key={row.id}><div><strong>{row.action.replaceAll("_", " ")}</strong><small>{row.entity_type}{row.actor_user_id ? ` · ${row.actor_user_id.slice(0, 8)}` : ""}</small></div><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString()}</time></article>)}</div> : <p>No recorded workspace activity yet.</p>}
  </section>;
}
