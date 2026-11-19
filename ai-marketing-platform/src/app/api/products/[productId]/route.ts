import { errorResponse } from "@/lib/api";
import { canAccessWorkspace, currentUser } from "@/lib/server-auth";
import { productSchema } from "@/lib/validation";

type Context = { params: Promise<{ productId: string }> };

export async function PATCH(request: Request, context: Context) {
  const { user } = await currentUser();
  if (!user) return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId) return errorResponse("VALIDATION_ERROR", "workspaceId is required.");
  const parsed = productSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("VALIDATION_ERROR", "Product details are invalid.", parsed.error.flatten());
  const access = await canAccessWorkspace(workspaceId, ["owner", "admin", "editor"]);
  if (!access.user) return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  if (access.error) return errorResponse("FORBIDDEN", "You cannot edit products in this workspace.");
  const { productId } = await context.params;
  const { data, error } = await access.supabase.from("products").update({
    name: parsed.data.name,
    description: parsed.data.description || null,
    price: parsed.data.price,
    currency: parsed.data.currency,
    attributes_json: parsed.data.attributes,
  }).eq("id", productId).eq("brand_id", parsed.data.brandId).select("id, brand_id, name, description, price, currency, attributes_json, updated_at").maybeSingle();
  if (error) return errorResponse("DATABASE_ERROR", "Could not update product.");
  if (!data) return errorResponse("NOT_FOUND", "Product not found.");
  return Response.json({ data });
}

export async function DELETE(request: Request, context: Context) {
  const { user } = await currentUser();
  if (!user) return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId) return errorResponse("VALIDATION_ERROR", "workspaceId is required.");
  const access = await canAccessWorkspace(workspaceId, ["owner", "admin"]);
  if (!access.user) return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  if (access.error) return errorResponse("FORBIDDEN", "Only workspace owners and admins can delete products.");
  const { productId } = await context.params;
  const { error, count } = await access.supabase.from("products").delete({ count: "exact" }).eq("id", productId);
  if (error) return errorResponse("DATABASE_ERROR", "Could not delete product.");
  if (!count) return errorResponse("NOT_FOUND", "Product not found.");
  return new Response(null, { status: 204 });
}
