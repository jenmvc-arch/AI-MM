import { z } from "zod";
import { canAccessWorkspace } from "@/lib/server-auth";
import { errorResponse } from "@/lib/api";

type Params = { params: Promise<{ workspaceId: string }> };
const updateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  defaultCurrency: z.string().regex(/^[A-Z]{3}$/),
  timezone: z.string().trim().min(3).max(80),
});

export async function GET(_request: Request, context: Params) {
  const { workspaceId } = await context.params;
  const access = await canAccessWorkspace(workspaceId, [
    "owner",
    "admin",
    "editor",
    "viewer",
  ]);
  if (!access.user)
    return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  if (access.error)
    return errorResponse("FORBIDDEN", "You cannot access this workspace.");
  const { data: workspace, error } = await access.supabase
    .from("workspaces")
    .select("id, organization_id, name, default_currency, timezone")
    .eq("id", workspaceId)
    .single();
  if (error) return errorResponse("NOT_FOUND", "Workspace not found.");
  const [{ data: brands, error: brandError }, { data: membership }] =
    await Promise.all([
      access.supabase
        .from("brands")
        .select(
          "id, workspace_id, name, website, description, tone, market_json, updated_at, products(id, brand_id, name, description, price, currency)",
        )
        .eq("workspace_id", workspaceId)
        .order("created_at"),
      access.supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", access.user.id)
        .single(),
    ]);
  if (brandError)
    return errorResponse(
      "DATABASE_ERROR",
      "Could not load workspace brands.",
      brandError.message,
    );
  return Response.json({
    data: {
      workspace,
      brands: brands ?? [],
      role: membership?.role ?? "viewer",
    },
  });
}

export async function PATCH(request: Request, context: Params) {
  const { workspaceId } = await context.params;
  const access = await canAccessWorkspace(workspaceId, ["owner", "admin"]);
  if (!access.user)
    return errorResponse("UNAUTHENTICATED", "Sign in to continue.");
  if (access.error)
    return errorResponse(
      "FORBIDDEN",
      "Only workspace owners and admins can change workspace settings.",
    );
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return errorResponse(
      "VALIDATION_ERROR",
      "Workspace details are invalid.",
      parsed.error.flatten(),
    );
  const { data, error } = await access.supabase
    .from("workspaces")
    .update({
      name: parsed.data.name,
      default_currency: parsed.data.defaultCurrency,
      timezone: parsed.data.timezone,
    })
    .eq("id", workspaceId)
    .select("id, organization_id, name, default_currency, timezone, updated_at")
    .single();
  if (error)
    return errorResponse(
      "DATABASE_ERROR",
      "Could not update workspace.",
      error.message,
    );
  return Response.json({ data });
}
