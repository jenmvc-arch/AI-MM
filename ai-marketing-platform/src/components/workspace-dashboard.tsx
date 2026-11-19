"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ResearchDashboard } from "@/components/research-dashboard";
import { IntelligenceDashboard } from "@/components/intelligence-dashboard";
import { AuditHistory } from "@/components/audit-history";
import {
  ArrowRightIcon,
  BoxIcon,
  GearIcon,
  GlobeIcon,
  BarChartIcon,
  HomeIcon,
  PlusIcon,
} from "@radix-ui/react-icons";

type Workspace = {
  id: string;
  organization_id: string;
  name: string;
  default_currency: string;
  timezone: string;
};
type Brand = {
  id: string;
  workspace_id: string;
  name: string;
  website: string | null;
  description: string | null;
  tone: string | null;
  market_json: Record<string, unknown>;
  updated_at?: string;
  products?: Product[];
};
type Product = { id: string; brand_id: string; name: string; description: string | null; price: number | null; currency: string | null };
type Props = {
  user: { id: string; email: string };
  initialWorkspace: Workspace;
  initialWorkspaces: Workspace[];
  role: string;
  initialBrands: Brand[];
};
const navigation = [
  { label: "Overview", icon: HomeIcon },
  { label: "Brands & products", icon: BoxIcon },
  { label: "Market research", icon: GlobeIcon },
  { label: "Competitors", icon: BarChartIcon },
  { label: "Copy analysis", icon: BoxIcon },
  { label: "Strategy generator", icon: HomeIcon },
  { label: "Research history", icon: GlobeIcon },
  { label: "Settings", icon: GearIcon },
];

export function WorkspaceDashboard({
  user,
  initialWorkspace,
  initialWorkspaces,
  role,
  initialBrands,
}: Props) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces);
  const [currentRole, setCurrentRole] = useState(role);
  const [brands, setBrands] = useState(initialBrands);
  const [productBrandId, setProductBrandId] = useState<string | null>(null);
  const [productEditingId, setProductEditingId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({ name: "", description: "", price: "", currency: "MYR" });
  const [section, setSection] = useState("Overview");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [showWorkspaceForm, setShowWorkspaceForm] = useState(false);
  const [workspaceForm, setWorkspaceForm] = useState({
    name: "",
    brandName: "",
  });
  const [settingsForm, setSettingsForm] = useState({
    name: initialWorkspace.name,
    defaultCurrency: initialWorkspace.default_currency,
    timezone: initialWorkspace.timezone,
  });
  const [form, setForm] = useState({
    name: "",
    website: "",
    description: "",
    tone: "",
    market: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const router = useRouter();
  const canEdit = ["owner", "admin", "editor"].includes(currentRole);
  async function switchWorkspace(workspaceId: string) {
    if (workspaceId === workspace.id) return;
    setError("");
    const response = await fetch(`/api/workspaces/${workspaceId}`, {
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? "Could not load workspace.");
      return;
    }
    setWorkspace(result.data.workspace);
    setBrands(result.data.brands);
    setCurrentRole(result.data.role);
    setSettingsForm({
      name: result.data.workspace.name,
      defaultCurrency: result.data.workspace.default_currency,
      timezone: result.data.workspace.timezone,
    });
    setSection("Overview");
    router.refresh();
  }
  async function createWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...workspaceForm,
        organizationId: workspace.organization_id,
        defaultCurrency: workspace.default_currency,
        timezone: workspace.timezone,
      }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(result.message ?? "Could not create workspace.");
      return;
    }
    setWorkspaces((current) => [...current, result.data]);
    setWorkspaceForm({ name: "", brandName: "" });
    setShowWorkspaceForm(false);
    await switchWorkspace(result.data.id);
    setNotice("Workspace created.");
  }
  async function saveWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch(`/api/workspaces/${workspace.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(settingsForm),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) {
      setError(result.message ?? "Could not update workspace.");
      return;
    }
    setWorkspace(result.data);
    setWorkspaces((items) =>
      items.map((item) => (item.id === result.data.id ? result.data : item)),
    );
    setNotice("Workspace settings saved.");
  }
  async function saveBrand(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/brands", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, workspaceId: workspace.id }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message ?? "Could not create brand.");
      setBrands((current) => [result.data, ...current]);
      setForm({ name: "", website: "", description: "", tone: "", market: "" });
      setShowForm(false);
      setNotice("Brand saved.");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save brand.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function updateBrand(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`/api/brands/${editing}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, workspaceId: workspace.id }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message ?? "Could not update brand.");
      setBrands((current) =>
        current.map((item) =>
          item.id === editing ? { ...item, ...result.data } : item,
        ),
      );
      setEditing(null);
      setForm({ name: "", website: "", description: "", tone: "", market: "" });
      setNotice("Brand updated.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not update brand.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function deleteBrand(brand: Brand) {
    if (!window.confirm(`Delete ${brand.name}?`)) return;
    setError("");
    const response = await fetch(`/api/brands/${brand.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const result = await response.json();
      setError(result.message ?? "Could not delete brand.");
      return;
    }
    setBrands((current) => current.filter((item) => item.id !== brand.id));
    setNotice("Brand deleted.");
  }
  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!productBrandId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(productEditingId ? `/api/products/${productEditingId}?workspaceId=${workspace.id}` : `/api/products?workspaceId=${workspace.id}`, {
        method: productEditingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brandId: productBrandId,
          name: productForm.name,
          description: productForm.description,
          price: productForm.price ? Number(productForm.price) : null,
          currency: productForm.price ? productForm.currency : null,
          attributes: {},
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Could not save product.");
      setBrands((current) => current.map((brand) => brand.id === productBrandId ? { ...brand, products: productEditingId ? (brand.products ?? []).map((product) => product.id === result.data.id ? result.data : product) : [...(brand.products ?? []), result.data] } : brand));
      setProductBrandId(null);
      setProductEditingId(null);
      setProductForm({ name: "", description: "", price: "", currency: "MYR" });
      setNotice("Product saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save product.");
    } finally { setBusy(false); }
  }
  async function deleteProduct(product: Product) {
    if (!window.confirm(`Delete ${product.name}?`)) return;
    const response = await fetch(`/api/products/${product.id}?workspaceId=${workspace.id}`, { method: "DELETE" });
    if (!response.ok) { const result = await response.json(); setError(result.message ?? "Could not delete product."); return; }
    setBrands((current) => current.map((brand) => brand.id === product.brand_id ? { ...brand, products: (brand.products ?? []).filter((item) => item.id !== product.id) } : brand));
    setNotice("Product deleted.");
  }
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand-lockup" href="/app">
          <div className="brand-mark">N</div>
          <div>
            <strong>northstar</strong>
            <span>marketing intelligence</span>
          </div>
        </a>
        <div className="workspace-switcher">
          <span className="eyebrow">WORKSPACE</span>
          <select
            aria-label="Choose workspace"
            value={workspace.id}
            onChange={(e) => switchWorkspace(e.target.value)}
          >
            {workspaces.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {["owner", "admin"].includes(currentRole) && (
            <button className="workspace-create" onClick={() => setShowWorkspaceForm((value) => !value)}>
              + New workspace
            </button>
          )}
          {showWorkspaceForm && (
            <form className="workspace-form" onSubmit={createWorkspace}>
              <label>Workspace name<input value={workspaceForm.name} onChange={(event) => setWorkspaceForm({ ...workspaceForm, name: event.target.value })} minLength={2} maxLength={120} required /></label>
              <label>First brand<input value={workspaceForm.brandName} onChange={(event) => setWorkspaceForm({ ...workspaceForm, brandName: event.target.value })} minLength={2} maxLength={120} required /></label>
              <Button type="submit" disabled={busy}>{busy ? "Creating..." : "Create workspace"}</Button>
            </form>
          )}
        </div>
        <nav>
          <span className="nav-label">Workspace</span>
          {navigation.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${section === label ? "active" : ""}`}
              onClick={() => setSection(label)}
            >
              <Icon />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="secure-note">
            <span />
            Protected by Supabase Auth + RLS
          </div>
          <button className="user-chip" onClick={signOut}>
            <span className="avatar">
              {user.email.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{user.email}</strong>
              <small>{currentRole} · Sign out</small>
            </span>
            <ArrowRightIcon />
          </button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>{workspace.name}</span>
            <span>/</span>
            <strong>{section}</strong>
          </div>
          <div className="top-actions">
            <span className="role-tag">{currentRole}</span>
            <span className="avatar avatar-sm">
              {user.email.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>
        <div className="content-area">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                PRIVATE WORKSPACE · {workspace.default_currency} ·{" "}
                {workspace.timezone}
              </span>
              <h1>
                {section === "Overview"
                  ? "Your marketing foundation."
                  : section}
              </h1>
              <p>
                {section === "Overview"
                  ? "Your workspace, product catalog, and brand context are ready."
                  : section === "Brands & products"
                    ? "Manage the profiles that inform your team’s marketing work."
                    : "Your organization, workspace, and membership details."}
              </p>
            </div>
            {section === "Brands & products" && canEdit && (
              <Button
                onClick={() => {
                  setShowForm(true);
                }}
              >
                <PlusIcon />
                Add brand
              </Button>
            )}
          </div>
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {section === "Market research" ? (
            <ResearchDashboard workspaceId={workspace.id} brands={brands.map(({ id, name }) => ({ id, name }))} />
          ) : ["Competitors", "Copy analysis", "Strategy generator", "Research history"].includes(section) ? (
            <IntelligenceDashboard key={section} workspaceId={workspace.id} brands={brands.map(({ id, name }) => ({ id, name }))} canEdit={canEdit} initialSection={{ Competitors: "competitors", "Copy analysis": "copy", "Strategy generator": "strategies", "Research history": "history" }[section]} />
          ) : section === "Settings" ? (
            <section className="settings-grid">
              <article className="panel">
                <span className="eyebrow">ORGANIZATION</span>
                <h2>{workspace.name}</h2>
                <p>
                  Organization and workspace created together during onboarding.
                </p>
                <div className="detail-row">
                  <span>Default currency</span>
                  <strong>{workspace.default_currency}</strong>
                </div>
                <div className="detail-row">
                  <span>Timezone</span>
                  <strong>{workspace.timezone}</strong>
                </div>
              </article>
              { ["owner", "admin"].includes(currentRole) && (
                <form className="panel workspace-settings" onSubmit={saveWorkspace}>
                  <span className="eyebrow">WORKSPACE SETTINGS</span>
                  <h2>Workspace details</h2>
                  <label>Name<input value={settingsForm.name} onChange={(event) => setSettingsForm({ ...settingsForm, name: event.target.value })} minLength={2} maxLength={120} required /></label>
                  <label>Default currency<input value={settingsForm.defaultCurrency} onChange={(event) => setSettingsForm({ ...settingsForm, defaultCurrency: event.target.value.toUpperCase() })} minLength={3} maxLength={3} required /></label>
                  <label>Timezone<input value={settingsForm.timezone} onChange={(event) => setSettingsForm({ ...settingsForm, timezone: event.target.value })} required /></label>
                  <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save settings"}</Button>
                </form>
              )}
              <article className="panel">
                <span className="eyebrow">YOUR ACCESS</span>
                <h2>{currentRole}</h2>
                <p>{user.email}</p>
                <div className="detail-row">
                  <span>Workspace permissions</span>
                  <strong>{canEdit ? "Can edit brands" : "View only"}</strong>
                </div>
              </article>
              <AuditHistory workspaceId={workspace.id} />
            </section>
          ) : (
            <>
              <section className="metrics-row">
                <article className="metric">
                  <span className="eyebrow">WORKSPACE</span>
                  <strong>{workspace.name}</strong>
                  <small>Private team environment</small>
                </article>
                <article className="metric">
                  <span className="eyebrow">BRAND PROFILES</span>
                  <strong>{brands.length}</strong>
                  <small>Stored in Supabase Postgres</small>
                </article>
                <article className="metric">
                  <span className="eyebrow">YOUR ROLE</span>
                  <strong className="capitalize">{currentRole}</strong>
                  <small>Enforced on the server and in RLS</small>
                </article>
                <article className="metric">
                  <span className="eyebrow">DATABASE ACCESS</span>
                  <strong>Protected</strong>
                  <small>Workspace membership policies active</small>
                </article>
              </section>
              <section className="panel brand-panel">
                <div className="panel-header">
                  <div>
                    <span className="eyebrow">BRAND PROFILES</span>
                    <h2>Brand context</h2>
                  </div>
                  {canEdit && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSection("Brands & products");
                        setShowForm((value) => !value);
                      }}
                    >
                      <PlusIcon />
                      Manage brands
                    </Button>
                  )}
                </div>
                {(showForm || editing) && canEdit && (
                  <form
                    className="brand-form"
                    onSubmit={editing ? updateBrand : saveBrand}
                  >
                    <label>
                      Brand name
                      <input
                        value={form.name}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                        minLength={2}
                        maxLength={120}
                        required
                      />
                    </label>
                    <label>
                      Website
                      <input
                        type="url"
                        value={form.website}
                        onChange={(e) =>
                          setForm({ ...form, website: e.target.value })
                        }
                        placeholder="https://example.com"
                      />
                    </label>
                    <label>
                      Positioning
                      <textarea
                        value={form.description}
                        onChange={(e) =>
                          setForm({ ...form, description: e.target.value })
                        }
                        maxLength={2000}
                        rows={2}
                      />
                    </label>
                    <label>
                      Brand voice
                      <input
                        value={form.tone}
                        onChange={(e) =>
                          setForm({ ...form, tone: e.target.value })
                        }
                        maxLength={500}
                      />
                    </label>
                    <label>
                      Markets and languages
                      <input
                        value={form.market}
                        onChange={(e) =>
                          setForm({ ...form, market: e.target.value })
                        }
                        maxLength={500}
                      />
                    </label>
                    <div className="form-actions">
                      <Button disabled={busy} type="submit">
                        {busy
                          ? "Saving…"
                          : editing
                            ? "Save changes"
                            : "Save brand"}
                      </Button>
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => {
                          setShowForm(false);
                          setEditing(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}
                {brands.length ? (
                  <div className="brand-list">
                    {brands.map((brand) => (
                      <article className="brand-row" key={brand.id}>
                        <div className="brand-avatar">
                          {brand.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="brand-info">
                          <h3>{brand.name}</h3>
                          {brand.website && (
                            <a
                              href={brand.website}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <GlobeIcon />
                              {brand.website}
                            </a>
                          )}
                          <p>
                            {brand.description || "No positioning saved yet."}
                          </p>
                          <div className="brand-meta">
                            {brand.tone && <span>Voice: {brand.tone}</span>}
                            {typeof brand.market_json.market === "string" && (
                              <span>Market: {brand.market_json.market}</span>
                            )}
                          </div>
                          <div className="product-list">
                            <div className="product-list-heading"><strong>Products</strong>{canEdit && <button className="delete-button" onClick={() => { setProductBrandId(brand.id); setProductEditingId(null); setProductForm({ name: "", description: "", price: "", currency: workspace.default_currency }); }}>+ Add product</button>}</div>
                            {(brand.products ?? []).length ? (brand.products ?? []).map((product) => <div className="product-row" key={product.id}><span><strong>{product.name}</strong><small>{product.description || "No product description"}{product.price !== null ? ` · ${product.currency ?? workspace.default_currency} ${product.price}` : ""}</small></span>{canEdit && <button className="delete-button" onClick={() => { setProductBrandId(brand.id); setProductEditingId(product.id); setProductForm({ name: product.name, description: product.description ?? "", price: product.price === null ? "" : String(product.price), currency: product.currency ?? workspace.default_currency }); }}>Edit</button>}{["owner", "admin"].includes(currentRole) && <button className="delete-button" onClick={() => deleteProduct(product)}>Delete</button>}</div>) : <small className="product-empty">No products saved.</small>}
                          </div>
                          {productBrandId === brand.id && <form className="product-form" onSubmit={saveProduct}><label>Product name<input value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} minLength={2} maxLength={160} required /></label><label>Description<textarea value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} maxLength={2000} rows={2} /></label><div className="product-price-fields"><label>Price<input type="number" min="0" step="0.01" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} /></label><label>Currency<input value={productForm.currency} onChange={(event) => setProductForm({ ...productForm, currency: event.target.value.toUpperCase() })} minLength={3} maxLength={3} disabled={!productForm.price} /></label></div><div className="form-actions"><Button type="submit" disabled={busy}>{busy ? "Saving..." : productEditingId ? "Save product" : "Create product"}</Button><Button variant="secondary" type="button" onClick={() => { setProductBrandId(null); setProductEditingId(null); }}>Cancel</Button></div></form>}
                        </div>
                        {canEdit && (
                          <>
                            <button
                              className="delete-button"
                              onClick={() => {
                                setForm({
                                  name: brand.name,
                                  website: brand.website ?? "",
                                  description: brand.description ?? "",
                                  tone: brand.tone ?? "",
                                  market:
                                    typeof brand.market_json.market === "string"
                                      ? brand.market_json.market
                                      : "",
                                });
                                setEditing(brand.id);
                                setShowForm(false);
                                setSection("Brands & products");
                              }}
                            >
                              Edit
                            </button>
                            {["owner", "admin"].includes(role) && (
                              <button
                                className="delete-button"
                                onClick={() => deleteBrand(brand)}
                              >
                                Delete
                              </button>
                            )}
                          </>
                        )}
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <BoxIcon />
                    <h3>No brand profiles yet</h3>
                    <p>
                      Create a brand profile to give the next marketing modules
                      a shared source of truth.
                    </p>
                    {canEdit && (
                      <Button onClick={() => setShowForm(true)}>
                        <PlusIcon />
                        Create first brand
                      </Button>
                    )}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
