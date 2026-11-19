import { errorResponse } from "@/lib/api";
import { canAccessWorkspace, currentUser } from "@/lib/server-auth";
import { productSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  const brandId = new URL(request.url).searchParams.get("brandId");
  if (!workspaceId || !brandId) return errorResponse("VALIDATION_ERROR", "workspaceId and brandId are required.");
  const access = await canAccessWorkspace(workspaceId, ["owner", "admin", "editor", "viewer"]);
  if (!access.user) return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  if (access.error) return errorResponse("FORBIDDEN", "You cannot access this workspace.");
  const { data, error } = await access.supabase.from("products").select("id, brand_id, name, description, price, currency, attributes_json, created_at, updated_at").eq("brand_id", brandId).order("created_at");
  if (error) return errorResponse("DATABASE_ERROR", "Could not load products.");
  return Response.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const { user } = await currentUser();
  if (!user) return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId) return errorResponse("VALIDATION_ERROR", "workspaceId is required.");
  const parsed = productSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Product details are invalid.", parsed.error.flatten());
  const access = await canAccessWorkspace(workspaceId, ["owner", "admin", "editor"]);
  if (!access.user) return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  if (access.error) return errorResponse("FORBIDDEN", "You cannot edit products in this workspace.");
  const { data: brand } = await access.supabase.from("brands").select("id, organization_id").eq("id", parsed.data.brandId).eq("workspace_id", workspaceId).maybeSingle();
  if (!brand) return errorResponse("NOT_FOUND", "Brand not found.");
  const { data, error } = await access.supabase.from("products").insert({
    organization_id: brand.organization_id,
    brand_id: brand.id,
    name: parsed.data.name,
    description: parsed.data.description || null,
    price: parsed.data.price,
    currency: parsed.data.currency,
    attributes_json: parsed.data.attributes,
  }).select("id, brand_id, name, description, price, currency, attributes_json, created_at, updated_at").single();
  if (error) return errorResponse("DATABASE_ERROR", "Could not create product.");
  return Response.json({ data }, { status: 201 });
}
